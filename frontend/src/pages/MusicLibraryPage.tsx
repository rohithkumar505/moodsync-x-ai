import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Mic2,
  Music2,
  Sparkles,
  X,
  Shuffle,
  Play,
} from 'lucide-react';
import { musicApi, MOOD_COLORS, MOOD_EMOJI, MOODS, type Mood } from '../api/client';
import SongCard from '../components/SongCard';
import MusicSearchPanel from '../components/MusicSearchPanel';
import { MOOD_PROFILES } from '../data/moodProfiles';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { prefetchSongAudio } from '../lib/audioResolve';
import {
  getLibraryCache,
  isLibraryCacheFresh,
  libraryCacheKey,
  peekStaleLibraryCache,
  setLibraryCache,
} from '../lib/musicLibraryCache';
import {
  type SearchSuggestion,
  type SearchType,
  type Song,
  type SongSearchResult,
} from '../types/music';

const FILTER_ALL = 'All';

interface MoodSyncNavState {
  mood: Mood;
  title: string;
  confidence: number;
  songCount: number;
  language: string;
}

const FEATURED_ARTISTS = [
  { name: 'Arijit Singh', lang: 'Hindi' },
  { name: 'Jubin Nautiyal', lang: 'Hindi' },
  { name: 'Atif Aslam', lang: 'Hindi' },
  { name: 'Armaan Malik', lang: 'Hindi' },
  { name: 'Sanjith Hegde', lang: 'Kannada' },
  { name: 'Sid Sriram', lang: 'Kannada' },
  { name: 'Shreya Ghoshal', lang: 'Hindi' },
  { name: 'Vijay Prakash', lang: 'Kannada' },
];

const MOOD_PLAYBACK_HINT: Record<Mood, string> = {
  HAPPY: 'Upbeat feel-good hits',
  SAD: 'Happy songs to lift you up',
  ANGRY: 'Calm songs to relax you',
  RELAXED: 'Soft peaceful melodies',
  NEUTRAL: 'Popular chart toppers',
};

function SongGridSkeleton({ mobileList = false }: { mobileList?: boolean }) {
  if (mobileList) {
    return (
      <div className="music-mobile-song-list">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5">
            <div className="w-12 h-12 rounded-lg bg-white/5 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 bg-white/10 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[76px] rounded-xl bg-white/5 animate-pulse border border-white/5" />
      ))}
    </div>
  );
}

