import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Dna,
  RefreshCw,
  ScanFace,
  TrendingUp,
} from 'lucide-react';
import api, { MOOD_COLORS, MOOD_EMOJI, MOODS, type Mood } from '../api/client';
import { MOOD_PROFILES } from '../data/moodProfiles';

interface EmotionDnaData {
  percentages: Record<string, number>;
  recentPercentages: Record<string, number>;
  moodCounts: Record<string, number>;
  totalCheckIns: number;
  recentCheckIns: number;
  dominantMood: Mood | null;
  secondaryMood: Mood | null;
  dominantPercentage: number;
  insight: string;
  stability: 'focused' | 'steady' | 'varied' | null;
  lastUpdated: string | null;
}

interface MoodPrediction {
  recentPattern: string[];
  predictedMood: Mood | null;
  confidence: number;
  insight: string;
}

const STABILITY_LABELS: Record<string, { label: string; description: string }> = {
  focused: {
    label: 'Focused profile',
    description: 'One mood clearly leads your check-ins.',
  },
  steady: {
    label: 'Steady profile',
    description: 'A clear favorite with healthy variety.',
  },
  varied: {
    label: 'Varied profile',
    description: 'Your moods spread across the spectrum.',
  },
};

function formatMoodLabel(mood: string): string {
  return mood.charAt(0) + mood.slice(1).toLowerCase();
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function DnaSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-pulse">
      <div className="h-28 rounded-2xl bg-white/5" />
      <div className="h-48 rounded-2xl bg-white/5" />
      <div className="h-64 rounded-2xl bg-white/5" />
    </div>
  );
}

