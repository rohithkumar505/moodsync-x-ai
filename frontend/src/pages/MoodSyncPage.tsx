import { useEffect, useState, useCallback, useRef } from 'react';
import api, { getApiErrorMessage, type Mood } from '../api/client';
import type { Language, Song } from '../types/music';
import LanguageSelector from '../components/LanguageSelector';
import FaceMoodScanner from '../components/FaceMoodScanner';
import LiveMoodPanel, { type LiveMoodState } from '../components/LiveMoodPanel';
import MoodPlaybackPanel from '../components/MoodPlaybackPanel';
import MoodExpressionGuide from '../components/MoodExpressionGuide';
import { useAuth } from '../context/AuthContext';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { MOOD_PROFILES } from '../data/moodProfiles';
import { prefetchSongAudio } from '../lib/audioResolve';
import { Radio } from 'lucide-react';

const INITIAL_LIVE: LiveMoodState = {
  mood: null,
  displayMood: null,
  confidence: 0,
  reliability: 'low',
  calibrating: true,
  expressions: {},
  moodScores: { HAPPY: 0, SAD: 0, ANGRY: 0, RELAXED: 0, NEUTRAL: 0 },
  dominantExpression: 'neutral',
  faceDetected: false,
  stable: false,
  framesHeld: 0,
  liveDescription: '',
};