export default function MusicLibraryPage() {
  const location = useLocation();
  const { playSong, playQueue, current } = useMusicPlayer();
  const [moodSyncBanner, setMoodSyncBanner] = useState<MoodSyncNavState | null>(null);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<string>(FILTER_ALL);
  const [mood, setMood] = useState<string>(FILTER_ALL);
  const [searchType, setSearchType] = useState<SearchType>('auto');
  const [result, setResult] = useState<SongSearchResult>({
    items: [],
    total: 0,
    page: 1,
    pages: 0,
  });
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const fetchSeqRef = useRef(0);

  const langParam = language !== FILTER_ALL ? language : undefined;

  const fetchSongs = useCallback(
    async (pageNum = 1, append = false) => {
      const requestId = ++fetchSeqRef.current;
      const cacheKey = libraryCacheKey({
        query: query.trim(),
        language: langParam || 'all',
        mood,
        searchType,
        page: pageNum,
        append: append ? 1 : 0,
      });

      const cached = !append ? getLibraryCache(cacheKey) : null;
      const stale = !append && !cached ? peekStaleLibraryCache(cacheKey) : null;

      if (cached && !append) {
        setResult(cached);
        setPage(pageNum);
        setHasMore(Boolean(cached.hasMore));
        setLoading(false);
        setLoadError('');
        if (isLibraryCacheFresh(cacheKey)) {
          return;
        }
        setRefreshing(true);
      } else if (stale && !append) {
        setResult(stale);
        setLoading(false);
        setRefreshing(true);
        setLoadError('');
      } else if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setLoadError('');
      }

      try {
        if (searchType === 'new' && !query.trim()) {
          const { data } = await musicApi.get<SongSearchResult>('/api/music/new', {
            params: { language: langParam, limit: 36 },
          });
          if (requestId !== fetchSeqRef.current) return;
          const next = {
            items: data.items || [],
            total: data.total || 0,
            page: 1,
            pages: 1,
            hasMore: false,
            searchType: 'new' as const,
            title: data.title || 'New & trending',
            subtitle: data.subtitle || 'Latest releases',
          };
          setResult(next);
          setLibraryCache(cacheKey, next);
          setPage(1);
          setHasMore(false);
          return;
        }

        if (mood !== FILTER_ALL && !query.trim() && searchType === 'auto') {
          const { data } = await musicApi.get<{ songs: Song[]; mood: string; total: number }>(
            '/api/songs/mood-playlist',
            { params: { mood, language: langParam || 'Hindi', limit: 20 } }
          );
          if (requestId !== fetchSeqRef.current) return;
          const profile = MOOD_PROFILES[mood as Mood];
          const next = {
            items: data.songs || [],
            total: data.total || 0,
            page: 1,
            pages: 1,
            hasMore: false,
            searchType: 'auto' as const,
            title: `${MOOD_EMOJI[mood as Mood]} ${profile?.title || mood} playlist`,
            subtitle: MOOD_PLAYBACK_HINT[mood as Mood] || `${data.total} mood-matched songs`,
          };
          setResult(next);
          setLibraryCache(cacheKey, next);
          setPage(1);
          setHasMore(false);
          return;
        }

        const params: Record<string, string | number> = {
          per_page: 36,
          page: pageNum,
          type: searchType,
        };
        if (query.trim()) params.q = query.trim();
        if (langParam) params.language = langParam;
        if (mood !== FILTER_ALL) params.mood = mood;

        const { data } = await musicApi.get<SongSearchResult>('/api/songs', { params });
        if (requestId !== fetchSeqRef.current) return;

        if (append) {
          setResult((prev) => ({
            ...data,
            items: [...prev.items, ...(data.items || [])],
          }));
        } else {
          const next: SongSearchResult = {
            ...data,
            items: data.items || [],
          };
          setResult(next);
          setLibraryCache(cacheKey, next);
        }
        setPage(pageNum);
        setHasMore(Boolean(data.hasMore));

        if (!append && !(data.items || []).length) {
          setLoadError('Taking longer than usual — tap retry or try a singer name.');
        }
      } catch {
        if (requestId !== fetchSeqRef.current) return;
        setLoadError('Could not load songs right now. Please try again.');
        if (!append) {
          setResult((prev) =>
            prev.items.length ? prev : { items: [], total: 0, page: 1, pages: 0, hasMore: false },
          );
        }
      } finally {
        if (requestId === fetchSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [query, language, mood, searchType, langParam]
  );

  const fetchSuggestions = useCallback(
    async (text: string) => {
      if (text.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const params: Record<string, string> = { q: text.trim() };
        if (langParam) params.language = langParam;
        const { data } = await musicApi.get<SearchSuggestion[]>('/api/music/suggest', { params });
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      }
    },
    [langParam]
  );

  useEffect(() => {
    result.items.slice(0, 4).forEach((song) => prefetchSongAudio(song));
  }, [result.items]);

  useEffect(() => {
    setPage(1);
    const delay = query ? 400 : 0;
    const timer = setTimeout(() => fetchSongs(1, false), delay);
    return () => clearTimeout(timer);
  }, [fetchSongs, query, language, mood, searchType]);

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(query), 250);
    return () => clearTimeout(timer);
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const nav = location.state as { moodSync?: MoodSyncNavState } | null;
    if (nav?.moodSync) {
      setMoodSyncBanner(nav.moodSync);
      setMood(nav.moodSync.mood);
      if (nav.moodSync.language) setLanguage(nav.moodSync.language);
    }
  }, [location.state]);

  useEffect(() => {
    if (!moodSyncBanner) return;
    const t = setTimeout(() => setMoodSyncBanner(null), 12000);
    return () => clearTimeout(t);
  }, [moodSyncBanner]);

  const applySuggestion = (s: SearchSuggestion) => {
    const typeMap: Record<string, SearchType> = {
      movie: 'movie',
      singer: 'singer',
      song: 'song',
      hero: 'hero',
    };
    setSearchType(typeMap[s.type] || 'auto');
    setQuery(s.query);
  };

  const runSearch = () => fetchSongs(1, false);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchSongs(page + 1, true);
  };

  const browseMood = (m: Mood) => {
    setMood(m);
    setQuery('');
    setSearchType('auto');
  };

  const browseArtist = (name: string, lang?: string) => {
    setQuery(name);
    setSearchType('singer');
    if (lang) setLanguage(lang);
  };

  const playAll = () => {
    if (result.items.length) playQueue(result.items);
  };

  const shufflePlay = () => {
    if (!result.items.length) return;
    const shuffled = [...result.items].sort(() => Math.random() - 0.5);
    playQueue(shuffled);
  };

  const clearSearch = () => {
    setQuery('');
    setPage(1);
  };

  const showBrowseHome = !query && mood === FILTER_ALL && searchType === 'auto';

  return (
    <div className="flex flex-col gap-5 lg:gap-8 w-full min-w-0 music-library-mobile max-lg:gap-4">
      {moodSyncBanner && (
        <div
          className="glass p-3 sm:p-4 max-lg:p-3 flex items-start gap-3 sm:gap-4 border min-w-0"
          style={{ borderColor: `${MOOD_COLORS[moodSyncBanner.mood]}44` }}
        >
          <span className="text-4xl shrink-0">{MOOD_EMOJI[moodSyncBanner.mood]}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold break-words leading-snug" style={{ color: MOOD_COLORS[moodSyncBanner.mood] }}>
              {moodSyncBanner.title} — from Mood Sync
            </p>
            <p className="text-sm text-white/60 mt-1 max-lg:text-xs max-lg:leading-relaxed break-words">
              {moodSyncBanner.songCount > 0
                ? `${moodSyncBanner.songCount} songs queued`
                : `Curated ${moodSyncBanner.language} tracks`}
              {current ? ` · Now: ${current.songName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMoodSyncBanner(null)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="hidden lg:flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-300 text-sm font-medium mb-1">
            <Music2 size={16} />
            Stream full Bollywood & Kannada songs
          </div>
          <h1 className="text-3xl font-bold">Music Library</h1>
          <p className="text-white/55 mt-1 max-w-lg">
            Full JioSaavn catalog — search any movie, singer, hero, or song worldwide in Indian music.
          </p>
        </div>
        {result.items.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <button type="button" className="glass-btn flex items-center gap-2" onClick={playAll}>
              <Play size={16} fill="white" />
              Play all
            </button>
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-white/15 text-sm hover:bg-white/10 flex items-center gap-2"
              onClick={shufflePlay}
            >
              <Shuffle size={16} />
              Shuffle
            </button>
          </div>
        )}
      </div>

      {result.items.length > 0 ? (
        <div className="flex gap-2 lg:hidden">
          <button type="button" className="glass-btn flex-1 flex items-center justify-center gap-2 py-2.5 text-sm" onClick={playAll}>
            <Play size={15} fill="white" />
            Play all
          </button>
          <button
            type="button"
            className="flex-1 px-3 py-2.5 rounded-xl border border-white/15 text-sm hover:bg-white/10 flex items-center justify-center gap-2"
            onClick={shufflePlay}
          >
            <Shuffle size={15} />
            Shuffle
          </button>
        </div>
      ) : null}

      <MusicSearchPanel
        query={query}
        language={language}
        searchType={searchType}
        suggestions={suggestions}
        loading={loading}
        onQueryChange={setQuery}
        onLanguageChange={setLanguage}
        onSearchTypeChange={setSearchType}
        onSearch={runSearch}
        onApplySuggestion={applySuggestion}
        onClear={clearSearch}
      />

      {mood !== FILTER_ALL && (
        <div
          className="flex items-center justify-between gap-3 px-3 sm:px-4 max-lg:px-3 py-3 rounded-xl border max-lg:flex-col max-lg:items-stretch max-lg:gap-2.5 min-w-0"
          style={{
            background: `${MOOD_COLORS[mood as Mood]}12`,
            borderColor: `${MOOD_COLORS[mood as Mood]}44`,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{MOOD_EMOJI[mood as Mood]}</span>
            <div className="min-w-0">
              <p className="font-semibold break-words leading-snug" style={{ color: MOOD_COLORS[mood as Mood] }}>
                {MOOD_PROFILES[mood as Mood]?.title || mood} playlist
              </p>
              <p className="text-xs text-white/50 max-lg:leading-relaxed break-words">{MOOD_PLAYBACK_HINT[mood as Mood]}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMood(FILTER_ALL)}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/60 hover:bg-white/10 max-lg:self-start"
          >
            Clear mood
          </button>
        </div>
      )}

      {loading && result.items.length === 0 ? (
        <div className="space-y-4">
          <div className="h-6 w-48 bg-white/10 rounded animate-pulse max-lg:h-5 max-lg:w-36" />
          <div className="lg:hidden">
            <SongGridSkeleton mobileList />
          </div>
          <div className="hidden lg:block">
            <SongGridSkeleton />
          </div>
        </div>
      ) : result.items.length === 0 ? (
        <div className="glass p-8 sm:p-12 max-lg:p-6 text-center space-y-3 min-w-0">
          <Music2 size={40} className="mx-auto text-white/25 max-lg:w-9 max-lg:h-9" />
          <p className="text-white/60 max-lg:text-sm max-lg:leading-relaxed break-words">{loadError || 'No songs found'}</p>
          {loadError ? (
            <button
              type="button"
              onClick={() => fetchSongs(1, false)}
              className="glass-btn px-6"
            >
              Retry loading songs
            </button>
          ) : (
            <>
              <p className="text-sm text-white/40 max-lg:leading-relaxed lg:hidden">
                Search a singer, movie, or pick a mood playlist below.
              </p>
              <p className="text-sm text-white/40 hidden lg:block">
                Try <button type="button" className="text-purple-300 hover:underline" onClick={() => browseArtist('Arijit Singh')}>Arijit Singh</button>
                {', '}
                <button type="button" className="text-purple-300 hover:underline" onClick={() => setQuery('Pathaan')}>Pathaan</button>
                {', or pick a '}
                <button type="button" className="text-purple-300 hover:underline" onClick={() => browseMood('HAPPY')}>mood playlist</button>
              </p>
            </>
          )}
        </div>
      ) : (
        <section className={`space-y-3 sm:space-y-4 music-library-results transition-opacity duration-300 min-w-0 ${refreshing ? 'opacity-75' : 'opacity-100'}`}>
          <div className="flex items-end justify-between gap-4 max-lg:gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold max-lg:text-lg break-words">{result.title || 'Songs'}</h2>
              <p className="text-sm text-white/50 mt-0.5 max-lg:text-xs max-lg:leading-relaxed break-words">
                {result.subtitle || `${result.total} full tracks`}
                {langParam ? ` · ${langParam}` : ''}
                {refreshing ? ' · updating…' : ''}
              </p>
              {loadError ? (
                <p className="text-xs text-amber-300/80 mt-1">{loadError}</p>
              ) : null}
            </div>
            <span className="text-xs text-white/35 shrink-0">{result.items.length} songs</span>
          </div>

          <div className="lg:hidden music-mobile-song-list music-grid-fade">
            {result.items.map((song, idx) => (
              <div key={`${song.id}-${idx}-m`} className="music-grid-item" style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}>
                <SongCard
                  song={song}
                  mobileList
                  isPlaying={current?.id === song.id}
                  onPlay={() => playSong(song)}
                  onPlayQueue={() => playQueue(result.items, idx)}
                />
              </div>
            ))}
          </div>

          <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-2 music-grid-fade">
            {result.items.map((song, idx) => (
              <div key={`${song.id}-${idx}`} className="music-grid-item" style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}>
                <SongCard
                  song={song}
                  isPlaying={current?.id === song.id}
                  onPlay={() => playSong(song)}
                  onPlayQueue={() => playQueue(result.items, idx)}
                />
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="glass-btn px-8 max-lg:px-5 max-lg:w-full max-lg:text-sm disabled:opacity-60"
              >
                {loadingMore ? 'Loading more…' : `Load more songs (${result.items.length} shown)`}
              </button>
            </div>
          )}
        </section>
      )}

      {showBrowseHome && (
        <>
          <section className="space-y-3 max-lg:space-y-2.5 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 max-lg:text-[0.95rem]">
              <Sparkles size={18} className="text-purple-300 shrink-0 max-lg:w-4 max-lg:h-4" />
              Browse by mood
            </h2>
            <div className="music-browse-moods">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => browseMood(m)}
                  className="glass p-3.5 sm:p-4 max-lg:p-3 text-left hover:scale-[1.02] transition-transform border border-white/10 hover:border-white/25 min-w-0"
                  style={{ borderColor: `${MOOD_COLORS[m]}33` }}
                >
                  <span className="text-2xl sm:text-3xl max-lg:text-xl">{MOOD_EMOJI[m]}</span>
                  <p
                    className="font-semibold mt-2 text-sm max-lg:mt-1.5 max-lg:text-[13px] max-lg:whitespace-nowrap lg:break-words"
                    style={{ color: MOOD_COLORS[m] }}
                  >
                    {m.charAt(0) + m.slice(1).toLowerCase()}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-white/45 mt-1 leading-snug max-lg:line-clamp-2 lg:break-words">
                    {MOOD_PLAYBACK_HINT[m]}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 pb-2 min-w-0 hidden lg:block">
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <Mic2 size={18} className="text-blue-300" />
              Top artists
            </h2>
            <div className="flex flex-wrap gap-2">
              {FEATURED_ARTISTS.map(({ name, lang }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => browseArtist(name, lang)}
                  className="px-3.5 sm:px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/75 hover:bg-white/10 hover:text-white transition"
                >
                  {name}
                  <span className="text-white/35 text-xs ml-1.5">{lang}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
