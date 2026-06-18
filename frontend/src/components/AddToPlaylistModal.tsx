import { useCallback, useEffect, useState } from 'react';
import { Check, ListMusic, Loader2, X } from 'lucide-react';
import { isAxiosError } from 'axios';
import api, { getApiErrorMessage } from '../api/client';
import { buildSongPayload, normalizePlaylistSong } from '../lib/playlistUtils';
import type { Song } from '../types/music';

interface PlaylistSummary {
  id: string;
  playlistName: string;
  songCount: number;
}

interface Props {
  open: boolean;
  song: Song | null;
  onClose: () => void;
  onSaved?: (playlistName: string) => void;
}

export default function AddToPlaylistModal({ open, song, onClose, onSaved }: Props) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PlaylistSummary[]>('/api/playlists');
      setPlaylists(data);
    } catch {
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccess('');
    setNewName('');
    load();
  }, [open, load]);

  if (!open || !song) return null;

  const normalized = normalizePlaylistSong(song);
  const payload = buildSongPayload(normalized);

  const finishSuccess = (message: string, playlistName: string) => {
    setSuccess(message);
    onSaved?.(playlistName);
    setTimeout(onClose, 900);
  };

  const saveTo = async (playlistId: string, playlistName: string) => {
    setSavingId(playlistId);
    setError('');
    setSuccess('');
    try {
      await api.post(`/api/playlists/${playlistId}/songs`, payload);
      finishSuccess(`Added to "${playlistName}"`, playlistName);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        finishSuccess('Already in this playlist', playlistName);
      } else {
        setError(getApiErrorMessage(err, 'Could not add song'));
      }
    } finally {
      setSavingId(null);
    }
  };

  const createAndSave = async () => {
    const name = newName.trim();
    if (!name) return;
    setSavingId('new');
    setError('');
    try {
      const { data } = await api.post<PlaylistSummary>('/api/playlists', { playlistName: name });
      await api.post(`/api/playlists/${data.id}/songs`, payload);
      finishSuccess(`Created "${name}" and added song`, name);
      setNewName('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save to playlist'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass w-full max-w-md rounded-2xl border border-white/10 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="save-playlist-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex items-start gap-3">
            {normalized.imageUrl ? (
              <img src={normalized.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                <ListMusic size={20} className="text-violet-300" />
              </div>
            )}
            <div className="min-w-0">
              <p id="save-playlist-title" className="text-xs uppercase tracking-wide text-white/45 mb-1">
                Save to playlist
              </p>
              <p className="font-semibold truncate">{normalized.songName}</p>
              <p className="text-sm text-white/50 truncate">{normalized.artist}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <p className="text-sm text-red-300 mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>
        ) : null}
        {success ? (
          <p className="text-sm text-emerald-300 mb-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
            <Check size={16} /> {success}
          </p>
        ) : null}

        <div className="flex gap-2 mb-4">
          <input
            className="glass-input flex-1 text-sm"
            placeholder="New playlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createAndSave()}
          />
          <button
            type="button"
            onClick={createAndSave}
            disabled={!newName.trim() || savingId === 'new'}
            className="glass-btn text-sm px-3 disabled:opacity-50 whitespace-nowrap"
          >
            {savingId === 'new' ? <Loader2 size={16} className="animate-spin" /> : 'Create & add'}
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex justify-center py-8 text-white/40">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : playlists.length ? (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => saveTo(playlist.id, playlist.playlistName)}
                disabled={Boolean(savingId)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/25 text-left disabled:opacity-50 transition-colors"
              >
                <ListMusic size={18} className="text-violet-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{playlist.playlistName}</p>
                  <p className="text-xs text-white/45">
                    {playlist.songCount} song{playlist.songCount === 1 ? '' : 's'}
                  </p>
                </div>
                {savingId === playlist.id ? <Loader2 size={16} className="animate-spin shrink-0" /> : null}
              </button>
            ))
          ) : (
            <p className="text-sm text-white/45 text-center py-6">No playlists yet — create one above.</p>
          )}
        </div>
      </div>
    </div>
  );
}
