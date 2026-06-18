import type { Mood } from '../api/client';

export type ExpressionKey =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'fearful'
  | 'disgusted'
  | 'surprised'
  | 'neutral';

export type Expressions = Record<ExpressionKey, number>;
export type Reliability = 'low' | 'medium' | 'high';

export interface PostureHints {
  headDownScore: number;
  smileLift: number;
  frownDrop: number;
  faceCenterY: number;
}

export interface MoodSignals {
  smile: number;
  laugh: number;
  sad: number;
  anger: number;
  calm: number;
  introspective: boolean;
}

export interface MoodAnalysis {
  mood: Mood;
  confidence: number;
  dominantExpression: ExpressionKey;
  moodScores: Record<Mood, number>;
  reliability: Reliability;
  signals: MoodSignals;
  moodCue: string;
}

export interface SmoothedMoodResult extends MoodAnalysis {
  smoothedExpressions: Expressions;
  stable: boolean;
  calibrating: boolean;
  displayMood: Mood | null;
  framesHeld: number;
}

const EXPRESSION_KEYS: ExpressionKey[] = [
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
  'neutral',
];

const EMPTY: Expressions = {
  happy: 0,
  sad: 0,
  angry: 0,
  fearful: 0,
  disgusted: 0,
  surprised: 0,
  neutral: 1,
};

const DEFAULT_POSTURE: PostureHints = {
  headDownScore: 0,
  smileLift: 0,
  frownDrop: 0,
  faceCenterY: 0.5,
};

const EMA_ALPHA = 0.3;
const POSTURE_EMA = 0.3;
const HISTORY_SIZE = 8;
const STABLE_REQUIRED = 6;
const HYSTERESIS = 0.08;

function toExpressions(raw: Record<string, number>): Expressions {
  const out = { ...EMPTY };
  for (const key of EXPRESSION_KEYS) {
    out[key] = Math.max(0, Number(raw[key] ?? 0));
  }
  return out;
}

function dominantExpression(expressions: Expressions): ExpressionKey {
  return EXPRESSION_KEYS.reduce((best, key) =>
    expressions[key] > expressions[best] ? key : best
  );
}

export function deriveMoodSignals(
  e: Expressions,
  posture: PostureHints = DEFAULT_POSTURE
): MoodSignals {
  const smile = Math.min(1, e.happy * 1.2 + posture.smileLift * 0.6);

  const laugh =
    e.happy >= 0.15 && e.surprised >= 0.1
      ? Math.min(1, e.happy * 0.75 + e.surprised * 0.5)
      : 0;

  const sadFromFace = e.sad * 1.35 + e.fearful * 0.4 + posture.frownDrop * 0.35;
  const sadFromPosture = posture.headDownScore * 0.65;
  const sad = Math.min(1, sadFromFace + sadFromPosture);

  const anger = Math.min(
    1,
    e.angry * 1.45 + e.disgusted * 0.55 + posture.frownDrop * 0.25
  );

  const notHappy = smile < 0.22 && laugh < 0.12;
  const notSad = sad < 0.16;
  const notAngry = anger < 0.14;
  const lowStress = anger < 0.1 && e.fearful < 0.12;

  const calm = Math.min(
    1,
    e.neutral * 1.2 +
      (notHappy && notSad && notAngry && lowStress ? 0.5 : 0)
  );

  const introspective =
    posture.headDownScore >= 0.2 &&
    smile < 0.22 &&
    anger < 0.2;

  return { smile, laugh, sad, anger, calm, introspective };
}

