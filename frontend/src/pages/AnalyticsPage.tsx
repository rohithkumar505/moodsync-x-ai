import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Calendar,
  Flame,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import api, { MOOD_COLORS, MOOD_EMOJI, type Mood } from '../api/client';
import MoodDistributionChart from '../components/MoodDistributionChart';
import MoodFrequencyChart from '../components/MoodFrequencyChart';
import MoodTrendLineChart, { type TrendPoint } from '../components/MoodTrendLineChart';
import { MOOD_PROFILES } from '../data/moodProfiles';

interface AnalyticsSummary {
  totalMoodChecks: number;
  mostCommonMood: Mood | null;
  mostCommonCount: number;
  mostCommonPercentage: number;
  leastCommonMood: Mood | null;
  currentMood: { mood: Mood; confidence: number; date?: string; source?: string } | null;
  avgConfidence: number | null;
  checkInsThisWeek: number;
  checkInsInPeriod: number;
  streakDays: number;
  trendDays: number;
}

interface DistributionRow {
  mood: string;
  count: number;
  percentage: number;
}

interface FrequencyRow {
  mood: string;
  count: number;
}

interface AnalyticsBundle {
  days: number;
  summary: AnalyticsSummary;
  distribution: DistributionRow[];
  frequency: FrequencyRow[];
  trend: TrendPoint[];
}

const PERIOD_OPTIONS = [7, 14, 30] as const;

