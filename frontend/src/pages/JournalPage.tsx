import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  PenLine,
  Sparkles,
  Trophy,
} from 'lucide-react';
import api, { MOOD_COLORS, MOOD_EMOJI, type Mood } from '../api/client';
import MoodSelector from '../components/MoodSelector';
import { MOOD_PROFILES } from '../data/moodProfiles';
import { hintMoodFromText } from '../lib/journalMoodHint';

interface JournalEntry {
  id: string;
  journalText: string;
  detectedMood: Mood;
  date: string;
  confidence: number;
}

interface JournalListResponse {
  items: JournalEntry[];
  total: number;
  page: number;
  pages: number;
}

const PROMPTS = [
  'What made you smile today?',
  'What challenged you today?',
  'Who are you grateful for?',
  'What would make tomorrow better?',
  'How did your body feel today — tense or relaxed?',
  'What song matches your mood right now?',
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatJournalDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function JournalSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

function EntryCard({ entry, expanded, onToggle }: { entry: JournalEntry; expanded: boolean; onToggle: () => void }) {
  const mood = entry.detectedMood;
  const preview = entry.journalText.length > 140 && !expanded
    ? `${entry.journalText.slice(0, 140)}…`
    : entry.journalText;

  return (
    <article
      className="glass rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-colors"
      style={{ borderLeftColor: `${MOOD_COLORS[mood]}66`, borderLeftWidth: 3 }}
    >
      <button type="button" onClick={onToggle} className="w-full text-left p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">{MOOD_EMOJI[mood]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-semibold" style={{ color: MOOD_COLORS[mood] }}>
                {MOOD_PROFILES[mood]?.title || mood}
              </span>
              <span className="text-xs text-white/40">· {formatJournalDate(entry.date)}</span>
              <span className="text-xs text-white/35">{Math.round(entry.confidence * 100)}% match</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{preview}</p>
          </div>
          {entry.journalText.length > 140 && (
            <span className="text-white/30 shrink-0 mt-1">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          )}
        </div>
      </button>
    </article>
  );
}

export default function JournalPage() {
  const [text, setText] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [entryDate, setEntryDate] = useState(todayIso());
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ mood: Mood; achievements: string[] } | null>(null);
  const [error, setError] = useState('');

  const hint = useMemo(() => (mood ? null : hintMoodFromText(text)), [text, mood]);
  const words = wordCount(text);
  const chars = text.length;

  const loadEntries = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get<JournalListResponse>('/api/journals', { params: { page: 1 } });
      setEntries(data.items || []);
    } catch {
      setEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const prefillForDate = useCallback(
    (date: string) => {
      const forDate = entries.find((e) => e.date.startsWith(date));
      if (forDate) {
        setText(forDate.journalText);
        setMood(forDate.detectedMood);
      } else {
        setText('');
        setMood(null);
      }
    },
    [entries]
  );

  useEffect(() => {
    if (entries.length) prefillForDate(entryDate);
  }, [entries]); // prefill when history first loads

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const payload: Record<string, string> = {
        journalText: text.trim(),
        date: entryDate,
      };
      if (mood) payload.detectedMood = mood;

      const { data } = await api.post<{
        journal: JournalEntry;
        newAchievements?: string[];
      }>('/api/journals', payload);

      setSuccess({
        mood: data.journal.detectedMood,
        achievements: data.newAchievements || [],
      });
      await loadEntries();
    } catch {
      setError('Could not save your journal. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const applyPrompt = (prompt: string) => {
    setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${prompt}\n` : `${prompt}\n`));
  };

  const startFresh = () => {
    setText('');
    setMood(null);
    setEntryDate(todayIso());
    setSuccess(null);
    setError('');
  };

  return (
    <div className="w-full space-y-5 lg:space-y-8">
      {/* Header */}
      <section className="rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-slate-900/40 p-4 sm:p-6 lg:p-8">
        <p className="hidden lg:flex text-xs uppercase tracking-widest text-emerald-300/80 font-semibold mb-1 items-center gap-1.5">
          <BookOpen size={14} />
          Daily journal
        </p>
        <h1 className="hidden lg:block text-3xl font-bold">Write your day</h1>
        <p className="text-sm lg:text-base text-white/55 mt-0 lg:mt-1 max-w-xl">
          Reflect freely — we detect your mood from your words and log it to your wellness timeline.
        </p>
      </section>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Write */}
        <div className="lg:col-span-3 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="glass rounded-xl border border-white/10 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                  <PenLine size={16} className="text-emerald-300" />
                  Your entry
                </label>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-white/40" />
                  <input
                    type="date"
                    value={entryDate}
                    max={todayIso()}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setEntryDate(newDate);
                      setSuccess(null);
                      prefillForDate(newDate);
                    }}
                    className="glass-input py-1.5 px-3 text-sm w-auto"
                  />
                </div>
              </div>

              <textarea
                className="glass-input min-h-[220px] resize-y w-full text-base leading-relaxed"
                placeholder="What’s on your mind? Write about your day, feelings, wins, worries — no filter needed…"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setSuccess(null);
                }}
                required
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
                <span>{words} words · {chars} characters</span>
                {hint && !mood && (
                  <span className="flex items-center gap-1.5 text-purple-300/90">
                    <Sparkles size={12} />
                    Likely mood: {MOOD_EMOJI[hint.mood]} {hint.mood.toLowerCase()}
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs text-white/45 uppercase tracking-wide mb-2">Need a starting point?</p>
                <div className="flex flex-wrap gap-2">
                  {PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => applyPrompt(prompt)}
                      className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/55 hover:bg-emerald-500/15 hover:text-white hover:border-emerald-400/30 transition"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMoodPicker((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm text-white/60 hover:bg-white/5"
              >
                <span>Set mood manually (optional)</span>
                {showMoodPicker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showMoodPicker && (
                <div className="px-5 pb-5 border-t border-white/10 pt-4">
                  <p className="text-xs text-white/45 mb-3">
                    Override AI detection if you know how you feel
                  </p>
                  <MoodSelector
                    selected={mood}
                    onSelect={(m) => setMood((prev) => (prev === m ? null : m))}
                  />
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-300 px-1">{error}</p>
            )}

            {success && (
              <div
                className="rounded-xl border p-4 flex items-start gap-3"
                style={{
                  background: `${MOOD_COLORS[success.mood]}12`,
                  borderColor: `${MOOD_COLORS[success.mood]}44`,
                }}
              >
                <span className="text-3xl">{MOOD_EMOJI[success.mood]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ color: MOOD_COLORS[success.mood] }}>
                    Journal saved — {MOOD_PROFILES[success.mood]?.title || success.mood}
                  </p>
                  <p className="text-sm text-white/55 mt-0.5">
                    {MOOD_PROFILES[success.mood]?.wellnessTip}
                  </p>
                  {success.achievements.length > 0 && (
                    <p className="text-sm text-amber-300/90 mt-2 flex items-center gap-1.5">
                      <Trophy size={14} />
                      {success.achievements.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button type="submit" className="glass-btn flex-1 flex items-center justify-center gap-2" disabled={loading || !text.trim()}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <PenLine size={18} />}
                {loading ? 'Saving…' : 'Save journal'}
              </button>
              {text && (
                <button type="button" onClick={startFresh} className="px-5 py-2.5 rounded-xl border border-white/15 text-sm text-white/60 hover:bg-white/10">
                  Clear
                </button>
              )}
            </div>
          </form>

          <p className="text-xs text-white/35 text-center">
            Prefer face detection?{' '}
            <Link to="/mood-sync" className="text-purple-300 hover:underline">
              Try Mood Sync
            </Link>
          </p>
        </div>

        {/* History */}
        <aside className="lg:col-span-2 space-y-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Past entries</h2>
              <p className="text-sm text-white/45">{entries.length} journal{entries.length !== 1 ? 's' : ''}</p>
            </div>
            <Link to="/history" className="text-xs text-purple-300 hover:underline shrink-0">
              Full history →
            </Link>
          </div>

          {historyLoading ? (
            <JournalSkeleton />
          ) : entries.length === 0 ? (
            <div className="glass p-8 rounded-xl border border-dashed border-white/10 text-center space-y-2">
              <BookOpen size={32} className="mx-auto text-white/20" />
              <p className="text-white/50 text-sm">No entries yet</p>
              <p className="text-xs text-white/35">Your saved journals will appear here</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onToggle={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
