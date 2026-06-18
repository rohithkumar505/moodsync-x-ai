import { useEffect, useRef, useState } from 'react';
import { Film, Loader2, Mic2, Music2, Search, Sparkles, Star, User, X } from 'lucide-react';
import type { SearchSuggestion, SearchType } from '../types/music';
import { LANGUAGES } from '../types/music';

const FILTER_ALL = 'All';

const SEARCH_TYPES: { id: SearchType; label: string; hint: string; icon: typeof Music2 }[] = [
  { id: 'auto', label: 'Everything', hint: 'Movies, singers & songs', icon: Sparkles },
  { id: 'song', label: 'Songs', hint: 'Track name', icon: Music2 },
  { id: 'movie', label: 'Movies', hint: 'Full movie album', icon: Film },
  { id: 'singer', label: 'Singers', hint: 'All artist songs', icon: Mic2 },
  { id: 'hero', label: 'Heroes', hint: 'Actor film songs', icon: User },
  { id: 'new', label: 'New', hint: 'Latest hits', icon: Star },
];

const SEARCH_EXAMPLES = [
  'Pathaan',
  'Arijit Singh',
  'KGF',
  'Shah Rukh Khan',
  'Pushpa',
  'Sid Sriram',
  'Animal',
  'RRR',
];

interface Props {
  query: string;
  language: string;
  searchType: SearchType;
  suggestions: SearchSuggestion[];
  loading: boolean;
  onQueryChange: (q: string) => void;
  onLanguageChange: (lang: string) => void;
  onSearchTypeChange: (type: SearchType) => void;
  onSearch: () => void;
  onApplySuggestion: (s: SearchSuggestion) => void;
  onClear: () => void;
  mobileSticky?: boolean;
}

function suggestIcon(type: string) {
  if (type === 'movie') return <Film size={16} className="text-pink-300" />;
  if (type === 'singer') return <Mic2 size={16} className="text-blue-300" />;
  if (type === 'hero') return <User size={16} className="text-amber-300" />;
  return <Music2 size={16} className="text-purple-300" />;
}

function groupSuggestions(items: SearchSuggestion[]) {
  const order: SearchSuggestion['type'][] = ['song', 'movie', 'singer', 'hero'];
  const labels = { song: 'Songs', movie: 'Movies & albums', singer: 'Singers', hero: 'Heroes / actors' };
  const groups: { key: SearchSuggestion['type']; label: string; items: SearchSuggestion[] }[] = [];
  for (const key of order) {
    const list = items.filter((s) => s.type === key);
    if (list.length) groups.push({ key, label: labels[key], items: list });
  }
  return groups;
}