/** Match user actions from the on-screen guide to mood labels. */
export function moodFromGuideActions(
  e: Expressions,
  posture: PostureHints,
  signals: MoodSignals
): Mood | null {
  const { smile, laugh, sad, anger, calm } = signals;

  // 😊 HAPPY — smile wide or laugh
  if (smile >= 0.22 || laugh >= 0.14 || (e.happy >= 0.24 && e.happy > e.sad && e.happy > e.angry)) {
    return 'HAPPY';
  }

  // 😡 ANGRY — frown, tight jaw (angry face beats sad when tension is high)
  if (
    anger >= 0.11 &&
    (e.angry >= 0.09 || e.disgusted >= 0.09) &&
    anger >= sad * 0.85 &&
    smile < 0.22
  ) {
    return 'ANGRY';
  }

  // 😔 SAD — look down, relaxed mouth, no smile
  if (
    (posture.headDownScore >= 0.18 || e.sad >= 0.09 || signals.introspective) &&
    smile < 0.2 &&
    anger < 0.16 &&
    (sad >= 0.1 || posture.headDownScore >= 0.22)
  ) {
    return 'SAD';
  }

  // 😌 RELAXED — blank calm face, breathe slow
  if (
    calm >= 0.25 &&
    smile < 0.16 &&
    sad < 0.12 &&
    anger < 0.1 &&
    posture.headDownScore < 0.22 &&
    e.neutral >= 0.28
  ) {
    return 'RELAXED';
  }

  return null;
}

function moodCueFor(mood: Mood, signals: MoodSignals, e: Expressions): string {
  switch (mood) {
    case 'HAPPY':
      if (signals.laugh >= 0.2) return '😄 Laughing — happy mood detected';
      if (signals.smile >= 0.28) return '😊 Smile detected — you look happy';
      return '😊 Cheerful expression';
    case 'SAD':
      if (signals.introspective) return '😔 Head down / quiet — sad mood detected';
      if (signals.sad >= 0.2) return '😢 Sad face — low mood detected';
      return '😔 Not happy — sad mood reading';
    case 'ANGRY':
      if (signals.anger >= 0.22) return '😠 Anger / tension detected on your face';
      if (e.disgusted >= 0.14) return '😤 Tight, intense expression detected';
      return '😠 Frustrated or angry mood';
    case 'RELAXED':
      return '😌 Calm — peaceful, not happy or sad';
    case 'NEUTRAL':
    default:
      return '😐 Steady, balanced expression';
  }
}

/**
 * Detection rules (what we SHOW on screen):
 *  HAPPY  = smile / laugh
 *  SAD    = frown, head down, low energy, no smile
 *  ANGRY  = tense jaw, furrowed brow, angry/disgusted face
 *  RELAXED = neutral calm — not happy, not sad, not angry
 */
