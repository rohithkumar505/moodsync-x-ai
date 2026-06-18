import type { Mood } from '../api/client';
import { MOOD_COLORS, MOOD_EMOJI } from '../api/client';
import { MOOD_PROFILES } from '../data/moodProfiles';
import MoodExpressionGuide from './MoodExpressionGuide';
import { EXPRESSION_LABELS, type Reliability } from '../lib/faceMoodEngine';
import { Activity, Music, Heart, ScanFace, RefreshCw } from 'lucide-react';

export interface LiveMoodState {
  mood: Mood | null;
  displayMood: Mood | null;
  confidence: number;
  reliability: Reliability;
  calibrating: boolean;
  expressions: Record<string, number>;
  moodScores: Record<Mood, number>;
  dominantExpression: string;
  faceDetected: boolean;
  stable: boolean;
  framesHeld: number;
  liveDescription: string;
  moodCue?: string;
}

interface Props {
  live: LiveMoodState;
  syncing: boolean;
  onScanAgain: () => void;
  syncedMood: Mood | null;
  sessionLocked?: boolean;
  therapeuticNote?: string;
  playbackMood?: Mood | null;
}

function reliabilityLabel(r: Reliability): string {
  if (r === 'high') return 'High — reading matches your face';
  if (r === 'medium') return 'Medium — hold still for a clearer read';
  return 'Low — face the camera in good light';
}

