import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Filter,
  History,
  PenLine,
  RefreshCw,
  ScanFace,
} from 'lucide-react';
import api, { MOOD_COLORS, MOOD_EMOJI, MOODS, type Mood } from '../api/client';
import { MOOD_PROFILES } from '../data/moodProfiles';

interface MoodEntry {
  id: string;
  mood: Mood;
  confidence: number;
  date: string;
  source?: string;
  journalText?: string;
  imagePath?: string;
}

interface MoodListResponse {
  items: MoodEntry[];
  total: number;
  page: number;
  pages: number;
}

const FILTER_ALL = 'All';

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Camera }> = {
  face_camera_live: { label: 'Mood Sync', icon: ScanFace },
  face_camera: { label: 'Mood Sync', icon: ScanFace },
  face_vision: { label: 'Face scan', icon: Camera },
  journal: { label: 'Journal', icon: PenLine },
  manual: { label: 'Manual', icon: PenLine },
  ai: { label: 'AI check-in', icon: PenLine },
};

function formatMoodLabel(mood: string): string {
  return mood.charAt(0) + mood.slice(1).toLowerCase();
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  }) + ` · ${time}`;
}

function groupKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function sourceMeta(source?: string) {
  if (!source) return { label: 'Check-in', icon: History };
  return SOURCE_LABELS[source] || { label: source.replace(/_/g, ' '), icon: History };
}

function HistorySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

function HistoryCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: MoodEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const mood = entry.mood;
  const { label: sourceLabel, icon: SourceIcon } = sourceMeta(entry.source);
  const hasJournal = Boolean(entry.journalText?.trim());
  const journalPreview =
    hasJournal && entry.journalText!.length > 160 && !expanded
      ? `${entry.journalText!.slice(0, 160)}…`
      : entry.journalText;

  return (
    <article
      className="glass rounded-xl border border-white/10 hover:border-white/20 transition-colors overflow-hidden"
      style={{ borderLeftColor: `${MOOD_COLORS[mood]}66`, borderLeftWidth: 3 }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0">{MOOD_EMOJI[mood]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-semibold" style={{ color: MOOD_COLORS[mood] }}>
                {MOOD_PROFILES[mood]?.title || formatMoodLabel(mood)}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 flex items-center gap-1">
                <SourceIcon size={11} />
                {sourceLabel}
              </span>
            </div>
            <p className="text-xs text-white/45">{formatWhen(entry.date)}</p>
            {hasJournal && (
              <div className="mt-3">
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{journalPreview}</p>
                {entry.journalText!.length > 160 && (
                  <button
                    type="button"
                    onClick={onToggle}
                    className="text-xs text-purple-300 hover:underline mt-1.5 flex items-center gap-1"
                  >
                    {expanded ? (
                      <>
                        <ChevronUp size={14} /> Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} /> Read more
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold" style={{ color: MOOD_COLORS[mood] }}>
              {Math.round(entry.confidence * 100)}%
            </p>
            <p className="text-[10px] text-white/35 uppercase tracking-wide">confidence</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HistoryPage() {
  const [items, setItems] = useState<MoodEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [moodFilter, setMoodFilter] = useState<string>(FILTER_ALL);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');

    try {
      const { data } = await api.get<MoodListResponse>('/api/moods', { params: { page: pageNum } });
      const list = data.items || [];
      setItems((prev) => (append ? [...prev, ...list] : list));
      setPage(data.page || pageNum);
      setPages(data.pages || 1);
      setTotal(data.total || list.length);
    } catch {
      if (!append) {
        setItems([]);
        setError('Could not load mood history. Make sure you are logged in and the backend is running.');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(1, false);
  }, [loadHistory]);

  const filtered = useMemo(() => {
    if (moodFilter === FILTER_ALL) return items;
    return items.filter((e) => e.mood === moodFilter);
  }, [items, moodFilter]);

  const moodCounts = useMemo(() => {
    const counts: Partial<Record<Mood, number>> = {};
    for (const e of items) counts[e.mood] = (counts[e.mood] || 0) + 1;
    return counts;
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, MoodEntry[]>();
    for (const entry of filtered) {
      const key = groupKey(entry.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const hasMore = page < pages;

  return (
    <div className="w-full space-y-5 lg:space-y-8">
      {/* Header */}
      <section className="rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-br from-indigo-900/35 via-violet-900/25 to-slate-900/40 p-4 sm:p-6 lg:p-8">
        <p className="hidden lg:flex text-xs uppercase tracking-widest text-indigo-300/80 font-semibold mb-1 items-center gap-1.5">
          <History size={14} />
          Timeline
        </p>
        <h1 className="hidden lg:block text-3xl font-bold">Mood history</h1>
        <p className="text-sm lg:text-base text-white/55 mt-0 lg:mt-1 max-w-lg">
          Every check-in from Mood Sync, journal entries, and manual logs — your full emotional timeline.
        </p>
      </section>

      {/* Stats */}
      {!loading && !error && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass p-4 rounded-xl border border-white/10">
            <p className="text-xs text-white/45 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold mt-1">{total}</p>
            <p className="text-[11px] text-white/35">check-ins</p>
          </div>
          {MOODS.filter((m) => moodCounts[m]).slice(0, 3).map((m) => (
            <div
              key={m}
              className="glass p-4 rounded-xl border border-white/10"
              style={{ borderColor: `${MOOD_COLORS[m]}33` }}
            >
              <p className="text-xs text-white/45 uppercase tracking-wide flex items-center gap-1">
                {MOOD_EMOJI[m]} {formatMoodLabel(m)}
              </p>
              <p className="text-2xl font-bold mt-1" style={{ color: MOOD_COLORS[m] }}>
                {moodCounts[m]}
              </p>
              <p className="text-[11px] text-white/35">entries</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <p className="text-xs text-white/45 uppercase tracking-wide flex items-center gap-1.5">
          <Filter size={12} />
          Filter by mood
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMoodFilter(FILTER_ALL)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              moodFilter === FILTER_ALL
                ? 'bg-purple-500/30 border-purple-400/50 text-white'
                : 'bg-white/5 border-white/10 text-white/55 hover:bg-white/10'
            }`}
          >
            All ({items.length})
          </button>
          {MOODS.map((m) => {
            const count = moodCounts[m] || 0;
            if (!count && moodFilter !== m) return null;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMoodFilter(m)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  moodFilter === m
                    ? 'bg-purple-500/30 border-purple-400/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/55 hover:bg-white/10'
                }`}
              >
                {MOOD_EMOJI[m]} {formatMoodLabel(m)} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <HistorySkeleton />
      ) : error ? (
        <div className="glass p-12 text-center space-y-4 rounded-xl">
          <History size={40} className="mx-auto text-white/20" />
          <p className="text-white/55">{error}</p>
          <button type="button" className="glass-btn inline-flex items-center gap-2" onClick={() => loadHistory(1)}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-12 text-center rounded-xl border border-dashed border-white/10 space-y-4">
          <ScanFace size={40} className="mx-auto text-white/20" />
          <div>
            <p className="font-medium text-white/70">No mood history yet</p>
            <p className="text-sm text-white/45 mt-1">
              {moodFilter !== FILTER_ALL
                ? `No ${formatMoodLabel(moodFilter)} entries — try another filter`
                : 'Start with a face scan or write in your journal'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/mood-sync" className="glass-btn text-sm inline-flex items-center gap-2">
              <ScanFace size={16} />
              Mood Sync
            </Link>
            <Link to="/journal" className="px-4 py-2.5 rounded-xl border border-white/15 text-sm text-white/70 hover:bg-white/10">
              Write journal
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([day, entries]) => (
            <section key={day} className="space-y-3">
              <h2 className="text-sm font-semibold text-white/50 sticky top-0 py-2 bg-[#0f0a1a]/80 backdrop-blur-sm z-10">
                {day}
              </h2>
              <div className="space-y-3">
                {entries.map((entry) => (
                  <HistoryCard
                    key={entry.id}
                    entry={entry}
                    expanded={expandedId === entry.id}
                    onToggle={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
                  />
                ))}
              </div>
            </section>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                className="glass-btn px-8"
                disabled={loadingMore}
                onClick={() => loadHistory(page + 1, true)}
              >
                {loadingMore ? 'Loading…' : `Load more (${items.length} of ${total})`}
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-center text-xs text-white/35">
          <Link to="/analytics" className="text-purple-300 hover:underline">
            View charts & analytics →
          </Link>
        </p>
      )}
    </div>
  );
}
