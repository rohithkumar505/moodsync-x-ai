import { musicApi } from '../api/client';
import type { Song } from '../types/music';
import { playableUrl } from '../types/music';

const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 120;

type CacheEntry = { url: string; at: number };
const streamCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string>>();

function cacheKey(song: Song): string {
  return song.saavnId || song.id || `${song.songName}:${song.artist}`;
}

function pruneCache() {
  if (streamCache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = [...streamCache.entries()].sort((a, b) => a[1].at - b[1].at);
  for (let i = 0; i < oldest.length - MAX_CACHE_ENTRIES; i++) {
    streamCache.delete(oldest[i][0]);
  }
}

function getCachedEntry(song: Song): string | undefined {
  if (song.audioUrl?.startsWith('http')) return song.audioUrl;
  if (song.previewUrl?.startsWith('http')) return song.previewUrl;
  const hit = streamCache.get(cacheKey(song));
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    streamCache.delete(cacheKey(song));
    return undefined;
  }
  return hit.url;
}

export function getCachedAudioUrl(song: Song): string | undefined {
  return getCachedEntry(song);
}

async function resolveSongAudioInner(song: Song): Promise<string> {
  const cached = getCachedEntry(song);
  if (cached) return cached;

  const key = cacheKey(song);
  const playPath = playableUrl(song);

  if (!playPath) {
    const { data } = await musicApi.post('/api/songs/resolve', {
      songName: song.songName,
      artist: song.artist,
      movie: song.movie,
      album: song.album,
      language: song.language,
    });
    if (!data.audioUrl) throw new Error('not found');
    streamCache.set(key, { url: data.audioUrl, at: Date.now() });
    pruneCache();
    return data.audioUrl;
  }

  if (playPath.startsWith('http')) {
    streamCache.set(key, { url: playPath, at: Date.now() });
    pruneCache();
    return playPath;
  }

  const { data } = await musicApi.get(playPath);
  if (!data.audioUrl) throw new Error('no stream');
  streamCache.set(key, { url: data.audioUrl, at: Date.now() });
  pruneCache();
  return data.audioUrl;
}

export async function resolveSongAudio(song: Song): Promise<string> {
  const cached = getCachedEntry(song);
  if (cached) return cached;

  const key = cacheKey(song);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = resolveSongAudioInner(song).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export function prefetchSongAudio(song: Song | null | undefined): void {
  if (!song || getCachedEntry(song)) return;
  resolveSongAudio(song).catch(() => undefined);
}