export default function LiveMoodPanel({
  live,
  syncing,
  onScanAgain,
  syncedMood,
  sessionLocked,
  therapeuticNote,
  playbackMood,
}: Props) {
  const shownMood = syncedMood ?? live.displayMood ?? live.mood;
  const previewMood = live.displayMood ?? live.mood;
  const profile = shownMood ? MOOD_PROFILES[shownMood] : null;
  const color = shownMood ? MOOD_COLORS[shownMood] : '#9ca3af';
  const confidencePct = Math.round(live.confidence * 100);

  const expressionEntries = Object.entries(live.expressions).sort((a, b) => b[1] - a[1]);

  const moodScoreEntries = (Object.entries(live.moodScores || {}) as [Mood, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  const maxMoodScore = Math.max(...moodScoreEntries.map(([, s]) => s), 0.01);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 min-h-[480px] max-lg:min-h-0 flex flex-col">
      <div
        className={`absolute inset-0 bg-gradient-to-br transition-all duration-1000 ${
          profile ? profile.gradient : 'from-purple-900/40 via-indigo-900/30 to-slate-900/40'
        }`}
      />
      <div
        className="absolute inset-0 opacity-40 transition-all duration-1000"
        style={{
          background: shownMood
            ? `radial-gradient(ellipse at 30% 20%, ${color}55 0%, transparent 55%)`
            : undefined,
        }}
      />

      <div className="relative flex-1 p-6 max-lg:p-4 flex flex-col gap-4 max-lg:gap-3 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap max-lg:flex-col max-lg:items-stretch max-lg:gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  live.faceDetected && !live.calibrating ? 'animate-ping bg-emerald-400' : 'bg-white/30'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  live.faceDetected ? (live.calibrating ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-white/40'
                }`}
              />
            </span>
            <span className="text-xs font-semibold tracking-widest uppercase text-white/70 max-lg:text-[10px] max-lg:tracking-wide max-lg:leading-snug max-lg:normal-case">
              {sessionLocked
                ? 'Mood detected — playlist playing'
                : !live.faceDetected
                  ? 'Waiting for face'
                  : live.calibrating
                    ? `Reading… ${live.framesHeld}/8`
                    : 'Mood locked'}
            </span>
          </div>
          {live.faceDetected && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full border max-lg:w-full max-lg:text-[11px] max-lg:leading-snug max-lg:whitespace-normal max-lg:text-left ${
                live.reliability === 'high'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : live.reliability === 'medium'
                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/25'
                    : 'bg-white/5 text-white/50 border-white/15'
              }`}
            >
              {reliabilityLabel(live.reliability)}
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
          {sessionLocked && syncedMood ? (
          <div className="space-y-4 w-full max-w-md text-center">
            <div
              className="text-7xl"
              style={{ filter: `drop-shadow(0 0 20px ${color}88)` }}
            >
              {MOOD_EMOJI[syncedMood]}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Your detected mood</p>
              <h2 className="text-2xl font-bold" style={{ color }}>
                {syncedMood} — {MOOD_PROFILES[syncedMood].title}
              </h2>
              <p className="text-sm text-white/70 mt-2 leading-relaxed">
                {MOOD_PROFILES[syncedMood].description}
              </p>
              {therapeuticNote && (
                <p className="text-sm text-purple-200/90 mt-3 bg-purple-500/10 rounded-xl p-3 border border-purple-400/20 max-lg:text-xs max-lg:leading-relaxed break-words text-left">
                  {therapeuticNote}
                </p>
              )}
              {playbackMood && playbackMood !== syncedMood && (
                <p className="text-xs text-emerald-300/90 mt-2">
                  Music playing: {playbackMood.toLowerCase()} songs (matched to help your mood)
                </p>
              )}
            </div>
          </div>
        ) : !live.faceDetected ? (
            <div className="space-y-4 max-w-sm w-full max-lg:max-w-none">
              <ScanFace size={48} className="mx-auto text-white/30 max-lg:w-10 max-lg:h-10" />
              <p className="text-lg font-medium text-white/80 max-lg:text-base max-lg:leading-relaxed">
                Enable camera, then hold one of the faces from the guide above
              </p>
              <div className="hidden lg:block">
                <MoodExpressionGuide activeMood={null} compact />
              </div>
            </div>
          ) : live.calibrating || !shownMood ? (
            <div className="space-y-4 max-w-sm max-lg:max-w-none w-full">
              {previewMood ? (
                <div className="space-y-2">
                  <span className="text-5xl">{MOOD_EMOJI[previewMood]}</span>
                  <p className="text-lg font-semibold" style={{ color: MOOD_COLORS[previewMood] }}>
                    Reading {previewMood}…
                  </p>
                </div>
              ) : (
                <div className="w-16 h-16 mx-auto border-2 border-amber-400/60 border-t-amber-400 rounded-full animate-spin" />
              )}
              <p className="text-lg font-medium text-amber-200 max-lg:text-base">Hold this expression</p>
              <p className="text-sm text-white/55 max-lg:text-xs max-lg:leading-relaxed break-words">
                {live.moodCue || `Frame ${live.framesHeld}/8 — keep face still`}
                {' · '}
                <span className="capitalize">{EXPRESSION_LABELS[live.dominantExpression]}</span>{' '}
                {Math.round((live.expressions[live.dominantExpression] ?? 0) * 100)}%
              </p>
            </div>
          ) : profile && shownMood ? (
            <div className="space-y-4 w-full max-w-md max-lg:max-w-none">
              <div
                className="text-7xl transition-all duration-700"
                style={{ filter: `drop-shadow(0 0 24px ${color}88)` }}
              >
                {MOOD_EMOJI[shownMood]}
              </div>

              <div>
                <h2 className="text-2xl md:text-3xl font-bold transition-colors duration-700" style={{ color }}>
                  {profile.title}
                </h2>
                <p className="text-purple-200/90 text-sm mt-1 font-medium">{profile.tagline}</p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke={color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${confidencePct} 100`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold" style={{ color }}>{confidencePct}%</span>
                  </div>
                </div>
                <div className="text-left text-sm">
                  <p className="text-white/50 text-xs uppercase">Face signal</p>
                  <p className="text-white/85 capitalize">
                    {EXPRESSION_LABELS[live.dominantExpression]} · {Math.round((live.expressions[live.dominantExpression] ?? 0) * 100)}%
                  </p>
                </div>
              </div>

              <p className="text-sm text-white/80 leading-relaxed text-left bg-black/25 rounded-xl p-4 border border-white/10 max-lg:text-xs max-lg:p-3 break-words">
                {live.liveDescription || profile.description}
              </p>
            </div>
          ) : null}
        </div>

        {live.faceDetected && expressionEntries.length > 0 && (
          <div className="space-y-2 bg-black/25 rounded-xl p-4 border border-white/10 max-lg:p-3">
            <div className="flex items-center gap-2 text-xs text-white/50 uppercase tracking-wide max-lg:normal-case max-lg:tracking-normal">
              <Activity size={14} />
              Smoothed expression signals
            </div>
            {expressionEntries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 max-lg:gap-1.5">
                <span className="text-xs text-white/60 w-20 max-lg:w-[4.75rem] capitalize shrink-0 leading-tight break-words">
                  {EXPRESSION_LABELS[key] || key}
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(value * 100)}%`,
                      backgroundColor: key === live.dominantExpression ? color : 'rgba(255,255,255,0.3)',
                    }}
                  />
                </div>
                <span className="text-xs text-white/40 w-8 text-right">{Math.round(value * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {live.faceDetected && moodScoreEntries.length > 0 && (
          <div className="grid grid-cols-5 gap-1 max-lg:grid-cols-3 max-lg:gap-1.5">
            {moodScoreEntries.map(([m, score]) => (
              <div
                key={m}
                className={`text-center py-1.5 rounded-lg text-[10px] border transition-all max-lg:px-1 max-lg:leading-tight ${
                  shownMood === m
                    ? 'border-white/30 bg-white/10 font-semibold'
                    : 'border-transparent bg-white/5 text-white/40'
                }`}
                style={shownMood === m ? { color: MOOD_COLORS[m] } : undefined}
              >
                {m.slice(0, 3)}
                <div className="opacity-60 max-lg:text-[9px]">{Math.round((score / maxMoodScore) * 100)}</div>
              </div>
            ))}
          </div>
        )}

        {profile && live.displayMood && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-lg:grid-cols-1 max-lg:gap-2">
            <div className="flex gap-2 items-start bg-white/5 rounded-lg p-3 border border-white/10 min-w-0">
              <Music size={16} className="text-purple-300 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-white/50 uppercase">Music match</p>
                <p className="text-xs text-white/80 leading-relaxed break-words">{profile.musicVibe}</p>
              </div>
            </div>
            <div className="flex gap-2 items-start bg-white/5 rounded-lg p-3 border border-white/10 min-w-0">
              <Heart size={16} className="text-pink-300 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-white/50 uppercase">Wellness tip</p>
                <p className="text-xs text-white/80 leading-relaxed break-words">{profile.wellnessTip}</p>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onScanAgain}
          disabled={syncing}
          className="glass-btn w-full flex items-center justify-center gap-2 py-3.5 max-lg:py-3 max-lg:text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={18} />
          {syncing
            ? 'Building your mood playlist...'
            : sessionLocked
              ? 'Scan again for a new mood'
              : 'Cancel and scan again'}
        </button>
      </div>
    </div>
  );
}
