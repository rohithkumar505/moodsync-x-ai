export const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Punjabi', 'Kannada'] as const;
export type Language = typeof LANGUAGES[number];

export type SearchType = 'auto' | 'song' | 'movie' | 'singer' | 'hero' | 'new';

export interface Song {
  id: string;
  songName: string;
  artist: string;
  mood: string;
  language: string;
  album?: string;
  movie?: string;
  audioUrl?: string;
  previewUrl?: string;
  playUrl?: string;
  saavnId?: string;
  imageUrl?: string;
  source?: string;
}

export type NowPlaying = Song;

export interface SearchSuggestion {
  type: 'song' | 'movie' | 'singer' | 'hero';
  label: string;
  subtitle: string;
  query: string;
  imageUrl?: string;
}

export interface SongSearchResult {
  items: Song[];
  total: number;
  page: number;
  pages: number;
  hasMore?: boolean;
  source?: string;
  searchType?: SearchType;
  title?: string;
  subtitle?: string;
}

export function playableUrl(song: Song): string | undefined {
  if (song.playUrl) return song.playUrl;
  if (song.saavnId) return `/api/music/play/${song.saavnId}`;
  if (song.audioUrl?.startsWith('http')) return song.audioUrl;
  if (song.previewUrl?.startsWith('http')) return song.previewUrl;
  return song.audioUrl;
}
