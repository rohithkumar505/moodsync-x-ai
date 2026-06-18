import { MOODS, type Mood } from '../api/client';
import type { TrendPoint } from '../components/MoodTrendLineChart';

export interface ReportBundle {
  period: { label: string; days: number; from: string | null; to: string | null };
  user: { name: string; email: string; preferredLanguage?: string } | null;
  summary: {
    totalMoodChecks: number;
    mostCommonMood: Mood | null;
    leastCommonMood: Mood | null;
    streakDays: number;
    checkInsThisWeek: number;
    avgConfidence: number | null;
    currentMood: { mood: Mood; date?: string } | null;
  };
  narrative: string;
  distribution: { mood: string; count: number; percentage: number }[];
  frequency: { mood: string; count: number }[];
  trends: TrendPoint[];
  emotionDna: {
    dominantMood: Mood | null;
    secondaryMood: Mood | null;
    dominantPercentage: number;
    insight: string;
    stability: string | null;
    percentages: Record<string, number>;
    totalCheckIns: number;
  };
  prediction: { predictedMood: Mood | null; confidence: number; insight: string } | null;
  wellness: {
    journalCount: number;
    playlistCount: number;
    playlistSongCount: number;
    achievementsUnlocked: number;
    streakDays: number;
  };
  moodHistory: { id: string; mood: string; date: string; source?: string; confidence?: number }[];
  achievements: { achievementName: string; date: string }[];
  songPreferences: { playlistCount: number; playlists: { playlistName: string; songCount: number }[] };
  generatedAt: string;
}

const EMPTY_DNA: ReportBundle['emotionDna'] = {
  dominantMood: null,
  secondaryMood: null,
  dominantPercentage: 0,
  insight: 'Start logging moods to build your Emotion DNA profile.',
  stability: null,
  percentages: Object.fromEntries(MOODS.map((m) => [m, 0])),
  totalCheckIns: 0,
};

function asMood(value: unknown): Mood | null {
  return typeof value === 'string' && MOODS.includes(value as Mood) ? (value as Mood) : null;
}

function buildNarrative(summary: ReportBundle['summary'], dna: ReportBundle['emotionDna'], achievements: number): string {
  const total = summary.totalMoodChecks;
  if (total === 0) {
    return (
      'You have not logged any moods in this period yet. ' +
      'Use Mood Sync or a manual check-in to start building your wellness report.'
    );
  }
  const parts = [`You logged ${total} mood check-in${total !== 1 ? 's' : ''} in this report period.`];
  if (summary.mostCommonMood) {
    parts.push(`Your most frequent mood was ${summary.mostCommonMood.toLowerCase()}.`);
  }
  if (dna.insight) parts.push(dna.insight);
  if (summary.streakDays >= 3) {
    parts.push(`You are on a ${summary.streakDays}-day streak — keep it going.`);
  }
  if (achievements > 0) {
    parts.push(`You have unlocked ${achievements} achievement${achievements !== 1 ? 's' : ''}.`);
  }
  return parts.join(' ');
}

