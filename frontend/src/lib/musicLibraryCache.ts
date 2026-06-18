import type { SongSearchResult } from '../types/music';

const TTL_MS = 8 * 60 * 1000;
const store = new Map<string, { at: number; data: SongSearchResult }>();

export function libraryCacheKey(parts: Record<string, string | number | undefined>) {
  return JSON.stringify(parts);
}

export function isLibraryCacheFresh(key: string): boolean {
  const hit = store.get(key);
  if (!hit) return false;
  return Date.now() - hit.at <= TTL_MS;
}

export function getLibraryCache(key: string): SongSearchResult | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.data;
}

export function setLibraryCache(key: string, data: SongSearchResult) {
  store.set(key, { at: Date.now(), data });
}

export function peekStaleLibraryCache(key: string): SongSearchResult | null {
  return store.get(key)?.data ?? null;
}
