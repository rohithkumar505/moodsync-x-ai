import { useEffect, useRef, useState, useCallback } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Song } from '../types/music';
import { getCachedAudioUrl, resolveSongAudio } from '../lib/audioResolve';
import { useMusicPlayer } from '../context/MusicPlayerContext';

interface Props {
  song?: Song;
  onEnded?: () => void;
  className?: string;
  compact?: boolean;
  responsive?: boolean;
  /** UI only — audio is handled by the global player engine. */
  controlsOnly?: boolean;
  /** Render only the <audio> element (legacy local playback). */
  audioOnly?: boolean;
}

function formatTime(s: number) {
  if (!s || Number.isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function PlayerControls({
  playing,
  progress,
  duration,
  loading,
  error,
  songName,
  artist,
  compact,
  responsive,
  className,
  onToggle,
  onSeek,
}: {
  playing: boolean;
  progress: number;
  duration: number;
  loading: boolean;
  error: string;
  songName?: string;
  artist?: string;
  compact?: boolean;
  responsive?: boolean;
  className?: string;
  onToggle: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (loading) {
    return <p className="text-sm text-white/50">Loading {songName || 'track'}...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  const compactUi = (
    <>
      <input
        type="range"
        min={0}
        max={duration || 0}
        value={progress}
        onChange={onSeek}
        className="w-full accent-purple-400 h-1"
      />
      <div className="flex items-center justify-between text-[10px] text-white/40 px-0.5">
        <span>{formatTime(progress)}</span>
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-full bg-purple-500/90 flex items-center justify-center"
          title={playing ? 'Pause' : 'Play'}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" className="ml-0.5" />}
        </button>
        <span>{formatTime(duration)}</span>
      </div>
    </>
  );

  const fullUi = (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center shrink-0"
          title={playing ? 'Pause' : 'Play'}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={progress}
            onChange={onSeek}
            className="w-full accent-purple-400"
          />
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      {songName ? (
        <p className="text-xs text-purple-300/80 truncate">
          {songName}
          {artist ? ` · ${artist}` : ''}
        </p>
      ) : null}
    </>
  );

  return (
    <div className={`${compact || responsive ? 'space-y-1' : 'space-y-2'} ${className || ''}`}>
      {responsive ? (
        <>
          <div className="lg:hidden space-y-1">{compactUi}</div>
          <div className="hidden lg:block space-y-2">{fullUi}</div>
        </>
      ) : compact ? (
        compactUi
      ) : (
        fullUi
      )}
    </div>
  );
}

function ControlsOnlyPlayer({
  compact,
  responsive,
  className,
}: {
  compact?: boolean;
  responsive?: boolean;
  className?: string;
}) {
  const global = useMusicPlayer();
  const current = global.current;
  if (!current) return null;

  return (
    <PlayerControls
      playing={global.playing}
      progress={global.progress}
      duration={global.duration}
      loading={global.audioLoading}
      error={global.audioError}
      songName={current.songName}
      artist={current.artist}
      compact={compact}
      responsive={responsive}
      className={className}
      onToggle={global.togglePlay}
      onSeek={(e) => global.seekTo(Number(e.target.value))}
    />
  );
}

export default function NativeAudioPlayer({
  song,
  onEnded,
  className = '',
  compact = false,
  responsive = false,
  controlsOnly = false,
  audioOnly = false,
}: Props) {
  if (controlsOnly) {
    return (
      <ControlsOnlyPlayer compact={compact} responsive={responsive} className={className} />
    );
  }

  return (
    <LocalNativeAudioPlayer
      song={song!}
      onEnded={onEnded}
      className={className}
      compact={compact}
      responsive={responsive}
      audioOnly={audioOnly}
    />
  );
}

/** Standalone player for pages outside the global queue (legacy). */
function LocalNativeAudioPlayer({
  song,
  onEnded,
  className = '',
  compact = false,
  responsive = false,
  audioOnly = false,
}: Required<Pick<Props, 'song'>> & Omit<Props, 'song' | 'controlsOnly'>) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const onEndedRef = useRef(onEnded);
  const userPausedRef = useRef(false);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [src, setSrc] = useState<string | null>(() => getCachedAudioUrl(song) ?? null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => !getCachedAudioUrl(song));
  const retryRef = useRef(0);

  onEndedRef.current = onEnded;

  const loadAudio = useCallback(async (target: Song) => {
    const instant = getCachedAudioUrl(target);
    if (instant) {
      setSrc(instant);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = await resolveSongAudio(target);
      setSrc(url);
    } catch {
      setError(`Could not play "${target.songName}". Search the exact song or singer name.`);
      setSrc(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    retryRef.current = 0;
    userPausedRef.current = false;
    setPlaying(true);
    setProgress(0);
    const instant = getCachedAudioUrl(song);
    setSrc(instant ?? null);
    setLoading(!instant);
    if (!instant) void loadAudio(song);
  }, [song.id, song.saavnId, song.songName, song.playUrl, song.audioUrl, loadAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    audio.load();
    if (!userPausedRef.current) {
      void audio.play().catch(() => setPlaying(false));
    }

    const onTime = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => onEndedRef.current?.();
    const onErr = () => {
      if (retryRef.current >= 1) return;
      retryRef.current += 1;
      void loadAudio(song);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onErr);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onErr);
    };
  }, [src, song, loadAudio]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      userPausedRef.current = false;
      void audio.play();
    } else {
      userPausedRef.current = true;
      audio.pause();
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setProgress(t);
  };

  if (audioOnly) {
    return (
      <div className={className}>
        {src ? <audio ref={audioRef} src={src} preload="auto" playsInline /> : null}
      </div>
    );
  }

  return (
    <>
      {src ? <audio ref={audioRef} src={src} preload="auto" playsInline className="sr-only" /> : null}
      <PlayerControls
        playing={playing}
        progress={progress}
        duration={duration}
        loading={loading}
        error={error}
        songName={song.songName}
        artist={song.artist}
        compact={compact}
        responsive={responsive}
        className={className}
        onToggle={toggle}
        onSeek={seek}
      />
    </>
  );
}
