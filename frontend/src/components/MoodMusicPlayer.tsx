import type { NowPlaying } from '../types/music';
import { MOOD_EMOJI, type Mood } from '../api/client';
import NativeAudioPlayer from './NativeAudioPlayer';

interface Props {
  song: NowPlaying | null;
}

export default function MoodMusicPlayer({ song }: Props) {
  if (!song) {
    return (
      <div className="glass p-8 text-center text-white/50">
        No song available for this mood and language yet.
      </div>
    );
  }

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{MOOD_EMOJI[song.mood as Mood]}</span>
        <div>
          <p className="text-xs text-purple-300 uppercase tracking-wide">Now Playing · {song.language}</p>
          <p className="text-lg font-semibold">{song.songName}</p>
          <p className="text-sm text-white/60">{song.artist}</p>
        </div>
      </div>
      <NativeAudioPlayer song={song} />
    </div>
  );
}
