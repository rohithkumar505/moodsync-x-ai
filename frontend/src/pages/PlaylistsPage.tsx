import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ListMusic,
  Loader2,
  Music2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { prefetchSongAudio } from '../lib/audioResolve';
import {
  buildSongPayload,
  isSongInPlaylist,
  normalizePlaylistSong,
  normalizePlaylistSongs,
} from '../lib/playlistUtils';
import { isAxiosError } from 'axios';
import api, { getApiErrorMessage } from '../api/client';
import SongCard from '../components/SongCard';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import type { Song, SongSearchResult } from '../types/music';

interface PlaylistSummary {
  id: string;
  playlistName: string;
  songCount: number;
  creationDate?: string;
}

interface PlaylistDetail extends PlaylistSummary {
  songs: Song[];
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function PlaylistsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

export default function PlaylistsPage() {
  const { playQueue, playSong } = useMusicPlayer();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<PlaylistDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<PlaylistSummary[]>('/api/playlists');
      setPlaylists(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load playlists'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [load]);

  const open = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError('');
    try {
      const { data } = await api.get<PlaylistDetail>(`/api/playlists/${id}`);
      const normalized: PlaylistDetail = {
        ...data,
        songs: normalizePlaylistSongs(data.songs),
      };
      setSelected(normalized);
      setRenameValue(normalized.playlistName);
      setRenaming(false);
      normalized.songs.slice(0, 5).forEach((song) => prefetchSongAudio(song));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not open playlist'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const searchCatalog = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get<SongSearchResult>('/api/songs', {
        params: { q: q.trim(), per_page: 16 },
      });
      setSearchResults((data.items || []).map(normalizePlaylistSong));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => searchCatalog(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCatalog, selected]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post<PlaylistSummary>('/api/playlists', { playlistName: trimmed });
      setName('');
      await load();
      await open(data.id);
      showToast(`Created "${trimmed}"`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create playlist'));
    } finally {
      setCreating(false);
    }
  };

  const playlistSongs = selected?.songs ?? [];

  const checkInPlaylist = useCallback(
    (song: Song) => isSongInPlaylist(song, playlistSongs),
    [playlistSongs],
  );