function formatMoodLabel(mood: string): string {
  return mood.charAt(0) + mood.slice(1).toLowerCase();
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
      <div className="h-24 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-72 rounded-xl bg-white/5" />
        <div className="h-72 rounded-xl bg-white/5" />
      </div>
      <div className="h-72 rounded-xl bg-white/5" />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="glass rounded-xl border border-white/10 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs text-white/50 uppercase tracking-wide">{label}</p>
        <Icon size={16} className="text-white/30 shrink-0" style={accent ? { color: accent } : undefined} />
      </div>
      <p className="text-2xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sub ? <p className="text-xs text-white/40 mt-1">{sub}</p> : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(14);
  const [data, setData] = useState<AnalyticsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (period: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AnalyticsBundle>(`/api/analytics?days=${period}`);
      setData(res.data);
    } catch {
      setError('Could not load analytics. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const summary = data?.summary;
  const hasData = (summary?.totalMoodChecks ?? 0) > 0;

  const insight = useMemo(() => {
    if (!summary || !hasData) return null;

    const parts: string[] = [];
    if (summary.mostCommonMood) {
      const title = MOOD_PROFILES[summary.mostCommonMood]?.title || formatMoodLabel(summary.mostCommonMood);
      parts.push(
        `${title} is your most frequent mood (${summary.mostCommonPercentage}% of check-ins).`,
      );
    }
    if (summary.streakDays > 1) {
      parts.push(`You're on a ${summary.streakDays}-day check-in streak.`);
    } else if (summary.checkInsThisWeek > 0) {
      parts.push(`${summary.checkInsThisWeek} check-in${summary.checkInsThisWeek === 1 ? '' : 's'} this week.`);
    }
    if (summary.leastCommonMood && summary.leastCommonMood !== summary.mostCommonMood) {
      parts.push(
        `${formatMoodLabel(summary.leastCommonMood)} appears least often in your history.`,
      );
    }
    return parts.join(' ');
  }, [summary, hasData]);

  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto">
        <AnalyticsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-300/80 text-sm mb-1">
              <BarChart3 size={16} />
              Insights
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Analytics</h1>
            <p className="text-sm text-white/50 mt-1 max-w-xl">
              Reliable mood stats from your check-ins, journal entries, and Mood Sync sessions — all in one place.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDays(option)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    days === option
                      ? 'bg-violet-500/30 text-violet-200'
                      : 'bg-white/5 text-white/50 hover:text-white/80'
                  }`}
                >
                  {option}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => load(days)}
              disabled={loading}
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-50"
              aria-label="Refresh analytics"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="glass rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => load(days)}
            className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!hasData && !error ? (
        <div className="glass rounded-2xl border border-white/10 p-8 sm:p-10 text-center">
          <Sparkles className="mx-auto text-violet-300/60 mb-3" size={32} />
          <h2 className="text-lg font-semibold mb-2">No analytics yet</h2>
          <p className="text-sm text-white/50 max-w-md mx-auto mb-5">
            Start with Mood Sync, a journal entry, or a manual check-in. Your charts and insights will appear here automatically.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/mood-sync"
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium"
            >
              Try Mood Sync
            </Link>
            <Link
              to="/journal"
              className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm"
            >
              Write in journal
            </Link>
          </div>
        </div>
      ) : null}

      {hasData && summary ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={Activity}
              label="Total check-ins"
              value={String(summary.totalMoodChecks)}
              sub={`${summary.checkInsInPeriod} in last ${days} days`}
            />
            <StatCard
              icon={Target}
              label="Most common"
              value={
                summary.mostCommonMood
                  ? `${MOOD_EMOJI[summary.mostCommonMood]} ${formatMoodLabel(summary.mostCommonMood)}`
                  : '—'
              }
              sub={
                summary.mostCommonMood
                  ? `${summary.mostCommonCount} times · ${summary.mostCommonPercentage}%`
                  : undefined
              }
              accent={summary.mostCommonMood ? MOOD_COLORS[summary.mostCommonMood] : undefined}
            />
            <StatCard
              icon={Flame}
              label="Streak"
              value={summary.streakDays > 0 ? `${summary.streakDays} day${summary.streakDays === 1 ? '' : 's'}` : '—'}
              sub={summary.checkInsThisWeek > 0 ? `${summary.checkInsThisWeek} this week` : 'Log today to start'}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg confidence"
              value={
                summary.avgConfidence != null
                  ? `${Math.round(summary.avgConfidence * 100)}%`
                  : '—'
              }
              sub={
                summary.leastCommonMood
                  ? `Least: ${formatMoodLabel(summary.leastCommonMood)}`
                  : 'Single mood logged'
              }
            />
          </div>

          {insight ? (
            <div className="glass rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 sm:p-5 flex gap-3">
              <Sparkles size={18} className="text-violet-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-violet-100 mb-0.5">Quick insight</p>
                <p className="text-sm text-white/65">{insight}</p>
              </div>
            </div>
          ) : null}

          {summary.currentMood ? (
            <div
              className="glass rounded-xl border p-4 sm:p-5 flex items-center gap-4"
              style={{ borderColor: `${MOOD_COLORS[summary.currentMood.mood]}44` }}
            >
              <span className="text-4xl">{MOOD_EMOJI[summary.currentMood.mood]}</span>
              <div>
                <p className="text-xs text-white/45 uppercase tracking-wide mb-0.5">Latest mood</p>
                <p className="font-semibold text-lg" style={{ color: MOOD_COLORS[summary.currentMood.mood] }}>
                  {MOOD_PROFILES[summary.currentMood.mood]?.title || formatMoodLabel(summary.currentMood.mood)}
                </p>
                {summary.currentMood.date ? (
                  <p className="text-xs text-white/40 mt-0.5 flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(summary.currentMood.date).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                ) : null}
              </div>
              <Link
                to="/emotion-dna"
                className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 shrink-0"
              >
                Emotion DNA →
              </Link>
            </div>
          ) : null}

          <div className={`grid lg:grid-cols-2 gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <MoodDistributionChart data={data?.distribution ?? []} />
            <MoodFrequencyChart data={data?.frequency ?? []} />
          </div>

          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <MoodTrendLineChart
              data={data?.trend ?? []}
              subtitle={`Daily average mood · last ${days} days (gaps = no check-ins)`}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
