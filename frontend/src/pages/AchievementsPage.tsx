import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame,
  Lock,
  RefreshCw,
  ScanFace,
  Sparkles,
  Target,
  Trophy,
  Unlock,
} from 'lucide-react';
import api, { getApiErrorMessage } from '../api/client';
import {
  normalizeAchievementBundle,
  type AchievementBundle,
  type AchievementItem,
} from '../lib/achievementsApi';

type Filter = 'all' | 'unlocked' | 'locked';

const TIER_STYLES: Record<string, string> = {
  bronze: 'from-amber-700/30 to-orange-600/10 border-amber-500/25',
  silver: 'from-slate-400/20 to-slate-500/10 border-slate-300/25',
  gold: 'from-yellow-500/25 to-amber-400/10 border-yellow-400/35',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function AchievementsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-5xl mx-auto">
      <div className="h-32 rounded-2xl bg-white/5" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ value, className = 'bg-violet-500' }: { value: number; className?: string }) {
  return (
    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${className}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function AchievementCard({ item }: { item: AchievementItem }) {
  const tierStyle = TIER_STYLES[item.tier] || TIER_STYLES.bronze;

  return (
    <article
      className={`rounded-xl border p-5 transition-all ${
        item.unlocked
          ? `glass bg-gradient-to-br ${tierStyle} shadow-lg shadow-violet-900/10 ring-1 ring-white/10`
          : 'glass border-white/10 hover:border-white/20'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${
            item.unlocked ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 grayscale opacity-80'
          }`}
        >
          {item.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">{item.name}</h3>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/15 text-white/50">
              {item.tier}
            </span>
            {item.unlocked ? (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                Unlocked
              </span>
            ) : null}
          </div>
          <p className="text-sm text-white/60 mt-1 leading-relaxed">{item.description}</p>
        </div>
        {item.unlocked ? <Trophy size={18} className="text-yellow-400 shrink-0" /> : <Lock size={16} className="text-white/25 shrink-0 mt-1" />}
      </div>

      {!item.unlocked ? (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-white/50">
            <span>{item.progressLabel}</span>
            <span>{item.percent}%</span>
          </div>
          <ProgressBar value={item.percent} />
          {item.secondaryTarget ? (
            <div className="pt-1">
              <div className="flex justify-between text-xs text-white/45 mb-1">
                <span>
                  {item.secondaryLabel}: {item.secondaryProgress}/{item.secondaryTarget}
                </span>
                <span>{item.secondaryPercent}%</span>
              </div>
              <ProgressBar value={item.secondaryPercent || 0} className="bg-amber-500" />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-emerald-300/90 font-medium">
          Earned {item.unlockedAt ? formatDate(item.unlockedAt) : 'recently'}
        </p>
      )}
    </article>
  );
}

export default function AchievementsPage() {
  const [bundle, setBundle] = useState<AchievementBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/achievements');
      const normalized = normalizeAchievementBundle(data);
      if (!normalized || !normalized.items.length) {
        setError('No achievements data returned. Restart the backend and try again.');
        setBundle(null);
        return;
      }
      setBundle(normalized);
    } catch (err) {
      setBundle(null);
      setError(getApiErrorMessage(err, 'Could not load achievements'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredCategories = useMemo(() => {
    if (!bundle) return [];
    const match = (item: AchievementItem) => {
      if (filter === 'unlocked') return item.unlocked;
      if (filter === 'locked') return !item.unlocked;
      return true;
    };
    return bundle.categories
      .map((cat) => ({ ...cat, items: cat.items.filter(match) }))
      .filter((cat) => cat.items.length > 0);
  }, [bundle, filter]);

  const unlockedItems = useMemo(
    () => bundle?.items.filter((i) => i.unlocked) ?? [],
    [bundle],
  );

  if (loading) return <AchievementsSkeleton />;

  if (error || !bundle) {
    return (
      <div className="max-w-5xl mx-auto glass rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <Trophy size={40} className="mx-auto mb-3 text-red-300/50" />
        <p className="text-red-200 mb-2 font-medium">Achievements could not load</p>
        <p className="text-sm text-red-200/70 mb-5">{error || 'Unknown error'}</p>
        <button type="button" onClick={load} className="glass-btn text-sm inline-flex items-center gap-2">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }

  const { summary } = bundle;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-300/90 text-sm mb-1">
              <Trophy size={16} />
              Milestones & badges
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Achievements</h1>
            <p className="text-sm text-white/55 mt-1 max-w-xl">
              {summary.total} badges to earn from mood check-ins, streaks, journals, playlists, and Mood Sync.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="self-start p-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white"
            aria-label="Refresh achievements"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs text-emerald-200/70 uppercase tracking-wide flex items-center gap-1">
            <Unlock size={12} /> Unlocked
          </p>
          <p className="text-3xl font-bold mt-1 text-emerald-100">
            {summary.unlocked}
            <span className="text-lg font-normal text-white/40"> / {summary.total}</span>
          </p>
          <ProgressBar value={summary.percent} className="bg-emerald-400 mt-3" />
          <p className="text-xs text-white/40 mt-2">{summary.percent}% complete</p>
        </div>
        <div className="glass rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-xs text-orange-200/70 uppercase tracking-wide flex items-center gap-1">
            <Flame size={12} /> Streak
          </p>
          <p className="text-3xl font-bold mt-1">
            {summary.streak}
            <span className="text-lg font-normal text-white/40"> day{summary.streak === 1 ? '' : 's'}</span>
          </p>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/45 uppercase tracking-wide">Check-ins</p>
          <p className="text-3xl font-bold mt-1">{summary.totalCheckIns}</p>
        </div>
        <div className="glass rounded-xl border border-violet-500/25 bg-violet-500/8 p-4">
          <p className="text-xs text-violet-200/80 uppercase tracking-wide flex items-center gap-1">
            <Target size={12} /> Next badge
          </p>
          {summary.nextUp ? (
            <>
              <p className="font-semibold mt-2 truncate text-violet-100">{summary.nextUp.icon} {summary.nextUp.name}</p>
              <p className="text-xs text-white/50 mt-1">{summary.nextUp.progressLabel}</p>
              <ProgressBar value={summary.nextUp.percent} className="bg-violet-400 mt-2" />
            </>
          ) : (
            <p className="text-sm text-emerald-300 mt-3 flex items-center gap-1.5">
              <Sparkles size={14} /> You unlocked everything!
            </p>
          )}
        </div>
      </div>

      {summary.unlocked === 0 ? (
        <div className="glass rounded-xl border border-dashed border-amber-500/25 bg-amber-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-100/90">No badges yet — start here</p>
            <p className="text-sm text-white/55 mt-1">
              Log your first mood with Mood Sync or a manual check-in to unlock First Mood Check.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/mood-sync" className="glass-btn text-sm flex items-center gap-2">
              <ScanFace size={14} /> Mood Sync
            </Link>
            <Link to="/check-in" className="glass-btn text-sm">
              Check in
            </Link>
          </div>
        </div>
      ) : unlockedItems.length > 0 ? (
        <div className="glass rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 sm:p-5">
          <p className="text-sm font-semibold text-yellow-200/90 mb-3 flex items-center gap-2">
            <Trophy size={16} /> Your trophies ({unlockedItems.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unlockedItems.map((item) => (
              <span
                key={item.slug}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-sm"
                title={item.description}
              >
                <span>{item.icon}</span>
                <span className="text-white/85">{item.name}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(['all', 'unlocked', 'locked'] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filter === key
                ? 'bg-violet-500/20 border-violet-400/40 text-violet-100'
                : 'border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            {key === 'all' ? 'All badges' : key === 'unlocked' ? 'Unlocked' : 'In progress'}
          </button>
        ))}
      </div>

      {filteredCategories.length === 0 ? (
        <div className="glass rounded-xl border border-white/10 p-10 text-center text-white/45">
          <p>No badges match this filter.</p>
        </div>
      ) : (
        filteredCategories.map((category) => (
          <section key={category.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">{category.label}</h2>
              <span className="text-xs text-white/35">{category.items.length} badge{category.items.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {category.items.map((item) => (
                <AchievementCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