  const addSong = async (song: Song) => {
    if (!selected || checkInPlaylist(song)) return;
    setAddingId(song.id);
    setError('');
    try {
      const { data } = await api.post<PlaylistDetail>(
        `/api/playlists/${selected.id}/songs`,
        buildSongPayload(song),
      );
      const updated: PlaylistDetail = {
        ...data,
        songs: normalizePlaylistSongs(data.songs),
      };
      setSelected(updated);
      await load();
      prefetchSongAudio(normalizePlaylistSong(song));
      showToast(`Added "${song.songName}"`);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        showToast('Song is already in this playlist');
        await open(selected.id);
      } else {
        setError(getApiErrorMessage(err, 'Could not add song'));
      }
    } finally {
      setAddingId(null);
    }
  };

  const removeSong = async (songId: string) => {
    if (!selected) return;
    setRemovingId(songId);
    setError('');
    try {
      const { data } = await api.delete<PlaylistDetail>(`/api/playlists/${selected.id}/songs/${songId}`);
      setSelected({ ...data, songs: normalizePlaylistSongs(data.songs) });
      await load();
      showToast('Song removed');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove song'));
    } finally {
      setRemovingId(null);
    }
  };

  const renamePlaylist = async () => {
    if (!selected || !renameValue.trim()) return;
    try {
      const { data } = await api.patch<PlaylistSummary>(`/api/playlists/${selected.id}`, {
        playlistName: renameValue.trim(),
      });
      setSelected({ ...selected, playlistName: data.playlistName });
      setRenaming(false);
      await load();
      showToast('Playlist renamed');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not rename playlist'));
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!window.confirm('Delete this playlist? This cannot be undone.')) return;
    try {
      await api.delete(`/api/playlists/${id}`);
      if (selected?.id === id) {
        setSelected(null);
        setSearchQuery('');
        setSearchResults([]);
      }
      await load();
      showToast('Playlist deleted');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete playlist'));
    }
  };

  const shufflePlay = () => {
    if (!playlistSongs.length) return;
    const shuffled = [...playlistSongs].sort(() => Math.random() - 0.5);
    playQueue(shuffled);
  };

  const totalSongs = useMemo(
    () => playlists.reduce((sum, p) => sum + (p.songCount || 0), 0),
    [playlists],
  );

  return (
    <div className="w-full space-y-5 lg:space-y-6">
      <header className="glass rounded-2xl border border-white/10 p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="hidden lg:flex items-center gap-2 text-violet-300/80 text-sm mb-1">
              <ListMusic size={16} />
              Your music
            </div>
            <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold">Playlists</h1>
            <p className="text-sm text-white/50 lg:mt-1">
              {playlists.length} playlist{playlists.length === 1 ? '' : 's'} · {totalSongs} saved track
              {totalSongs === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="self-start p-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white disabled:opacity-50"
            aria-label="Refresh playlists"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {toast ? (
        <div className="glass rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="glass rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-200/70 hover:text-red-100 shrink-0">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="glass rounded-xl border border-white/10 p-4 sm:p-5">
        <p className="text-sm font-medium text-white/70 mb-3">Create playlist</p>
        <div className="flex gap-2">
          <input
            className="glass-input flex-1"
            placeholder="e.g. Morning calm, Gym hits, Feel-good Hindi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button
            type="button"
            className="glass-btn flex items-center gap-2 disabled:opacity-50"
            onClick={create}
            disabled={creating || !name.trim()}
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Create
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">Your playlists</h2>
          {loading ? (
            <PlaylistsSkeleton />
          ) : playlists.length ? (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => open(playlist.id)}
                className={`w-full text-left glass rounded-xl border p-4 transition-colors hover:border-violet-500/30 ${
                  selected?.id === playlist.id ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 flex items-center justify-center shrink-0">
                    <Music2 size={20} className="text-violet-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{playlist.playlistName}</p>
                    <p className="text-xs text-white/45 mt-0.5">
                      {playlist.songCount} song{playlist.songCount === 1 ? '' : 's'}
                      {playlist.creationDate ? ` · ${formatDate(playlist.creationDate)}` : ''}
                    </p>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="glass rounded-xl border border-white/10 p-8 text-center text-white/45">
              <ListMusic size={32} className="mx-auto mb-3 opacity-40" />
              <p>No playlists yet. Create one above, then search songs to add.</p>
            </div>
          )}
        </section>

        <section className="lg:col-span-3 space-y-4 min-h-[320px]">
          {!selected && !detailLoading ? (
            <div className="glass rounded-xl border border-white/10 p-10 text-center text-white/45 h-full min-h-[280px] flex flex-col items-center justify-center">
              <Play size={36} className="mb-3 opacity-30" />
              <p className="font-medium text-white/60">Select a playlist</p>
              <p className="text-sm mt-1">View tracks, play all, shuffle, or search JioSaavn to add songs.</p>
            </div>
          ) : null}

          {detailLoading ? (
            <div className="glass rounded-xl border border-white/10 p-10 flex flex-col items-center justify-center gap-3 min-h-[280px]">
              <Loader2 className="animate-spin text-violet-300" size={28} />
              <p className="text-sm text-white/45">Loading playlist...</p>
            </div>
          ) : null}

          {selected && !detailLoading ? (
            <>
              <div className="glass rounded-xl border border-white/10 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {renaming ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        className="glass-input flex-1"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renamePlaylist();
                          if (e.key === 'Escape') setRenaming(false);
                        }}
                        autoFocus
                      />
                      <button type="button" className="glass-btn text-sm" onClick={renamePlaylist}>
                        Save
                      </button>
                      <button type="button" className="text-sm text-white/50" onClick={() => setRenaming(false)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-xl font-bold">{selected.playlistName}</h2>
                      <p className="text-sm text-white/45">
                        {playlistSongs.length} track{playlistSongs.length === 1 ? '' : 's'} saved
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {playlistSongs.length > 0 ? (
                      <>
                        <button
                          type="button"
                          className="glass-btn text-sm flex items-center gap-2"
                          onClick={() => playQueue(playlistSongs)}
                        >
                          <Play size={14} fill="white" /> Play all
                        </button>
                        <button type="button" className="glass-btn text-sm flex items-center gap-2" onClick={shufflePlay}>
                          <Shuffle size={14} /> Shuffle
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="p-2 rounded-lg border border-white/10 hover:bg-white/10"
                      onClick={() => setRenaming(true)}
                      aria-label="Rename playlist"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-lg border border-red-500/20 text-red-300 hover:bg-red-500/10"
                      onClick={() => deletePlaylist(selected.id)}
                      aria-label="Delete playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {playlistSongs.map((song, idx) => (
                  <div key={song.id} className="flex items-center gap-2">
                    <span className="text-xs text-white/30 w-5 text-right shrink-0 tabular-nums">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <SongCard song={song} onPlay={() => playQueue(playlistSongs, idx)} compact />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSong(song.id)}
                      disabled={removingId === song.id}
                      className="p-2 text-red-300/80 hover:text-red-300 hover:bg-red-500/10 rounded-lg shrink-0 disabled:opacity-50"
                      aria-label="Remove song"
                    >
                      {removingId === song.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                ))}
                {!playlistSongs.length ? (
                  <div className="text-sm text-white/45 glass rounded-xl border border-dashed border-white/15 p-8 text-center">
                    <Search size={24} className="mx-auto mb-2 opacity-35" />
                    <p className="text-white/55 font-medium">This playlist is empty</p>
                    <p className="mt-1">Search below to add tracks from JioSaavn.</p>
                  </div>
                ) : null}
              </div>

              <div className="glass rounded-xl border border-white/10 p-4 sm:p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white/70">Add songs</h3>
                  <p className="text-xs text-white/40 mt-0.5">Search by song, movie, or artist</p>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    className="glass-input pl-9 text-sm w-full"
                    placeholder="Try Arijit Singh, Pathaan, Tum Hi Ho..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {searching ? (
                  <p className="text-sm text-white/40 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Searching JioSaavn...
                  </p>
                ) : null}
                {!searching && searchQuery.trim() && !searchResults.length ? (
                  <p className="text-sm text-white/45 text-center py-4">No songs found — try a different spelling.</p>
                ) : null}
                {!searchQuery.trim() ? (
                  <p className="text-sm text-white/35 text-center py-3">Type above to search the catalog.</p>
                ) : null}
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {searchResults.map((song) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      onPlay={() => playSong(song)}
                      onSave={() => addSong(song)}
                      saved={checkInPlaylist(song)}
                      saving={addingId === song.id}
                      compact
                    />
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