export function classifyMood(
  expressions: Expressions,
  previousMood: Mood | null = null,
  posture: PostureHints = DEFAULT_POSTURE
): MoodAnalysis {
  const e = expressions;
  const dominant = dominantExpression(e);
  const signals = deriveMoodSignals(e, posture);

  // Guide-matched mood (what the user is instructed to do on screen)
  const guideMood = moodFromGuideActions(e, posture, signals);

  const moodScores: Record<Mood, number> = {
    HAPPY: signals.smile * 3.5 + signals.laugh * 2.8,
    SAD: signals.sad * 3.8 + (signals.introspective ? 0.7 : 0),
    ANGRY: signals.anger * 3.8,
    RELAXED: signals.calm * 2.4,
    NEUTRAL: e.neutral * 0.9,
  };

  // ── HAPPY ──
  if (signals.smile >= 0.2 || signals.laugh >= 0.15) {
    moodScores.HAPPY += 0.6;
  }
  if (e.happy >= 0.22 && e.happy > e.sad * 1.4 && e.happy > e.angry) {
    moodScores.HAPPY += 0.45;
  }

  // ── SAD — sensitive, wins over calm/neutral ──
  if (signals.sad >= 0.12 || signals.introspective || dominant === 'sad') {
    moodScores.SAD += 0.65;
    moodScores.RELAXED *= 0.35;
    moodScores.NEUTRAL *= 0.4;
    moodScores.HAPPY *= 0.35;
  }
  if (e.sad >= 0.1 && e.happy < 0.2) moodScores.SAD += 0.4;
  if (posture.headDownScore >= 0.28 && signals.smile < 0.22) moodScores.SAD += 0.45;
  if (posture.frownDrop >= 0.18 && signals.smile < 0.25) moodScores.SAD += 0.35;

  // ── ANGRY — sensitive, wins over calm/neutral ──
  if (signals.anger >= 0.12 || dominant === 'angry' || dominant === 'disgusted') {
    moodScores.ANGRY += 0.65;
    moodScores.RELAXED *= 0.3;
    moodScores.NEUTRAL *= 0.35;
    moodScores.HAPPY *= 0.4;
  }
  if (e.angry >= 0.1 && e.angry >= e.happy) moodScores.ANGRY += 0.45;
  if (e.disgusted >= 0.12) moodScores.ANGRY += 0.35;

  // ── RELAXED only when NO sad and NO angry ──
  if (signals.calm >= 0.28 && signals.smile < 0.2 && signals.sad < 0.14 && signals.anger < 0.12) {
    moodScores.RELAXED += 0.55;
  } else {
    moodScores.RELAXED *= 0.55;
  }

  // Raw expression dominant fast-path (trust face-api when clear)
  if (dominant === 'sad' && e.sad >= 0.08 && e.happy < 0.28) {
    moodScores.SAD += 0.5;
  }
  if ((dominant === 'angry' || dominant === 'disgusted') && (e.angry >= 0.08 || e.disgusted >= 0.08)) {
    moodScores.ANGRY += 0.5;
  }
  if (dominant === 'happy' && e.happy >= 0.15) {
    moodScores.HAPPY += 0.45;
  }

  const ranked = (Object.entries(moodScores) as [Mood, number][]).sort((a, b) => b[1] - a[1]);
  let mood = ranked[0][0];
  const topScore = ranked[0][1];
  const secondScore = ranked[1]?.[1] ?? 0;
  const gap = topScore > 0 ? (topScore - secondScore) / topScore : 0;

  if (previousMood && previousMood !== mood) {
    const prevScore = moodScores[previousMood];
    if (topScore - prevScore < HYSTERESIS) mood = previousMood;
  }

  // Sad vs angry: pick stronger negative signal
  if (mood === 'RELAXED' || mood === 'NEUTRAL') {
    if (signals.anger >= 0.14 && signals.anger >= signals.sad) mood = 'ANGRY';
    else if (signals.sad >= 0.14 || signals.introspective) mood = 'SAD';
    else if (signals.calm >= 0.3 && signals.smile < 0.2) mood = 'RELAXED';
  }

  if (signals.smile >= 0.28 && signals.smile > signals.sad && signals.smile > signals.anger) {
    mood = 'HAPPY';
  }

  if (guideMood) {
    mood = guideMood;
  }

  let reliability: Reliability = 'low';
  const primarySignal =
    mood === 'HAPPY'
      ? Math.max(signals.smile, signals.laugh)
      : mood === 'SAD'
        ? signals.sad
        : mood === 'ANGRY'
          ? signals.anger
          : mood === 'RELAXED'
            ? signals.calm
            : e.neutral;

  if (primarySignal >= 0.22 && gap >= 0.08) reliability = 'high';
  else if (primarySignal >= 0.12 && gap >= 0.05) reliability = 'medium';

  if (signals.smile >= 0.28 || signals.laugh >= 0.22) reliability = 'high';
  if (signals.sad >= 0.18 || signals.introspective) {
    reliability = reliability === 'low' ? 'medium' : reliability;
    if (signals.sad >= 0.28) reliability = 'high';
  }
  if (signals.anger >= 0.14) {
    reliability = reliability === 'low' ? 'medium' : reliability;
    if (signals.anger >= 0.22) reliability = 'high';
  }
  if (guideMood) {
    reliability = reliability === 'low' ? 'medium' : reliability;
  }

  const confidence = Math.min(
    0.98,
    Math.max(
      0.25,
      primarySignal * 0.55 +
        gap * 0.28 +
        (reliability === 'high' ? 0.14 : reliability === 'medium' ? 0.07 : 0)
    )
  );

  return {
    mood,
    confidence: Math.round(confidence * 100) / 100,
    dominantExpression: dominant,
    moodScores,
    reliability,
    signals,
    moodCue: moodCueFor(mood, signals, e),
  };
}

