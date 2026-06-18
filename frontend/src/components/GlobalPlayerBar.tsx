import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Music, X } from 'lucide-react';
import { useEffect } from 'react';
import { MOOD_EMOJI, type Mood } from '../api/client';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { prefetchSongAudio } from '../lib/audioResolve';
import NativeAudioPlayer from './NativeAudioPlayer';

function TrackArt({ song, size = 'md' }: { song: { imageUrl?: string; mood?: string }; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-10 rounded-md' : 'w-11 h-11 lg:w-12 lg:h-12 rounded-lg';
  if (song.imageUrl) {
    return <img src={song.imageUrl} alt="" className={`${dim} object-cover shrink-0`} />;
  }
  return (
    <div className={`${dim} bg-white/10 flex items-center justify-center shrink-0`}>
      {song.mood && MOOD_EMOJI[song.mood as Mood] ? (
        <span className="text-lg">{MOOD_EMOJI[song.mood as Mood]}</span>
      ) : (
        <Music size={16} className="text-white/60" />
      )}
    </div>
  );
}

export default function GlobalPlayerBar() {
  const {
    current,
    queue,
    queueIndex,
    playerBarVisible,
    playNext,
    playPrev,
    clear,
    hidePlayerBar,
    showPlayerBar,
  } = useMusicPlayer();

  const isMobile = useIsMobileViewport();
  const nextSong = queue[queueIndex + 1] ?? null;

  useEffect(() => {
    prefetchSongAudio(current);
    prefetchSongAudio(nextSong);
  }, [current, nextSong]);

  if (!current) return null;

  const subtitle = [current.artist, current.movie || current.album].filter(Boolean).join(' · ');

  return (
    <>
      {isMobile ? (
      <div
        className={`mobile-player-dock mobile-player-dock-inner no-print ${
          playerBarVisible ? 'mobile-player-dock-expanded' : 'mobile-player-dock-mini'
        }`}
      >
        {playerBarVisible ? (
          <div className="py-2 space-y-1.5">
            <div className="flex items-center gap-2.5">
              <TrackArt song={current} />
              <button
                type="button"
                onClick={hidePlayerBar}
                className="min-w-0 flex-1 text-left"
                aria-label="Collapse player"
              >
                <p className="text-sm font-semibold truncate">{current.songName}</p>
                <p className="text-xs text-white/50 truncate">{subtitle}</p>
              </button>
              <div className="flex items-center shrink-0">
                <button
                  onClick={playPrev}
                  disabled={queueIndex === 0}
                  className="p-2 rounded-lg active:bg-white/10 disabled:opacity-30"
                  aria-label="Previous"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={hidePlayerBar}
                  className="p-2 rounded-lg active:bg-white/10 text-white/60"
                  aria-label="Collapse player"
                >
                  <ChevronDown size={18} />
                </button>
                <button
                  onClick={playNext}
                  disabled={queueIndex >= queue.length - 1}
                  className="p-2 rounded-lg active:bg-white/10 disabled:opacity-30"
                  aria-label="Next"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <NativeAudioPlayer controlsOnly responsive />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={showPlayerBar}
              className="flex items-center gap-2.5 w-full h-[var(--mobile-mini-player-h)] active:bg-white/5 transition"
              aria-label="Expand player"
            >
              <TrackArt song={current} size="sm" />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium truncate">{current.songName}</p>
                <p className="text-[11px] text-white/45 truncate">{subtitle || 'Now playing'}</p>
              </div>
              <ChevronUp size={18} className="text-white/45 shrink-0 mr-1" />
            </button>
          </>
        )}
      </div>
      ) : (
        <>
      {!playerBarVisible ? (
        <div className="fixed bottom-4 left-4 z-[49] no-print">
          <button
            type="button"
            onClick={showPlayerBar}
            className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full glass border border-white/15 shadow-lg shadow-black/30 hover:bg-white/10 transition max-w-[min(100vw-6rem,18rem)]"
            title="Show music player"
            aria-label="Show music player"
          >
            {current.imageUrl ? (
              <img src={current.imageUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-violet-500/30 flex items-center justify-center shrink-0">
                <Music size={14} className="text-violet-200" />
              </div>
            )}
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-medium truncate">{current.songName}</p>
              <p className="text-[10px] text-white/45 truncate">{subtitle || 'Now playing'}</p>
            </div>
            <ChevronUp size={16} className="text-white/50 shrink-0" />
          </button>
        </div>
      ) : null}

      <div
        className={
          playerBarVisible
            ? 'fixed left-0 right-0 bottom-0 z-[49] glass rounded-none border-x-0 border-b-0 no-print'
            : 'hidden'
        }
      >
        <div className="max-w-6xl mx-auto px-3 py-2.5 lg:p-4 lg:space-y-3">
          {playerBarVisible ? (
            <>
              <div className="flex items-center gap-2.5 lg:gap-3">
                <TrackArt song={current} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm lg:text-base font-semibold lg:font-medium truncate">{current.songName}</p>
                  <p className="text-xs lg:text-sm text-white/50 truncate">{subtitle}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={playPrev}
                    disabled={queueIndex === 0}
                    className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30"
                    aria-label="Previous track"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={hidePlayerBar}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60"
                    aria-label="Hide music player"
                  >
                    <ChevronDown size={18} />
                  </button>
                  <button
                    onClick={clear}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60"
                    aria-label="Stop music"
                  >
                    <X size={18} />
                  </button>
                  <button
                    onClick={playNext}
                    disabled={queueIndex >= queue.length - 1}
                    className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30"
                    aria-label="Next track"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <NativeAudioPlayer controlsOnly />

              {queue.length > 1 ? (
                <p className="text-xs text-white/40 text-center">
                  Track {queueIndex + 1} of {queue.length}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
        </>
      )}
    </>
  );
}