export default function MoodSyncPage() {
  const { user } = useAuth();
  const { playQueue } = useMusicPlayer();
  const [language, setLanguage] = useState<Language>(
    (user?.preferredLanguage as Language) || 'Hindi'
  );
  const [live, setLive] = useState<LiveMoodState>(INITIAL_LIVE);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [detectedMood, setDetectedMood] = useState<Mood | null>(null);
  const [songError, setSongError] = useState('');
  const [savedConfidence, setSavedConfidence] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [moodSessionLocked, setMoodSessionLocked] = useState(false);
  const [scanSession, setScanSession] = useState(0);
  const [therapeuticNote, setTherapeuticNote] = useState('');
  const [playbackMood, setPlaybackMood] = useState<Mood | null>(null);

  const moodSessionLockedRef = useRef(false);
  const detectTriggeredRef = useRef(false);
  moodSessionLockedRef.current = moodSessionLocked;

  useEffect(() => {
    if (user?.preferredLanguage && !moodSessionLocked) {
      setLanguage(user.preferredLanguage as Language);
    }
  }, [user, moodSessionLocked]);

  const loadAndPlayForMood = useCallback(
    async (mood: Mood, confidence: number, dominantExpression: string) => {
      setLoadingSongs(true);
      setSongError('');
      setDetectedMood(mood);
      setSavedConfidence(confidence);
      setAutoPlaying(false);

      try {
        const { data } = await api.post<{
          moodPlaylist: Song[];
          nowPlaying: Song | null;
          message: string;
          therapeuticNote?: string;
          playbackMood?: Mood;
          detectedMood?: Mood;
        }>('/api/mood-sync', {
          mood,
          confidence,
          language,
          source: 'face_camera_live',
          dominantExpression,
        });

        const songs: Song[] =
          data.moodPlaylist?.length > 0
            ? data.moodPlaylist
            : data.nowPlaying
              ? [data.nowPlaying]
              : [];

        const tagged = songs.map((s) => ({ ...s, mood }));

        setPlaylist(tagged);
        setTherapeuticNote(data.therapeuticNote || data.message || '');
        setPlaybackMood(data.playbackMood || mood);

        if (tagged.length > 0) {
          prefetchSongAudio(tagged[0]);
          prefetchSongAudio(tagged[1]);
          playQueue(tagged, 0);
          setAutoPlaying(true);
          setMoodSessionLocked(true);
        } else {
          detectTriggeredRef.current = false;
          setSongError(`No ${mood.toLowerCase()} songs found for ${language}. Tap Scan again.`);
        }
      } catch (err) {
        detectTriggeredRef.current = false;
        setSongError(getApiErrorMessage(err, 'Could not load songs. Tap Scan again.'));
        setPlaylist([]);
      } finally {
        setLoadingSongs(false);
      }
    },
    [language, playQueue]
  );

  const handleLiveUpdate = useCallback((state: LiveMoodState) => {
    if (moodSessionLockedRef.current) return;
    setLive(state);
  }, []);

  useEffect(() => {
    if (moodSessionLocked || detectTriggeredRef.current) return;

    const { displayMood, stable, faceDetected, confidence, dominantExpression, reliability } = live;

    if (!displayMood || !stable || !faceDetected || loadingSongs || reliability === 'low') {
      return;
    }

    detectTriggeredRef.current = true;
    loadAndPlayForMood(displayMood, confidence, dominantExpression);
  }, [live, moodSessionLocked, loadingSongs, loadAndPlayForMood]);

  const handleScanAgain = useCallback(() => {
    detectTriggeredRef.current = false;
    setMoodSessionLocked(false);
    setDetectedMood(null);
    setPlaylist([]);
    setSongError('');
    setAutoPlaying(false);
    setTherapeuticNote('');
    setPlaybackMood(null);
    setLive(INITIAL_LIVE);
    setScanSession((n) => n + 1);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6 max-lg:space-y-4 mood-sync-mobile">
      <div className="lg:hidden space-y-1.5">
        <div className="flex items-center gap-2 text-purple-300 text-xs font-medium">
          <Radio size={14} className={moodSessionLocked ? '' : 'animate-pulse'} />
          Real-time AI mood detection
        </div>
        <p className="text-sm text-white/60 leading-relaxed">
          Choose your song language, follow the face guide, hold still for about 2 seconds — your mood
          locks and music plays automatically.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 max-lg:gap-3">
        <div className="hidden lg:block">
          <div className="flex items-center gap-2 text-purple-300 text-sm font-medium mb-2">
            <Radio size={16} className={moodSessionLocked ? '' : 'animate-pulse'} />
            Real-time AI mood detection
          </div>
          <h1 className="text-3xl font-bold">Mood Sync</h1>
          <p className="text-white/60 mt-1 max-w-xl">
            Follow the guide below — make the face, hold still ~1.5 seconds, mood locks and songs play.
          </p>
        </div>
        <div className="w-full lg:w-auto lg:shrink-0 min-w-0">
          <div className="lg:hidden">
            <LanguageSelector
              value={language}
              onChange={setLanguage}
              label="Song language"
              disabled={moodSessionLocked || loadingSongs}
              compact
            />
          </div>
          <div className="hidden lg:block">
            <LanguageSelector
              value={language}
              onChange={setLanguage}
              label="Song language"
              disabled={moodSessionLocked || loadingSongs}
            />
          </div>
        </div>
      </div>

      {!moodSessionLocked && (
        <>
          <div className="lg:hidden">
            <MoodExpressionGuide activeMood={live.displayMood ?? live.mood} mobileHorizontal />
          </div>
          <div className="hidden lg:block">
            <MoodExpressionGuide activeMood={live.displayMood ?? live.mood} />
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-2 gap-5 min-h-[480px] max-lg:min-h-0 max-lg:gap-4">
        <FaceMoodScanner
          key={scanSession}
          onLiveUpdate={handleLiveUpdate}
          syncing={loadingSongs}
          detectionLocked={moodSessionLocked}
          lockedMood={detectedMood}
        />
        <LiveMoodPanel
          live={live}
          syncing={loadingSongs}
          onScanAgain={handleScanAgain}
          syncedMood={detectedMood}
          sessionLocked={moodSessionLocked}
          therapeuticNote={therapeuticNote}
          playbackMood={playbackMood}
        />
      </div>

      {(detectedMood || loadingSongs || playlist.length > 0) && (
        <MoodPlaybackPanel
          mood={detectedMood || live.displayMood || 'NEUTRAL'}
          language={language}
          songs={playlist}
          loading={loadingSongs}
          error={songError}
          onScanAgain={handleScanAgain}
          confidence={savedConfidence}
          autoPlaying={autoPlaying}
          sessionLocked={moodSessionLocked}
          therapeuticNote={therapeuticNote}
          playbackMood={playbackMood}
        />
      )}

      {detectedMood && autoPlaying && !loadingSongs && playlist.length > 0 && (
        <p className="text-center text-sm text-emerald-300/80 max-lg:text-xs max-lg:leading-relaxed max-lg:px-0.5">
          {MOOD_PROFILES[detectedMood].title} — songs play one after another. Use the player bar to
          pause or skip.
        </p>
      )}
    </div>
  );
}
