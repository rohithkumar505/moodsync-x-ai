import { MOOD_COLORS, MOOD_EMOJI, type Mood } from '../api/client';
import { MOOD_PROFILES } from '../data/moodProfiles';
import type { Song } from '../types/music';
import AddToPlaylistModal from './AddToPlaylistModal';
import SongCard from './SongCard';
import { Music, Play, RefreshCw, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

interface Props {
  mood: Mood;
  language: string;
  songs: Song[];
  loading: boolean;
  error: string;
  onScanAgain: () => void;
  confidence?: number;
  autoPlaying?: boolean;
  sessionLocked?: boolean;
  therapeuticNote?: string;
  playbackMood?: Mood | null;
}

export default function MoodPlaybackPanel({
  mood,
  language,
  songs,
  loading,
  error,
  onScanAgain,
  confidence,
  autoPlaying,
  sessionLocked,
  therapeuticNote,
  playbackMood,
}: Props) {
  const { playQueue, current, queueIndex } = useMusicPlayer();
  const [saveSong, setSaveSong] = useState<Song | null>(null);
  const [saveToast, setSaveToast] = useState('');
  const profile = MOOD_PROFILES[mood];
  const color = MOOD_COLORS[mood];
  const nowPlaying = current || songs[0] || null;

  return (
    <div className="glass p-5 max-lg:p-4 space-y-4 max-lg:space-y-3 border-2 min-w-0" style={{ borderColor: `${color}44` }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-lg:gap-2.5">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-4xl shrink-0 max-lg:text-3xl">{MOOD_EMOJI[mood]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-white/50 max-lg:text-[10px] max-lg:tracking-wide">
              {sessionLocked ? 'Your mood playlist' : 'Playing for your mood'}
            </p>
            <h2 className="text-xl font-bold max-lg:text-lg max-lg:break-words lg:truncate" style={{ color }}>
              {profile.title}
            </h2>
            <p className="text-sm text-white/55 max-lg:text-xs max-lg:leading-relaxed break-words">
              {profile.musicVibe} · {language}
              {confidence !== undefined ? ` · ${Math.round(confidence * 100)}% face match` : ''}
            </p>
            {therapeuticNote && (
              <p className="text-sm text-purple-200/90 mt-1.5 leading-relaxed max-lg:text-xs break-words">{therapeuticNote}</p>
            )}
            {playbackMood && playbackMood !== mood && (
              <p className="text-xs text-emerald-300/80 mt-1 max-lg:leading-relaxed break-words">
                Playing {playbackMood.toLowerCase()} songs for your {mood.toLowerCase()} mood
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onScanAgain}
          disabled={loading}
          className="px-4 py-2 rounded-xl border border-white/15 text-sm text-white/70 hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 max-lg:w-full max-lg:py-2.5"
        >
          <RefreshCw size={16} />
          Scan again
        </button>
      </div>

      {saveToast ? (
        <p className="text-xs text-center text-emerald-300/90">{saveToast}</p>
      ) : null}

      {sessionLocked && songs.length > 1 && (
        <p className="text-xs text-emerald-300/90 text-center">
          {songs.length} unique tracks · one song per artist · auto-plays in order
        </p>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-10 text-white/50">
          <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <p>Building your {mood.toLowerCase()} {language} playlist…</p>
        </div>
      )}

      {error && !loading && (
        <p className="text-red-400 text-sm text-center py-4">{error}</p>
      )}

      {!loading && nowPlaying && songs.length > 0 && (
        <div
          className="rounded-xl p-4 space-y-3 border bg-black/30"
          style={{ borderColor: `${color}55` }}
        >
          <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
            <Volume2 size={18} className={autoPlaying ? 'animate-pulse' : ''} />
            {autoPlaying
              ? `Now playing — track ${queueIndex + 1} of ${songs.length}`
              : 'Ready to play'}
          </div>

          <div className="flex items-center gap-4">
            {nowPlaying.imageUrl ? (
              <img
                src={nowPlaying.imageUrl}
                alt=""
                className="w-16 h-16 rounded-xl object-cover shrink-0 ring-2 ring-white/10"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0"
                style={{ background: `${color}30` }}
              >
                {MOOD_EMOJI[mood]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate max-lg:whitespace-normal max-lg:overflow-visible max-lg:break-words max-lg:text-base">
                {nowPlaying.songName}
              </p>
              <p className="text-white/55 text-sm truncate max-lg:whitespace-normal max-lg:overflow-visible max-lg:break-words max-lg:text-xs">
                {nowPlaying.artist}
              </p>
              {autoPlaying && (
                <p className="text-xs text-purple-300 mt-1">
                  Next song plays automatically when this one ends
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && songs.length > 1 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/60">Up next — more {mood.toLowerCase()} songs</p>
            {!sessionLocked && (
              <button
                type="button"
                onClick={() => playQueue(songs)}
                className="glass-btn text-sm flex items-center gap-2 py-2"
              >
                <Play size={14} fill="white" />
                Play all ({songs.length})
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {songs.map((song, idx) => (
              <div
                key={song.id}
                className={`rounded-xl transition ${
                  current?.id === song.id ? 'ring-2 ring-purple-400' : ''
                }`}
              >
                <SongCard
                  song={song}
                  compact
                  isPlaying={current?.id === song.id}
                  onPlay={() => playQueue(songs, idx)}
                  onSave={() => setSaveSong(song)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && !error && songs.length === 0 && (
        <div className="text-center py-8 text-white/50">
          <Music size={32} className="mx-auto mb-2 opacity-40" />
          <p>Could not load mood songs. Tap Scan again or change language.</p>
        </div>
      )}

      <AddToPlaylistModal
        open={Boolean(saveSong)}
        song={saveSong}
        onClose={() => setSaveSong(null)}
        onSaved={(name) => setSaveToast(`Saved to "${name}"`)}
      />
    </div>
  );
}
