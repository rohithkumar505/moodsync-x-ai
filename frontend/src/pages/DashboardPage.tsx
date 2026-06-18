import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Flame,
  LayoutDashboard,
  ListMusic,
  Music2,
  Play,
  RefreshCw,
  ScanFace,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';
import api, { MOOD_COLORS, MOOD_EMOJI, type Mood } from '../api/client';
import MoodCard from '../components/MoodCard';
import SongCard from '../components/SongCard';
import MoodFrequencyChart from '../components/MoodFrequencyChart';
import MoodTrendLineChart from '../components/MoodTrendLineChart';
import { MOOD_PROFILES } from '../data/moodProfiles';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import type { Song } from '../types/music';

interface DashboardStats {
  totalMoodChecks: number;
  mostFrequentMood: Mood | null;
  streak: number;
  journalCount: number;
  playlistCount: number;
}

interface DashboardData {
  user: { name: string; preferredLanguage?: string };
  currentMood: { mood: Mood; confidence: number; date?: string; source?: string } | null;
  stats: DashboardStats;
  recommendations: Song[];
  prediction: {
    predictedMood: Mood | null;
    insight: string;
    recentPattern: string[];
  };
  emotionDna: {
    percentages: Record<string, number>;
    insight: string;
  };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatMoodLabel(mood: string): string {
  return mood.charAt(0) + mood.slice(1).toLowerCase();
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
      <div className="h-28 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-72 rounded-xl bg-white/5" />
        <div className="h-72 rounded-xl bg-white/5" />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="glass p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-white/45 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1 truncate" style={accent ? { color: accent } : undefined}>
            {value}
          </p>
          {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-purple-300/80" />
        </div>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { to: '/mood-sync', label: 'Mood Sync', hint: 'Scan your face', icon: ScanFace, color: '#a78bfa' },
  { to: '/music', label: 'Music Library', hint: 'Search & play', icon: Music2, color: '#60a5fa' },
  { to: '/journal', label: 'Journal', hint: 'Write today', icon: BookOpen, color: '#34d399' },
  { to: '/analytics', label: 'Analytics', hint: 'Deep insights', icon: BarChart3, color: '#f472b6' },
] as const;

const DEFAULT_STATS: DashboardStats = {
  totalMoodChecks: 0,
  mostFrequentMood: null,
  streak: 0,
  journalCount: 0,
  playlistCount: 0,
};

const DEFAULT_DNA = {
  percentages: {} as Record<string, number>,
  insight: 'Start logging moods to build your Emotion DNA profile.',
};

export default function DashboardPage() {
  const { playSong, playQueue } = useMusicPlayer();
  const [data, setData] = useState<DashboardData | null>(null);
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [frequency, setFrequency] = useState<{ mood: string; count: number }[]>([]);
  const [trend, setTrend] = useState<{ label?: string; date: string; mood: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const dash = await api.get<DashboardData>('/api/dashboard', { timeout: 10000 });
      setData(dash.data);
    } catch {
      setData(null);
      setError('Could not load dashboard. Make sure the backend is running and you are logged in.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setRecsLoading(true);
    try {
      const { data: recData } = await api.get<{ items: Song[] }>('/api/dashboard/recommendations', {
        timeout: 20000,
      });
      setRecommendations(Array.isArray(recData.items) ? recData.items : []);
    } catch {
      setRecommendations([]);
    } finally {
      setRecsLoading(false);
    }
  }, []);

  const loadCharts = useCallback(async () => {
    setChartsLoading(true);
    try {
      const [freq, tr] = await Promise.all([
        api.get('/api/charts/frequency'),
        api.get('/api/charts/trend?days=7'),
      ]);
      setFrequency(Array.isArray(freq.data) ? freq.data : []);
      setTrend(Array.isArray(tr.data) ? tr.data : []);
    } catch {
      setFrequency([]);
      setTrend([]);
    } finally {
      setChartsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadRecommendations();
    loadCharts();
  }, [loadDashboard, loadCharts, loadRecommendations]);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="glass p-12 text-center max-w-lg mx-auto space-y-4">
        <LayoutDashboard size={40} className="mx-auto text-white/25" />
        <p className="text-white/60">{error || 'Something went wrong'}</p>
        <button
          type="button"
          className="glass-btn inline-flex items-center gap-2"
          onClick={() => {
            loadDashboard();
            loadCharts();
            loadRecommendations();
          }}
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  const { user, current, stats, prediction, emotionDna } = {
    user: data.user,
    current: data.currentMood,
    stats: { ...DEFAULT_STATS, ...data.stats },
    prediction: data.prediction,
    emotionDna: data.emotionDna || DEFAULT_DNA,
  };

  const firstName = user?.name?.split(' ')[0] || 'there';
  const topMood = stats.mostFrequentMood as Mood | null;

  return (
    <div className="w-full space-y-5 lg:space-y-8">
      {/* Header */}
      <section className="rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-br from-purple-900/35 via-indigo-900/25 to-slate-900/40 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="hidden lg:flex text-xs uppercase tracking-widest text-purple-300/80 font-semibold mb-1 items-center gap-1.5">
              <LayoutDashboard size={14} />
              Dashboard
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-white/55 mt-1 max-w-md">
              Your mood journey, music picks, and wellness insights — all in one place.
            </p>
          </div>
          <Link
            to="/mood-sync"
            className="glass-btn inline-flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <ScanFace size={18} />
            Scan mood now
          </Link>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map(({ to, label, hint, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="glass p-4 rounded-xl border border-white/10 hover:border-white/25 hover:scale-[1.02] transition-all group"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${color}22`, border: `1px solid ${color}44` }}
            >
              <Icon size={20} style={{ color }} />
            </div>
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-white/45 mt-0.5 flex items-center gap-1">
              {hint}
              <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </Link>
        ))}
      </section>

      {/* Current mood + stats */}
      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {current ? (
            <div className="space-y-2">
              <MoodCard mood={current.mood} confidence={current.confidence} large />
              <p className="text-xs text-white/40 px-1">
                Last check-in {formatRelativeTime(current.date)}
                {current.source ? ` · via ${current.source.replace(/_/g, ' ')}` : ''}
              </p>
              <p className="text-sm text-white/50 px-1">
                {MOOD_PROFILES[current.mood]?.wellnessTip}
              </p>
            </div>
          ) : (
            <div className="glass p-8 rounded-xl border border-dashed border-purple-400/30 text-center space-y-4 h-full flex flex-col items-center justify-center min-h-[180px]">
              <ScanFace size={36} className="text-purple-300/60" />
              <div>
                <p className="font-semibold">No mood logged yet</p>
                <p className="text-sm text-white/50 mt-1">Start with a quick face scan to unlock personalized music.</p>
              </div>
              <Link to="/mood-sync" className="glass-btn text-sm">
                Start Mood Sync
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <StatCard icon={Flame} label="Streak" value={`${stats.streak}d`} sub="Consecutive days" accent="#f59e0b" />
          <StatCard icon={Activity} label="Check-ins" value={stats.totalMoodChecks} sub="Total mood logs" />
          <StatCard icon={BookOpen} label="Journal" value={stats.journalCount} sub="Entries written" />
          <StatCard
            icon={Star}
            label="Top mood"
            value={topMood ? `${MOOD_EMOJI[topMood]} ${formatMoodLabel(topMood)}` : '—'}
            accent={topMood ? MOOD_COLORS[topMood] : undefined}
            sub="Most frequent"
          />
        </div>
      </section>

      {/* Prediction */}
      {prediction?.insight && (
        <section className="glass p-5 sm:p-6 rounded-xl border border-purple-400/20 bg-purple-500/5">
          <div className="flex items-center gap-2 text-purple-300 text-sm font-medium mb-2">
            <TrendingUp size={16} />
            Mood forecast
          </div>
          <p className="text-lg font-medium">{prediction.insight}</p>
          {(prediction.recentPattern?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-xs text-white/40">Recent pattern</span>
              {prediction.recentPattern?.map((m, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/5"
                  style={{ color: MOOD_COLORS[m as Mood] || '#fff' }}
                >
                  {MOOD_EMOJI[m as Mood] || '•'} {formatMoodLabel(m)}
                </span>
              ))}
              {prediction.predictedMood && (
                <>
                  <ArrowRight size={14} className="text-white/30" />
                  <span
                    className="text-sm font-semibold px-3 py-1 rounded-full"
                    style={{
                      background: `${MOOD_COLORS[prediction.predictedMood]}22`,
                      color: MOOD_COLORS[prediction.predictedMood],
                      border: `1px solid ${MOOD_COLORS[prediction.predictedMood]}44`,
                    }}
                  >
                    {MOOD_EMOJI[prediction.predictedMood]} {formatMoodLabel(prediction.predictedMood)}
                  </span>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* Emotion DNA */}
      {emotionDna?.percentages && Object.values(emotionDna.percentages).some((v) => v > 0) && (
        <section className="glass p-5 sm:p-6 rounded-xl">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles size={18} className="text-amber-300" />
                Emotion DNA
              </h2>
              <p className="text-sm text-white/50 mt-1">{emotionDna.insight}</p>
            </div>
            <Link to="/emotion-dna" className="text-xs text-purple-300 hover:underline shrink-0">
              Full profile →
            </Link>
          </div>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-4">
            {Object.entries(emotionDna.percentages)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([mood, pct]) => (
                <div
                  key={mood}
                  style={{ width: `${pct}%`, background: MOOD_COLORS[mood as Mood] }}
                  title={`${formatMoodLabel(mood)} ${pct}%`}
                />
              ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {MOODS_ORDER.map((mood) => {
              const pct = emotionDna.percentages[mood] ?? 0;
              if (pct <= 0) return null;
              return (
                <div key={mood} className="text-center p-2 rounded-lg bg-white/5">
                  <span className="text-xl">{MOOD_EMOJI[mood]}</span>
                  <p className="text-xs font-medium mt-1" style={{ color: MOOD_COLORS[mood] }}>
                    {pct}%
                  </p>
                  <p className="text-[10px] text-white/40">{formatMoodLabel(mood)}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Charts */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Weekly analytics</h2>
            <p className="text-sm text-white/50">How your moods have shifted over the last 7 days</p>
          </div>
          <Link to="/analytics" className="text-xs text-purple-300 hover:underline shrink-0">
            View all →
          </Link>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {chartsLoading ? (
            <>
              <div className="glass h-72 rounded-xl animate-pulse bg-white/5" />
              <div className="glass h-72 rounded-xl animate-pulse bg-white/5" />
            </>
          ) : (
            <>
              <MoodFrequencyChart data={frequency} />
              <MoodTrendLineChart data={trend} />
            </>
          )}
        </div>
      </section>

      {/* Recommendations */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ListMusic size={18} className="text-blue-300" />
              Recommended for you
            </h2>
            <p className="text-sm text-white/50 mt-0.5">
              Songs matched to your current mood & language
            </p>
          </div>
          {recommendations.length > 0 && (
            <button
              type="button"
              className="glass-btn text-sm inline-flex items-center gap-2 shrink-0"
              onClick={() => playQueue(recommendations)}
            >
              <Play size={14} fill="white" />
              Play all
            </button>
          )}
        </div>

        {recsLoading ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[76px] rounded-xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {recommendations.map((song, idx) => (
              <SongCard
                key={`${song.id}-${idx}`}
                song={song}
                onPlay={() => playSong(song)}
                onPlayQueue={() => playQueue(recommendations, idx)}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="glass p-8 text-center rounded-xl border border-dashed border-white/10">
            <Music2 size={32} className="mx-auto text-white/25 mb-2" />
            <p className="text-white/50 text-sm">Log a mood to get personalized song picks.</p>
            <Link to="/mood-sync" className="text-purple-300 text-sm hover:underline mt-2 inline-block">
              Go to Mood Sync
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

const MOODS_ORDER: Mood[] = ['HAPPY', 'SAD', 'ANGRY', 'RELAXED', 'NEUTRAL'];
