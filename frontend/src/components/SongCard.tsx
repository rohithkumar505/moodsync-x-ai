import { ListMusic, Pause, Play, Plus, Check, Loader2 } from 'lucide-react';
import type { Mood } from '../api/client';
import { MOOD_COLORS, MOOD_EMOJI } from '../api/client';
import type { Song } from '../types/music';

interface Props {
  song: Song;
  onPlay?: () => void;
  onPlayQueue?: () => void;
  onSave?: () => void;
  saved?: boolean;
  saving?: boolean;
  compact?: boolean;
  mobileList?: boolean;
  isPlaying?: boolean;
}

export default function SongCard({
  song,
  onPlay,
  onPlayQueue,
  onSave,
  saved,
  saving,
  compact,
  mobileList,
  isPlaying,
}: Props) {
  const mood = song.mood as Mood | undefined;
  const moodEmoji = mood && MOOD_EMOJI[mood] ? MOOD_EMOJI[mood] : '🎵';
  const moodColor = mood && MOOD_COLORS[mood] ? MOOD_COLORS[mood] : '#667eea';
  const subtitle = [song.artist, song.movie || song.album].filter(Boolean).join(' · ');
  const meta = [song.language, song.album && !song.movie ? song.album : null]
    .filter(Boolean)
    .join(' · ');

  const isCompact = compact || mobileList;
  const artSize = mobileList ? 'w-12 h-12' : compact ? 'w-11 h-11' : 'w-14 h-14';

  return (
    <div
      className={`group relative flex items-center gap-3 rounded-xl border transition-all active:scale-[0.99] ${
        mobileList ? 'p-2.5 bg-transparent border-transparent' : isCompact ? 'p-2.5' : 'p-3.5'
      } ${
        isPlaying
          ? mobileList
            ? 'bg-violet-500/12'
            : 'bg-purple-500/15 border-purple-400/50 ring-1 ring-purple-400/30'
          : mobileList
            ? 'hover:bg-white/5'
            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
      }`}
    >
      <div className="relative shrink-0">
        {song.imageUrl ? (
          <img
            src={song.imageUrl}
            alt=""
            className={`${artSize} rounded-lg object-cover shadow-md`}
          />
        ) : (
          <div
            className={`${artSize} rounded-lg flex items-center justify-center text-lg`}
            style={{ background: `linear-gradient(135deg, ${moodColor}44, ${moodColor}18)` }}
          >
            {moodEmoji}
          </div>
        )}
        {onPlay && (
          <button
            onClick={onPlay}
            className={`absolute inset-0 flex items-center justify-center rounded-lg transition ${
              isPlaying
                ? 'bg-purple-600/75 opacity-100'
                : mobileList
                  ? 'bg-black/40 opacity-100'
                  : 'bg-black/50 opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
            }`}
            title={isPlaying ? 'Playing' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={mobileList ? 16 : compact ? 14 : 18} fill="white" className="text-white" />
            ) : (
              <Play size={mobileList ? 16 : compact ? 14 : 18} fill="white" className="text-white ml-0.5" />
            )}
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0 py-0.5">
        <p
          className={`font-semibold leading-snug ${
            mobileList
              ? `truncate text-sm ${isPlaying ? 'text-violet-200' : 'text-white'}`
              : `truncate max-lg:whitespace-normal max-lg:overflow-visible max-lg:break-words text-[15px] max-lg:text-sm ${
                  isPlaying ? 'text-purple-200' : 'text-white'
                }`
          }`}
        >
          {song.songName}
        </p>
        <p
          className={`text-white/50 leading-snug ${
            mobileList ? 'truncate text-xs' : 'truncate max-lg:whitespace-normal max-lg:overflow-visible max-lg:break-words text-sm max-lg:text-xs'
          }`}
        >
          {subtitle}
        </p>
        {!mobileList && !compact && meta && (
          <p className="text-xs text-white/35 truncate max-lg:whitespace-normal max-lg:overflow-visible max-lg:break-words mt-0.5 leading-snug">
            {meta}
          </p>
        )}
      </div>

      <div className={`flex items-center gap-0.5 shrink-0 ${mobileList ? 'hidden' : 'flex-col items-end gap-1.5'}`}>
        {!mobileList && mood && MOOD_EMOJI[mood] && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
            style={{
              color: moodColor,
              borderColor: `${moodColor}44`,
              background: `${moodColor}18`,
            }}
          >
            {moodEmoji} {mood.slice(0, 3)}
          </span>
        )}
        <div className="flex items-center gap-0.5">
          {onPlayQueue && !mobileList && (
            <button
              onClick={onPlayQueue}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/80"
              title="Play from here"
            >
              <ListMusic size={16} />
            </button>
          )}
          {saved ? (
            <span className="p-1.5 text-emerald-400" title="Already in playlist">
              <Check size={16} />
            </span>
          ) : onSave ? (
            <button
              onClick={onSave}
              disabled={saving}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/80 disabled:opacity-50"
              title="Add to playlist"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
