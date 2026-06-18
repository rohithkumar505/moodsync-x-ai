import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Song } from '../types/music';
import { getCachedAudioUrl, resolveSongAudio } from '../lib/audioResolve';

interface MusicPlayerContextValue {
  current: Song | null;
  queue: Song[];
  queueIndex: number;
  playerBarVisible: boolean;
  playing: boolean;
  progress: number;
  duration: number;
  audioLoading: boolean;
  audioError: string;
  playSong: (song: Song) => void;
  playQueue: (songs: Song[], startIndex?: number) => void;
  playNext: () => void;
  playPrev: () => void;
  clear: () => void;
  hidePlayerBar: () => void;
  showPlayerBar: () => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

function GlobalAudioElement({
  song,
  audioRef,
  userPausedRef,
  onEnded,
  onPrev,
  onNext,
  onPlayingChange,
  onProgress,
  onDuration,
  onLoadingChange,
  onError,
}: {
  song: Song;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  userPausedRef: React.MutableRefObject<boolean>;
  onEnded: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlayingChange: (playing: boolean) => void;
  onProgress: (time: number) => void;
  onDuration: (time: number) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(() => getCachedAudioUrl(song) ?? null);
  const retryRef = useRef(0);
  const onEndedRef = useRef(onEnded);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  onEndedRef.current = onEnded;
  onPrevRef.current = onPrev;
  onNextRef.current = onNext;

  const loadAudio = useCallback(
    async (target: Song) => {
      const instant = getCachedAudioUrl(target);
      if (instant) {
        setSrc(instant);
        onLoadingChange(false);
        onError('');
        return;
      }

      onLoadingChange(true);
      onError('');

      try {
        const url = await resolveSongAudio(target);
        setSrc(url);
      } catch {
        onError(`Could not play "${target.songName}". Search the exact song or singer name.`);
        setSrc(null);
      } finally {
        onLoadingChange(false);
      }
    },
    [onError, onLoadingChange],
  );

  useEffect(() => {
    retryRef.current = 0;
    userPausedRef.current = false;
    onPlayingChange(true);
    onProgress(0);
    const instant = getCachedAudioUrl(song);
    setSrc(instant ?? null);
    onLoadingChange(!instant);
    onError('');
    if (!instant) void loadAudio(song);
  }, [song.id, song.saavnId, song.songName, song.playUrl, song.audioUrl, loadAudio, onPlayingChange, onProgress, onLoadingChange, onError, userPausedRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    audio.src = src;
    audio.load();
    if (!userPausedRef.current) {
      void audio.play().catch(() => onPlayingChange(false));
    }

    const onTime = () => {
      onProgress(audio.currentTime);
      onDuration(audio.duration || 0);
    };
    const onPlay = () => {
      onPlayingChange(true);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    };
    const onPause = () => {
      onPlayingChange(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };
    const onEnd = () => onEndedRef.current();
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
  }, [src, song, loadAudio, audioRef, userPausedRef, onPlayingChange, onProgress, onDuration]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.songName,
      artist: song.artist || 'MoodSync',
      album: song.movie || song.album || 'MoodSync',
      artwork: song.imageUrl
        ? [{ src: song.imageUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      userPausedRef.current = false;
      void audioRef.current?.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      userPausedRef.current = true;
      audioRef.current?.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => onPrevRef.current());
    navigator.mediaSession.setActionHandler('nexttrack', () => onNextRef.current());

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [song, audioRef, userPausedRef]);

  useEffect(() => {
    const resumeIfNeeded = () => {
      if (document.visibilityState !== 'visible' || userPausedRef.current) return;
      const audio = audioRef.current;
      if (audio && audio.paused && src) {
        void audio.play().catch(() => onPlayingChange(false));
      }
    };

    document.addEventListener('visibilitychange', resumeIfNeeded);
    window.addEventListener('pageshow', resumeIfNeeded);
    window.addEventListener('focus', resumeIfNeeded);

    return () => {
      document.removeEventListener('visibilitychange', resumeIfNeeded);
      window.removeEventListener('pageshow', resumeIfNeeded);
      window.removeEventListener('focus', resumeIfNeeded);
    };
  }, [src, audioRef, userPausedRef, onPlayingChange]);

  return <audio ref={audioRef} preload="auto" playsInline className="sr-only" aria-hidden />;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playerBarVisible, setPlayerBarVisible] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState('');

  const queueRef = useRef<Song[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const userPausedRef = useRef(false);
  queueRef.current = queue;

  const current = queue[queueIndex] ?? null;

  const playSong = useCallback((song: Song) => {
    userPausedRef.current = false;
    setQueue([song]);
    setQueueIndex(0);
    setPlayerBarVisible(typeof window !== 'undefined' && window.innerWidth >= 1024);
  }, []);

  const playQueue = useCallback((songs: Song[], startIndex = 0) => {
    if (!songs.length) return;
    userPausedRef.current = false;
    const idx = Math.min(Math.max(startIndex, 0), songs.length - 1);
    setQueue(songs);
    setQueueIndex(idx);
    setPlayerBarVisible(typeof window !== 'undefined' && window.innerWidth >= 1024);
  }, []);

  const playNext = useCallback(() => {
    setQueueIndex((i) => {
      const len = queueRef.current.length;
      return i < len - 1 ? i + 1 : i;
    });
  }, []);

  const playPrev = useCallback(() => {
    setQueueIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const clear = useCallback(() => {
    userPausedRef.current = true;
    audioRef.current?.pause();
    setQueue([]);
    setQueueIndex(0);
    setPlayerBarVisible(true);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setAudioError('');
  }, []);

  const hidePlayerBar = useCallback(() => setPlayerBarVisible(false), []);
  const showPlayerBar = useCallback(() => setPlayerBarVisible(true), []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      userPausedRef.current = false;
      void audio.play();
    } else {
      userPausedRef.current = true;
      audio.pause();
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setProgress(seconds);
  }, []);

  const value = useMemo(
    () => ({
      current,
      queue,
      queueIndex,
      playerBarVisible,
      playing,
      progress,
      duration,
      audioLoading,
      audioError,
      playSong,
      playQueue,
      playNext,
      playPrev,
      clear,
      hidePlayerBar,
      showPlayerBar,
      togglePlay,
      seekTo,
    }),
    [
      current,
      queue,
      queueIndex,
      playerBarVisible,
      playing,
      progress,
      duration,
      audioLoading,
      audioError,
      playSong,
      playQueue,
      playNext,
      playPrev,
      clear,
      hidePlayerBar,
      showPlayerBar,
      togglePlay,
      seekTo,
    ],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      {current ? (
        <GlobalAudioElement
          key={current.id}
          song={current}
          audioRef={audioRef}
          userPausedRef={userPausedRef}
          onEnded={playNext}
          onPrev={playPrev}
          onNext={playNext}
          onPlayingChange={setPlaying}
          onProgress={setProgress}
          onDuration={setDuration}
          onLoadingChange={setAudioLoading}
          onError={setAudioError}
        />
      ) : null}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error('useMusicPlayer must be used within MusicPlayerProvider');
  return ctx;
}