export function computePostureFromLandmarks(
  positions: { x: number; y: number }[],
  box: { x: number; y: number; width: number; height: number },
  frameHeight: number
): PostureHints {
  if (positions.length < 58) {
    return {
      headDownScore: Math.max(0, Math.min(1, ((box.y + box.height / 2) / frameHeight - 0.4) * 2.2)),
      smileLift: 0,
      frownDrop: 0,
      faceCenterY: (box.y + box.height / 2) / frameHeight,
    };
  }

  const leftEye = positions[36];
  const rightEye = positions[45];
  const nose = positions[33] ?? positions[30];
  const chin = positions[8];
  const mouthLeft = positions[48];
  const mouthRight = positions[54];
  const upperLip = positions[51];

  const eyeY = (leftEye.y + rightEye.y) / 2;
  const faceHeight = Math.max(1, chin.y - eyeY);
  const noseRel = (nose.y - eyeY) / faceHeight;

  const cornerAvgY = (mouthLeft.y + mouthRight.y) / 2;
  const smileLift = Math.max(0, Math.min(1, (upperLip.y - cornerAvgY) / 9));
  const frownDrop = Math.max(0, Math.min(1, (cornerAvgY - upperLip.y) / 9));

  const headDownFromPose = Math.max(0, Math.min(1, (noseRel - 0.48) * 3.5));
  const headDownFromFrame = Math.max(
    0,
    Math.min(1, ((box.y + box.height * 0.55) / frameHeight - 0.46) * 2.6)
  );
  const headDownScore = Math.max(headDownFromPose, headDownFromFrame * 0.9);

  return {
    headDownScore,
    smileLift,
    frownDrop,
    faceCenterY: (box.y + box.height / 2) / frameHeight,
  };
}

function resolveDisplayMood(
  voted: Mood,
  analysis: MoodAnalysis,
  expressions: Expressions,
  posture: PostureHints
): Mood | null {
  const { signals } = analysis;
  const e = expressions;
  const guideMood = moodFromGuideActions(e, posture, signals);

  if (guideMood && analysis.reliability !== 'low') return guideMood;

  if (analysis.reliability !== 'low') return voted;

  if (signals.anger >= 0.12 && signals.anger >= signals.sad && signals.anger >= signals.smile) {
    return 'ANGRY';
  }
  if (signals.sad >= 0.12 || signals.introspective) return 'SAD';
  if (signals.smile >= 0.2 || signals.laugh >= 0.15) return 'HAPPY';
  if (
    signals.calm >= 0.28 &&
    signals.smile < 0.18 &&
    signals.sad < 0.14 &&
    signals.anger < 0.1
  ) {
    return 'RELAXED';
  }
  if (e.angry >= 0.1 || e.disgusted >= 0.1) return 'ANGRY';
  if (e.sad >= 0.1) return 'SAD';

  return voted;
}

export class FaceMoodEngine {
  private smoothed: Expressions | null = null;
  private smoothedPosture: PostureHints = { ...DEFAULT_POSTURE };
  private history: Mood[] = [];
  private heldMood: Mood | null = null;
  private heldCount = 0;
  private lastDisplayMood: Mood | null = null;

  reset(): void {
    this.smoothed = null;
    this.smoothedPosture = { ...DEFAULT_POSTURE };
    this.history = [];
    this.heldMood = null;
    this.heldCount = 0;
    this.lastDisplayMood = null;
  }

  private smooth(raw: Expressions): Expressions {
    if (!this.smoothed) {
      this.smoothed = { ...raw };
      return this.smoothed;
    }
    const next = { ...this.smoothed };
    for (const key of EXPRESSION_KEYS) {
      next[key] = this.smoothed[key] * (1 - EMA_ALPHA) + raw[key] * EMA_ALPHA;
      next[key] = Math.round(next[key] * 1000) / 1000;
    }
    this.smoothed = next;
    return next;
  }

  private smoothPosture(raw: PostureHints): PostureHints {
    const prev = this.smoothedPosture;
    const blend = (a: number, b: number) =>
      Math.round((a * (1 - POSTURE_EMA) + b * POSTURE_EMA) * 1000) / 1000;
    this.smoothedPosture = {
      headDownScore: blend(prev.headDownScore, raw.headDownScore),
      smileLift: blend(prev.smileLift, raw.smileLift),
      frownDrop: blend(prev.frownDrop, raw.frownDrop),
      faceCenterY: blend(prev.faceCenterY, raw.faceCenterY),
    };
    return this.smoothedPosture;
  }