export default function EmotionDNAPage() {
  const [dna, setDna] = useState<EmotionDnaData | null>(null);
  const [prediction, setPrediction] = useState<MoodPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dnaRes, predRes] = await Promise.all([
        api.get<EmotionDnaData>('/api/emotion-dna'),
        api.get<MoodPrediction>('/api/mood-prediction'),
      ]);
      setDna(dnaRes.data);
      setPrediction(predRes.data);
    } catch {
      setError('Could not load your Emotion DNA. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasData = (dna?.totalCheckIns ?? 0) > 0;
  const dominant = dna?.dominantMood ?? null;
  const dominantProfile = dominant ? MOOD_PROFILES[dominant] : null;

  const sortedMoods = useMemo(() => {
    if (!dna) return [];
    return MOODS.map((mood) => ({
      mood,
      pct: dna.percentages[mood] ?? 0,
      recentPct: dna.recentPercentages?.[mood] ?? 0,
      count: dna.moodCounts?.[mood] ?? 0,
    })).sort((a, b) => b.pct - a.pct);
  }, [dna]);

  if (loading && !dna) {
    return <DnaSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-300/80 text-sm mb-1">
              <Dna size={16} />
              Personal profile
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Emotion DNA</h1>
            <p className="text-sm text-white/50 mt-1 max-w-xl">
              Your unique emotional fingerprint — built from every Mood Sync session, journal entry, and check-in.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="self-start p-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-50"
            aria-label="Refresh Emotion DNA"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {error ? (
        <div className="glass rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-red-200">{error}</p>
          <button type="button" onClick={load} className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15">
            Retry
          </button>
        </div>
      ) : null}

      {!hasData && !error ? (
        <div className="glass rounded-2xl border border-white/10 p-8 sm:p-10 text-center">
          <Dna className="mx-auto text-violet-300/60 mb-3" size={36} />
          <h2 className="text-lg font-semibold mb-2">Your DNA is waiting</h2>
          <p className="text-sm text-white/50 max-w-md mx-auto mb-5">
            Log a few moods through Mood Sync or your journal. We&apos;ll map your emotional patterns here automatically.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/mood-sync" className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium inline-flex items-center gap-2">
              <ScanFace size={16} />
              Start Mood Sync
            </Link>
            <Link to="/journal" className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm">
              Write in journal
            </Link>
          </div>
        </div>
      ) : null}

      {hasData && dna && dominant ? (
        <>
          {/* Hero — dominant mood */}
          <section
            className={`glass rounded-2xl border border-white/10 p-6 sm:p-8 overflow-hidden relative bg-gradient-to-br ${dominantProfile?.gradient || 'from-violet-500/20 to-transparent'}`}
          >
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-wider text-white/45 mb-2">Dominant mood</p>
              <div className="flex items-start gap-4">
                <span className="text-5xl sm:text-6xl">{MOOD_EMOJI[dominant]}</span>
                <div className="min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: MOOD_COLORS[dominant] }}>
                    {dominantProfile?.title || formatMoodLabel(dominant)}
                  </h2>
                  <p className="text-sm text-white/55 mt-1">{dominantProfile?.tagline}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full border"
                      style={{
                        background: `${MOOD_COLORS[dominant]}18`,
                        borderColor: `${MOOD_COLORS[dominant]}44`,
                        color: MOOD_COLORS[dominant],
                      }}
                    >
                      {dna.dominantPercentage}% of all check-ins
                    </span>
                    {dna.stability && STABILITY_LABELS[dna.stability] ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
                        {STABILITY_LABELS[dna.stability].label}
                      </span>
                    ) : null}
                    {dna.secondaryMood ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
                        Secondary: {MOOD_EMOJI[dna.secondaryMood]} {formatMoodLabel(dna.secondaryMood)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <p className="text-sm text-white/70 mt-5 leading-relaxed">{dna.insight}</p>
              {dna.lastUpdated ? (
                <p className="text-xs text-white/35 mt-3">Last updated {formatWhen(dna.lastUpdated)}</p>
              ) : null}
            </div>
          </section>

          {/* DNA strip */}
          <section className="glass rounded-xl border border-white/10 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-white/80">Your DNA mix</h3>
              <span className="text-xs text-white/40">{dna.totalCheckIns} total check-ins</span>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden mb-4">
              {sortedMoods
                .filter((row) => row.pct > 0)
                .map((row) => (
                  <div
                    key={row.mood}
                    style={{ width: `${row.pct}%`, background: MOOD_COLORS[row.mood] }}
                    title={`${formatMoodLabel(row.mood)} ${row.pct}%`}
                  />
                ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {MOODS.map((mood) => {
                const pct = dna.percentages[mood] ?? 0;
                if (pct <= 0) return null;
                return (
                  <div key={mood} className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-2xl">{MOOD_EMOJI[mood]}</span>
                    <p className="text-sm font-bold mt-1" style={{ color: MOOD_COLORS[mood] }}>
                      {pct}%
                    </p>
                    <p className="text-[10px] text-white/40">{formatMoodLabel(mood)}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Detailed breakdown */}
          <section className="glass rounded-xl border border-white/10 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white/80">Mood breakdown</h3>
                <p className="text-xs text-white/40 mt-0.5">
                  All-time vs last 14 days ({dna.recentCheckIns} check-ins)
                </p>
              </div>
              <Link to="/analytics" className="text-xs text-violet-300 hover:underline inline-flex items-center gap-1">
                Analytics <ArrowRight size={12} />
              </Link>
            </div>
            <div className="space-y-4">
              {sortedMoods.map((row) => (
                <div key={row.mood}>
                  <div className="flex items-center justify-between text-sm mb-1.5 gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span>{MOOD_EMOJI[row.mood]}</span>
                      <span className="font-medium truncate">
                        {MOOD_PROFILES[row.mood]?.title || formatMoodLabel(row.mood)}
                      </span>
                    </span>
                    <span className="text-white/50 shrink-0 text-xs">
                      {row.count} · {row.pct}%
                      {row.recentPct > 0 && row.recentPct !== row.pct ? (
                        <span className="text-white/30"> · {row.recentPct}% recent</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${row.pct}%`, background: MOOD_COLORS[row.mood] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Wellness tip */}
          {dominantProfile?.wellnessTip ? (
            <section className="glass rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6">
              <p className="text-xs uppercase tracking-wider text-emerald-300/70 mb-2">Wellness tip</p>
              <p className="text-sm text-white/75 leading-relaxed">{dominantProfile.wellnessTip}</p>
              {dominantProfile.musicVibe ? (
                <p className="text-xs text-white/40 mt-3">
                  Music match: {dominantProfile.musicVibe}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Prediction */}
          {prediction ? (
            <section className="glass rounded-xl border border-white/10 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-violet-300" />
                <h3 className="text-sm font-semibold text-white/80">Mood prediction</h3>
              </div>
              <p className="text-sm text-white/60 mb-4">{prediction.insight}</p>

              {prediction.recentPattern.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {prediction.recentPattern.slice(-8).map((mood, i) => (
                    <span
                      key={`${mood}-${i}`}
                      className="text-lg px-2 py-1 rounded-lg bg-white/5 border border-white/10"
                      title={formatMoodLabel(mood)}
                    >
                      {MOOD_EMOJI[mood as Mood] || '•'}
                    </span>
                  ))}
                </div>
              ) : null}

              {prediction.predictedMood ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border"
                    style={{
                      background: `${MOOD_COLORS[prediction.predictedMood]}18`,
                      borderColor: `${MOOD_COLORS[prediction.predictedMood]}44`,
                      color: MOOD_COLORS[prediction.predictedMood],
                    }}
                  >
                    {MOOD_EMOJI[prediction.predictedMood]} Likely next: {formatMoodLabel(prediction.predictedMood)}
                  </span>
                  <span className="text-xs text-white/40">
                    {Math.round(prediction.confidence * 100)}% confidence
                  </span>
                </div>
              ) : (
                <p className="text-xs text-white/40">
                  Log at least 3 moods to unlock predictions.
                </p>
              )}
            </section>
          ) : null}

          {/* Quick links */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              to="/mood-sync"
              className="glass rounded-xl border border-white/10 p-4 hover:border-violet-500/30 transition-colors flex items-center gap-3"
            >
              <ScanFace size={20} className="text-violet-300 shrink-0" />
              <div>
                <p className="text-sm font-medium">Update your DNA</p>
                <p className="text-xs text-white/45">Run a Mood Sync scan</p>
              </div>
            </Link>
            <Link
              to="/analytics"
              className="glass rounded-xl border border-white/10 p-4 hover:border-violet-500/30 transition-colors flex items-center gap-3"
            >
              <BarChart3 size={20} className="text-violet-300 shrink-0" />
              <div>
                <p className="text-sm font-medium">View analytics</p>
                <p className="text-xs text-white/45">Charts, trends & streaks</p>
              </div>
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
