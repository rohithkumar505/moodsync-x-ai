import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Dna,
  FileText,
  Flame,
  ListMusic,
  Printer,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import api, { getApiErrorMessage, MOOD_COLORS, MOOD_EMOJI, MOODS, type Mood } from '../api/client';
import MoodDistributionChart from '../components/MoodDistributionChart';
import MoodFrequencyChart from '../components/MoodFrequencyChart';
import MoodTrendLineChart from '../components/MoodTrendLineChart';
import { MOOD_PROFILES } from '../data/moodProfiles';
import { normalizeReportBundle, type ReportBundle } from '../lib/reportsApi';

const PERIOD_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

function formatMoodLabel(mood: string) {
  return mood.charAt(0) + mood.slice(1).toLowerCase();
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
      <div className="h-28 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="h-40 rounded-xl bg-white/5" />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-72 rounded-xl bg-white/5" />
        <div className="h-72 rounded-xl bg-white/5" />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<ReportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (period: number) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/reports', { params: { days: period } });
      const bundle = normalizeReportBundle(data, period);
      if (!bundle) {
        throw new Error('Unexpected report format from server');
      }
      setReport(bundle);
    } catch (err) {
      setReport(null);
      setError(getApiErrorMessage(err, 'Could not generate report'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  if (loading) return <ReportsSkeleton />;

  if (error || !report) {
    return (
      <div className="max-w-6xl mx-auto glass rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <FileText size={36} className="mx-auto mb-3 text-red-300/50" />
        <p className="text-red-200 font-medium mb-2">Report unavailable</p>
        <p className="text-sm text-red-200/70 mb-4">{error}</p>
        <button type="button" onClick={() => load(days)} className="glass-btn text-sm inline-flex items-center gap-2">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }

  const emotionDna = report.emotionDna;
  const dominant = emotionDna.dominantMood;
  const dominantColor = dominant ? MOOD_COLORS[dominant] : '#8b5cf6';
  const profile = dominant ? MOOD_PROFILES[dominant] : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto print:pb-8">
      <header className="glass rounded-2xl border border-white/10 p-5 sm:p-6 print:border-gray-300">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sky-300/80 text-sm mb-1">
              <FileText size={16} />
              Wellness summary
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Your Report</h1>
            <p className="text-sm text-white/50 mt-1">
              {report.user?.name || 'MoodSync user'} · {report.period.label}
            </p>
            <p className="text-xs text-white/35 mt-1">
              Generated {formatWhen(report.generatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setDays(opt.days)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  days === opt.days
                    ? 'bg-violet-500/20 border-violet-400/40 text-violet-100'
                    : 'border-white/10 text-white/50 hover:text-white/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => load(days)}
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white"
              aria-label="Refresh report"
            >
              <RefreshCw size={16} />
            </button>
            <button type="button" onClick={() => window.print()} className="glass-btn text-sm flex items-center gap-2">
              <Printer size={14} /> Print / PDF
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/45 uppercase tracking-wide">Check-ins</p>
          <p className="text-2xl font-bold mt-1">{report.summary.totalMoodChecks}</p>
          <p className="text-xs text-white/40 mt-1">{report.summary.checkInsThisWeek} this week</p>
        </div>
        <div className="glass rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-xs text-orange-200/70 uppercase tracking-wide flex items-center gap-1">
            <Flame size={12} /> Streak
          </p>
          <p className="text-2xl font-bold mt-1">{report.wellness.streakDays}d</p>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/45 uppercase tracking-wide">Top mood</p>
          <p className="text-2xl font-bold mt-1 flex items-center gap-2">
            {report.summary.mostCommonMood ? (
              <>
                <span>{MOOD_EMOJI[report.summary.mostCommonMood]}</span>
                <span className="text-lg">{formatMoodLabel(report.summary.mostCommonMood)}</span>
              </>
            ) : (
              '—'
            )}
          </p>
        </div>
        <div className="glass rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs text-emerald-200/70 uppercase tracking-wide flex items-center gap-1">
            <Trophy size={12} /> Achievements
          </p>
          <p className="text-2xl font-bold mt-1">{report.wellness.achievementsUnlocked}</p>
        </div>
      </div>

      <section className="glass rounded-xl border border-violet-500/20 bg-violet-500/5 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-violet-200/90 uppercase tracking-wide mb-2 flex items-center gap-2">
          <Sparkles size={16} /> Summary
        </h2>
        <p className="text-white/80 leading-relaxed">{report.narrative}</p>
        {report.prediction?.predictedMood ? (
          <p className="text-sm text-white/50 mt-3 flex items-start gap-2">
            <Target size={14} className="shrink-0 mt-0.5 text-violet-300" />
            {report.prediction.insight}
          </p>
        ) : null}
      </section>

      {report.summary.totalMoodChecks === 0 ? (
        <div className="glass rounded-xl border border-dashed border-white/15 p-8 text-center">
          <Calendar size={32} className="mx-auto mb-3 text-white/30" />
          <p className="font-medium text-white/60">No mood data for this period</p>
          <p className="text-sm text-white/45 mt-1 mb-4">Log moods to generate charts and insights here.</p>
          <Link to="/mood-sync" className="glass-btn text-sm inline-flex items-center gap-2 no-print">
            Start Mood Sync
          </Link>
        </div>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-4">
            <MoodDistributionChart data={report.distribution} />
            <MoodFrequencyChart data={report.frequency} />
          </div>

          <MoodTrendLineChart
            data={report.trends}
            title="Mood trend"
            subtitle={`Daily mood score over ${report.period.days} days`}
          />
        </>
      )}

      <section className="glass rounded-xl border border-white/10 p-5 sm:p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Dna size={18} className="text-fuchsia-300" />
          Emotion DNA snapshot
        </h2>
        {dominant ? (
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-white/50 mb-2">Dominant profile</p>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-lg font-semibold"
                style={{
                  color: dominantColor,
                  borderColor: `${dominantColor}44`,
                  background: `${dominantColor}15`,
                }}
              >
                {MOOD_EMOJI[dominant]} {formatMoodLabel(dominant)}
                <span className="text-sm font-normal text-white/50">
                  {emotionDna.dominantPercentage}%
                </span>
              </div>
              <p className="text-sm text-white/60 mt-3 leading-relaxed">{emotionDna.insight}</p>
              {profile?.wellnessTip ? (
                <p className="text-sm text-emerald-300/80 mt-2">Tip: {profile.wellnessTip}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              {MOODS.map((mood) => (
                <div key={mood} className="flex items-center gap-2 text-sm">
                  <span className="w-8">{MOOD_EMOJI[mood]}</span>
                  <span className="w-16 text-white/50">{formatMoodLabel(mood)}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${emotionDna.percentages[mood] || 0}%`,
                        background: MOOD_COLORS[mood],
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-white/40 text-xs">
                    {emotionDna.percentages[mood] || 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-white/50 text-sm">Log moods to build your Emotion DNA profile.</p>
        )}
        <Link to="/emotion-dna" className="text-sm text-violet-300 hover:text-violet-200 mt-4 inline-block no-print">
          View full Emotion DNA →
        </Link>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="glass rounded-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3">Activity</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between py-2 border-b border-white/5">
              <span className="text-white/55">Journal entries</span>
              <span className="font-medium">{report.wellness.journalCount}</span>
            </li>
            <li className="flex justify-between py-2 border-b border-white/5">
              <span className="text-white/55">Playlists</span>
              <span className="font-medium">{report.wellness.playlistCount}</span>
            </li>
            <li className="flex justify-between py-2 border-b border-white/5">
              <span className="text-white/55">Saved songs</span>
              <span className="font-medium">{report.wellness.playlistSongCount}</span>
            </li>
            <li className="flex justify-between py-2">
              <span className="text-white/55">Avg confidence</span>
              <span className="font-medium">
                {report.summary.avgConfidence != null
                  ? `${Math.round(report.summary.avgConfidence * 100)}%`
                  : '—'}
              </span>
            </li>
          </ul>
        </section>

        <section className="glass rounded-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3 flex items-center gap-2">
            <ListMusic size={14} /> Playlists
          </h2>
          {(report.songPreferences?.playlists ?? []).length ? (
            <ul className="space-y-2 text-sm">
              {(report.songPreferences?.playlists ?? []).map((p) => (
                <li key={p.playlistName} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-white/70 truncate pr-2">{p.playlistName}</span>
                  <span className="text-white/40 shrink-0">{p.songCount} songs</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/45">No playlists yet.</p>
          )}
        </section>
      </div>

      {report.achievements.length > 0 ? (
        <section className="glass rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <h2 className="text-sm font-semibold text-yellow-200/90 uppercase tracking-wide mb-3">Recent achievements</h2>
          <div className="flex flex-wrap gap-2">
            {report.achievements.map((a) => (
              <span
                key={`${a.achievementName}-${a.date}`}
                className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-sm"
              >
                🏆 {a.achievementName}
              </span>
            ))}
          </div>
          <Link to="/achievements" className="text-sm text-violet-300 hover:text-violet-200 mt-3 inline-block no-print">
            View all achievements →
          </Link>
        </section>
      ) : null}

      {report.moodHistory.length > 0 ? (
        <section className="glass rounded-xl border border-white/10 p-5 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Recent check-ins</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 border-b border-white/10">
                  <th className="pb-2 font-medium">Mood</th>
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium hidden sm:table-cell">Source</th>
                </tr>
              </thead>
              <tbody>
                {report.moodHistory.map((entry) => {
                  const mood = entry.mood as Mood;
                  return (
                    <tr key={entry.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5">
                        <span style={{ color: MOOD_COLORS[mood] }}>
                          {MOOD_EMOJI[mood]} {formatMoodLabel(entry.mood)}
                        </span>
                      </td>
                      <td className="py-2.5 text-white/55">{formatWhen(entry.date)}</td>
                      <td className="py-2.5 text-white/40 hidden sm:table-cell capitalize">
                        {(entry.source || 'manual').replace(/_/g, ' ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