export default function MusicSearchPanel({
  query,
  language,
  searchType,
  suggestions,
  loading,
  onQueryChange,
  onLanguageChange,
  onSearchTypeChange,
  onSearch,
  onApplySuggestion,
  onClear,
  mobileSticky = false,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [exampleIdx, setExampleIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setExampleIdx((i) => (i + 1) % SEARCH_EXAMPLES.length), 3500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const showDropdown = focused && query.trim().length >= 2 && suggestions.length > 0;
  const groups = groupSuggestions(suggestions);
  const activeType = SEARCH_TYPES.find((t) => t.id === searchType);

  return (
    <div
      className={`rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-br from-purple-900/30 via-indigo-900/20 to-slate-900/40 min-w-0 ${
        mobileSticky ? 'max-lg:sticky max-lg:top-[calc(var(--mobile-header-h)+var(--mobile-safe-top))] max-lg:z-20' : ''
      }`}
    >
      <div className="p-4 sm:p-6 max-lg:p-3.5 space-y-4 sm:space-y-5 max-lg:space-y-3">
        <div className="hidden sm:block">
          <p className="text-xs uppercase tracking-widest text-purple-300/80 font-semibold mb-1">
            Search JioSaavn
          </p>
          <h2 className="text-lg font-bold text-white">Millions of songs, movies & singers</h2>
          <p className="text-sm text-white/50 mt-1">
            Bollywood · Kollywood · Tollywood · Sandalwood · Punjabi & more — type anything
          </p>
        </div>

        <div ref={ref} className="relative">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearch();
              setFocused(false);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                className="w-full pl-10 sm:pl-12 pr-10 py-3 sm:py-3.5 rounded-xl bg-black/35 border border-white/15 text-white placeholder:text-white/35 outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20 transition text-base"
                placeholder={`Search "${SEARCH_EXAMPLES[exampleIdx]}"…`}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onFocus={() => setFocused(true)}
              />
              {query && (
                <button
                  type="button"
                  onClick={onClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10 text-white/50"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="glass-btn px-4 sm:px-6 flex items-center gap-2 shrink-0 disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden z-50 max-h-80 overflow-y-auto border border-white/15 bg-slate-900/95 backdrop-blur-xl shadow-2xl">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="px-4 py-2 text-[10px] uppercase tracking-widest text-white/40 bg-white/5 sticky top-0">
                    {group.label}
                  </p>
                  {group.items.map((s, i) => (
                    <button
                      key={`${group.key}-${s.query}-${i}`}
                      type="button"
                      onClick={() => {
                        onApplySuggestion(s);
                        setFocused(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 text-left border-b border-white/5 last:border-0"
                    >
                      {s.imageUrl ? (
                        <img src={s.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                          {suggestIcon(s.type)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{s.label}</p>
                        <p className="text-xs text-white/50 truncate">{s.subtitle}</p>
                      </div>
                      {suggestIcon(s.type)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wide max-lg:block lg:hidden max-lg:normal-case max-lg:tracking-normal">
            Search type
          </p>
          <p className="text-xs text-white/40 uppercase tracking-wide hidden lg:block">Search in</p>
          <div className="max-lg:grid max-lg:grid-cols-3 max-lg:gap-2 lg:flex lg:flex-wrap lg:gap-2">
            {SEARCH_TYPES.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSearchTypeChange(id)}
                className={`flex flex-col items-start px-3 py-2 rounded-xl border text-left transition min-w-0 w-full max-lg:px-2.5 max-lg:py-2 lg:shrink-0 lg:min-w-[88px] lg:w-auto ${
                  searchType === id
                    ? 'bg-purple-500/25 border-purple-400/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold max-lg:text-[11px] leading-tight">
                  <Icon size={14} className="shrink-0" />
                  <span className="break-words">{label}</span>
                </span>
                <span className="text-[10px] text-white/40 mt-0.5 leading-snug hidden lg:inline">{hint}</span>
              </button>
            ))}
          </div>
          {activeType && (
            <p className="text-xs text-purple-200/70 hidden sm:block">
              Mode: <strong>{activeType.label}</strong> — {activeType.hint}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wide max-lg:block lg:hidden max-lg:normal-case max-lg:tracking-normal">
            Language
          </p>
          <p className="text-xs text-white/40 uppercase tracking-wide hidden lg:block">Language filter</p>
          <div className="max-lg:flex max-lg:flex-wrap max-lg:gap-2 lg:flex lg:flex-wrap lg:gap-2">
            <button
              type="button"
              onClick={() => onLanguageChange(FILTER_ALL)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                language === FILTER_ALL
                  ? 'bg-purple-500/30 border-purple-400/50 text-white'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              All languages
            </button>
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
                className={`text-xs px-3 py-1.5 rounded-full border transition shrink-0 ${
                  language === lang
                    ? 'bg-purple-500/30 border-purple-400/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {!query && (
          <div className="hidden lg:flex flex-wrap gap-2 items-center">
            <span className="text-xs text-white/40">Popular:</span>
            {SEARCH_EXAMPLES.slice(0, 6).map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => onQueryChange(hint)}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/55 hover:bg-purple-500/20 hover:text-white transition"
              >
                {hint}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