/** Accept new bundle or legacy `/api/reports` responses. */
export function normalizeReportBundle(data: unknown, days = 30): ReportBundle | null {
  if (!data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;
  const clampedDays = Math.max(7, Math.min(days, 90));

  if (raw.summary && raw.period && raw.wellness) {
    const emotionDna = (raw.emotionDna as ReportBundle['emotionDna']) || EMPTY_DNA;
    return {
      period: raw.period as ReportBundle['period'],
      user: (raw.user as ReportBundle['user']) ?? null,
      summary: raw.summary as ReportBundle['summary'],
      narrative: typeof raw.narrative === 'string' ? raw.narrative : buildNarrative(raw.summary as ReportBundle['summary'], emotionDna, 0),
      distribution: Array.isArray(raw.distribution) ? raw.distribution : [],
      frequency: Array.isArray(raw.frequency) ? raw.frequency : [],
      trends: Array.isArray(raw.trends) ? raw.trends : [],
      emotionDna,
      prediction: (raw.prediction as ReportBundle['prediction']) ?? null,
      wellness: raw.wellness as ReportBundle['wellness'],
      moodHistory: Array.isArray(raw.moodHistory) ? raw.moodHistory : [],
      achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
      songPreferences: (raw.songPreferences as ReportBundle['songPreferences']) ?? { playlistCount: 0, playlists: [] },
      generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
    };
  }

  const userReport = raw.userReport as Record<string, unknown> | undefined;
  const moodStats = raw.moodStatistics as Record<string, unknown> | undefined;
  const emotionDnaRaw = raw.emotionDna as Record<string, unknown> | undefined;
  const songPrefs = raw.songPreferences as ReportBundle['songPreferences'] | undefined;

  const total =
    (typeof moodStats?.total === 'number' ? moodStats.total : null) ??
    (typeof userReport?.totalMoodChecks === 'number' ? userReport.totalMoodChecks : 0);

  const emotionDna: ReportBundle['emotionDna'] = emotionDnaRaw
    ? {
        dominantMood: asMood(emotionDnaRaw.dominantMood),
        secondaryMood: asMood(emotionDnaRaw.secondaryMood),
        dominantPercentage: typeof emotionDnaRaw.dominantPercentage === 'number' ? emotionDnaRaw.dominantPercentage : 0,
        insight: typeof emotionDnaRaw.insight === 'string' ? emotionDnaRaw.insight : EMPTY_DNA.insight,
        stability: typeof emotionDnaRaw.stability === 'string' ? emotionDnaRaw.stability : null,
        percentages: (emotionDnaRaw.percentages as Record<string, number>) || EMPTY_DNA.percentages,
        totalCheckIns: typeof emotionDnaRaw.totalCheckIns === 'number' ? emotionDnaRaw.totalCheckIns : total,
      }
    : EMPTY_DNA;

  const achievementsUnlocked =
    (typeof userReport?.achievementsUnlocked === 'number' ? userReport.achievementsUnlocked : null) ??
    (Array.isArray(raw.achievements) ? raw.achievements.length : 0);

  const summary: ReportBundle['summary'] = {
    totalMoodChecks: total,
    mostCommonMood: asMood(moodStats?.mostCommon),
    leastCommonMood: asMood(moodStats?.leastCommon),
    streakDays: typeof userReport?.streakDays === 'number' ? userReport.streakDays : 0,
    checkInsThisWeek: typeof userReport?.checkInsThisWeek === 'number' ? userReport.checkInsThisWeek : 0,
    avgConfidence: typeof userReport?.avgConfidence === 'number' ? userReport.avgConfidence : null,
    currentMood: null,
  };

  const wellness: ReportBundle['wellness'] = {
    journalCount: typeof userReport?.journalCount === 'number' ? userReport.journalCount : 0,
    playlistCount: songPrefs?.playlistCount ?? 0,
    playlistSongCount: typeof userReport?.playlistSongCount === 'number' ? userReport.playlistSongCount : 0,
    achievementsUnlocked,
    streakDays: summary.streakDays,
  };

  return {
    period: {
      label: clampedDays < 90 ? `Last ${clampedDays} days` : 'All time',
      days: clampedDays,
      from: null,
      to: null,
    },
    user: userReport
      ? {
          name: typeof userReport.name === 'string' ? userReport.name : 'MoodSync user',
          email: typeof userReport.email === 'string' ? userReport.email : '',
          preferredLanguage:
            typeof userReport.preferredLanguage === 'string' ? userReport.preferredLanguage : undefined,
        }
      : null,
    summary,
    narrative: buildNarrative(summary, emotionDna, achievementsUnlocked),
    distribution: Array.isArray(raw.distribution) ? raw.distribution : [],
    frequency: Array.isArray(raw.frequency) ? raw.frequency : [],
    trends: Array.isArray(raw.trends) ? raw.trends : [],
    emotionDna,
    prediction: (raw.prediction as ReportBundle['prediction']) ?? null,
    wellness,
    moodHistory: Array.isArray(raw.moodHistory) ? raw.moodHistory : [],
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    songPreferences: songPrefs ?? { playlistCount: 0, playlists: [] },
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
  };
}