  private majorityMood(candidate: Mood): Mood {
    this.history.push(candidate);
    if (this.history.length > HISTORY_SIZE) this.history.shift();
    const counts = new Map<Mood, number>();
    for (const m of this.history) counts.set(m, (counts.get(m) ?? 0) + 1);
    let best: Mood = candidate;
    let bestCount = 0;
    for (const [m, c] of counts) {
      if (c > bestCount) {
        best = m;
        bestCount = c;
      }
    }
    return best;
  }

  process(
    rawInput: Record<string, number>,
    postureInput: PostureHints = DEFAULT_POSTURE
  ): SmoothedMoodResult {
    const raw = toExpressions(rawInput);
    const smoothed = this.smooth(raw);
    const posture = this.smoothPosture(postureInput);
    const instant = classifyMood(smoothed, this.heldMood, posture);
    const votedMood = this.majorityMood(instant.mood);

    if (this.heldMood === votedMood) {
      this.heldCount += 1;
    } else {
      this.heldMood = votedMood;
      this.heldCount = 1;
    }

    const stable = this.heldCount >= STABLE_REQUIRED;
    const calibrating = this.heldCount < STABLE_REQUIRED;
    const finalAnalysis = classifyMood(smoothed, this.lastDisplayMood, posture);

    let displayMood: Mood | null = null;
    if (stable) {
      displayMood = resolveDisplayMood(votedMood, finalAnalysis, smoothed, posture);
      if (displayMood) this.lastDisplayMood = displayMood;
    }

    return {
      ...finalAnalysis,
      mood: votedMood,
      smoothedExpressions: smoothed,
      stable,
      calibrating,
      displayMood,
      framesHeld: this.heldCount,
    };
  }
}

export function getLiveMoodDescription(
  mood: Mood,
  expressions: Expressions,
  _dominant: string,
  signals?: MoodSignals
): string {
  const s = signals ?? deriveMoodSignals(expressions, DEFAULT_POSTURE);
  const pct = (key: ExpressionKey) => Math.round((expressions[key] ?? 0) * 100);

  switch (mood) {
    case 'HAPPY':
      if (s.laugh >= 0.2) {
        return `Happy mood confirmed — you're laughing or grinning (${pct('happy')}% joy). Upbeat songs will play.`;
      }
      return `Happy mood confirmed — clear smile (${Math.round(s.smile * 100)}% signal). Feel-good music matches your face.`;
    case 'SAD':
      if (s.introspective) {
        return `Sad mood confirmed — head down, quiet, not smiling. We'll play happy uplifting songs to cheer you up.`;
      }
      return `Sad mood confirmed — ${Math.round(s.sad * 100)}% low-mood signal, ${pct('sad')}% sad expression. Happy songs will lift your spirit.`;
    case 'ANGRY':
      return `Angry / tense mood confirmed — ${Math.round(s.anger * 100)}% tension (${pct('angry')}% angry). Calm peaceful songs will help you relax.`;
    case 'RELAXED':
      return `Calm mood confirmed — peaceful face, not happy or sad. Soft mellow music fits perfectly.`;
    case 'NEUTRAL':
    default:
      return `Balanced mood — ${pct('neutral')}% neutral. Popular versatile tracks coming up.`;
  }
}

export const MOOD_EXPRESSION_GUIDE: Record<Mood, string> = {
  HAPPY: 'Smile wide or laugh at the camera',
  SAD: 'Look down, relax your mouth, no smile — think of something sad',
  ANGRY: 'Frown, tighten jaw, furrow brows — show frustration',
  RELAXED: 'Relax face completely — breathe slow, no expression',
  NEUTRAL: 'Look at camera with a normal, steady face',
};

export const EXPRESSION_LABELS: Record<string, string> = {
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  fearful: 'Fearful',
  disgusted: 'Disgusted',
  surprised: 'Surprised',
  neutral: 'Neutral',
};

export function expressionsToRecord(expressions: Expressions): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of EXPRESSION_KEYS) out[key] = expressions[key];
  return out;
}
