import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as faceapi from '@vladmandic/face-api';
import type { LiveMoodState } from './LiveMoodPanel';
import {
  canUseCamera,
  cameraErrorMessage,
  getCameraBlockedMessage,
  openCameraStream,
} from '../lib/cameraSecureContext';
import {
  FaceMoodEngine,
  computePostureFromLandmarks,
  expressionsToRecord,
  getLiveMoodDescription,
} from '../lib/faceMoodEngine';
import type { Mood } from '../api/client';
import { MOOD_COLORS, MOOD_EMOJI } from '../api/client';
import { Camera, RefreshCw } from 'lucide-react';

const MODEL_URLS = ['/face-models', 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'];
const SCAN_INTERVAL_MS = 200;
const MISS_GRACE_FRAMES = 4;

const MOOD_BOX_COLORS: Record<Mood, string> = {
  HAPPY: MOOD_COLORS.HAPPY,
  SAD: MOOD_COLORS.SAD,
  ANGRY: MOOD_COLORS.ANGRY,
  RELAXED: MOOD_COLORS.RELAXED,
  NEUTRAL: '#a78bfa',
};

const EMPTY_LIVE: LiveMoodState = {
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

async function loadFaceModels(): Promise<void> {
  let lastError: unknown;
  for (const url of MODEL_URLS) {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(url),
        faceapi.nets.faceExpressionNet.loadFromUri(url),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(url),
      ]);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('Could not load face detection models');
}

interface Props {
  onLiveUpdate: (state: LiveMoodState) => void;
  syncing: boolean;
  detectionLocked?: boolean;
  lockedMood?: Mood | null;
}

export default function FaceMoodScanner({
  onLiveUpdate,
  syncing,
  detectionLocked = false,
  lockedMood = null,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef(new FaceMoodEngine());
  const detectingRef = useRef(false);
  const missFramesRef = useRef(0);

  const [modelsReady, setModelsReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [startingCamera, setStartingCamera] = useState(false);
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);

  const detectorOptions = useMemo(
    () => new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function initModels() {
      setLoadingModels(true);
      setError('');
      try {
        await loadFaceModels();
        if (!cancelled) setModelsReady(true);
      } catch {
        if (!cancelled) {
          setError(
            'AI models failed to load. Run: cd frontend && npm install && npm run dev — then refresh this page.'
          );
        }
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    }

    initModels();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const startCamera = useCallback(async () => {
    if (!modelsReady || startingCamera) return;

    if (!canUseCamera()) {
      setError(getCameraBlockedMessage());
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support camera access. Try Chrome, Safari, or Edge.');
      return;
    }

    setStartingCamera(true);
    setError('');
    engineRef.current.reset();
    onLiveUpdate(EMPTY_LIVE);

    streamRef.current?.getTracks().forEach((t) => t.stop());

    try {
      const stream = await openCameraStream();
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error('Video element not ready — refresh the page');

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      await video.play();
      setCameraOn(true);
    } catch (err) {
      setCameraOn(false);
      setError(cameraErrorMessage(err));
    } finally {
      setStartingCamera(false);
    }
  }, [modelsReady, startingCamera, onLiveUpdate]);

  const detectLive = useCallback(async () => {
    if (detectingRef.current) return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!modelsReady || !video || !overlay || video.readyState < 2) return;

    const displayW = video.clientWidth;
    const displayH = video.clientHeight;
    if (displayW === 0 || displayH === 0) return;

    detectingRef.current = true;
    overlay.width = displayW;
    overlay.height = displayH;

    try {
      const detection = await faceapi
        .detectSingleFace(video, detectorOptions)
        .withFaceLandmarks(true)
        .withFaceExpressions();

      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, displayW, displayH);

      if (!detection) {
        if (detectionLocked) return;
        missFramesRef.current += 1;
        if (missFramesRef.current < MISS_GRACE_FRAMES) return;
        missFramesRef.current = 0;
        engineRef.current.reset();
        onLiveUpdate({ ...EMPTY_LIVE });
        return;
      }

      missFramesRef.current = 0;

      const resized = faceapi.resizeResults(detection, { width: displayW, height: displayH });
      const box = resized.detection.box;

      const rawExpressions: Record<string, number> = {};
      for (const [key, val] of Object.entries(detection.expressions)) {
        rawExpressions[key] = Number(val);
      }

      const posture = computePostureFromLandmarks(
        resized.landmarks?.positions ?? [],
        box,
        displayH
      );

      const result = engineRef.current.process(rawExpressions, posture);
      const expressions = expressionsToRecord(result.smoothedExpressions);
      const displayMood = result.displayMood;
      const description = displayMood
        ? getLiveMoodDescription(
            displayMood,
            result.smoothedExpressions,
            result.dominantExpression,
            result.signals
          )
        : result.moodCue;

      const locked = result.stable && !!displayMood;
      const activeMood = displayMood ?? result.mood;
      const boxColor = activeMood
        ? MOOD_BOX_COLORS[activeMood]
        : result.calibrating
          ? '#fbbf24'
          : '#a78bfa';

      ctx.strokeStyle = locked ? boxColor : result.calibrating ? '#fbbf24' : boxColor;
      ctx.lineWidth = 2;
      ctx.setLineDash(locked ? [] : [6, 4]);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.setLineDash([]);

      const corner = 18;
      ctx.lineWidth = 3;
      const drawCorner = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();
      };
      drawCorner(box.x, box.y + corner, box.x, box.y, box.x + corner, box.y);
      drawCorner(box.x + box.width - corner, box.y, box.x + box.width, box.y, box.x + box.width, box.y + corner);
      drawCorner(box.x, box.y + box.height - corner, box.x, box.y + box.height, box.x + corner, box.y + box.height);
      drawCorner(box.x + box.width - corner, box.y + box.height, box.x + box.width, box.y + box.height, box.x + box.width, box.y + box.height - corner);

      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.fillStyle = locked ? boxColor : '#c4b5fd';
      const label = locked && displayMood
        ? `${displayMood} · ${Math.round(result.confidence * 100)}%`
        : activeMood
          ? `${activeMood} · ${result.framesHeld}/6`
          : result.moodCue || `Reading… ${result.framesHeld}/6`;
      ctx.fillText(label, box.x, Math.max(16, box.y - 8));

      onLiveUpdate({
        mood: result.mood,
        displayMood,
        confidence: result.confidence,
        reliability: result.reliability,
        calibrating: result.calibrating,
        expressions,
        moodScores: result.moodScores,
        dominantExpression: result.dominantExpression,
        faceDetected: true,
        stable: result.stable,
        framesHeld: result.framesHeld,
        liveDescription: description,
        moodCue: result.moodCue,
      });
    } finally {
      detectingRef.current = false;
    }
  }, [modelsReady, detectorOptions, onLiveUpdate, detectionLocked]);

  useEffect(() => {
    if (!modelsReady || !cameraOn || syncing || detectionLocked) return;

    const timer = setInterval(detectLive, SCAN_INTERVAL_MS);
    detectLive();

    return () => clearInterval(timer);
  }, [modelsReady, cameraOn, syncing, detectionLocked, detectLive]);

  const showEnableButton = modelsReady && !cameraOn && !loadingModels;

  return (
    <div className="glass p-4 max-lg:p-3 space-y-3 max-lg:space-y-2.5 h-full flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white/80 min-w-0">
          <Camera size={18} className="shrink-0 max-lg:w-4 max-lg:h-4" />
          <span className="font-medium max-lg:text-sm">Live Face Scanner</span>
        </div>
        {cameraOn && (
          <span className="text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5 text-emerald-400">
            {detectionLocked ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Locked
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </>
            )}
          </span>
        )}
      </div>

      <div className="relative flex-1 min-h-[280px] max-lg:min-h-[12.5rem] max-lg:aspect-[3/4] max-lg:max-h-[min(52dvh,22rem)] rounded-xl overflow-hidden bg-black/60 ring-1 ring-white/10">
        {(loadingModels || startingCamera) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-white/70 bg-black/70">
            <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">
              {loadingModels ? 'Loading AI models...' : 'Starting camera...'}
            </p>
          </div>
        )}

        {showEnableButton && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/75 p-6 max-lg:p-4">
            <Camera size={40} className="text-purple-300 opacity-80 max-lg:w-9 max-lg:h-9" />
            <p className="text-sm text-white/70 text-center max-w-xs max-lg:max-w-none max-lg:text-xs max-lg:leading-relaxed break-words">
              Tap below to allow camera access. Face well-lit, look at the lens, hold still for an accurate mood read.
            </p>
            <button type="button" onClick={startCamera} className="glass-btn flex items-center gap-2">
              <Camera size={18} />
              Enable Camera
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover mirror"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full mirror pointer-events-none z-10"
        />
        <div className="absolute inset-4 border border-white/10 rounded-lg pointer-events-none z-[5]" />
        <div className="absolute bottom-3 left-2 right-2 max-lg:bottom-2 text-center z-[5]">
          <span className="text-[10px] uppercase tracking-wider text-white/40 bg-black/40 px-3 py-1 rounded-full max-lg:text-[9px] max-lg:leading-snug max-lg:normal-case max-lg:tracking-normal inline-block">
            {detectionLocked && lockedMood
              ? `${MOOD_EMOJI[lockedMood]} Mood detected — enjoy your playlist`
              : 'Smoothed expression analysis'}
          </span>
        </div>

        {detectionLocked && (
          <div className="absolute inset-0 z-[15] flex items-center justify-center bg-black/50 pointer-events-none">
            <div className="text-center space-y-2 px-4">
              {lockedMood && (
                <span className="text-5xl block">{MOOD_EMOJI[lockedMood]}</span>
              )}
              <p className="text-emerald-300 font-semibold text-sm max-lg:text-xs">Mood locked</p>
              <p className="text-white/60 text-xs max-lg:leading-relaxed">Scanning stopped — songs play automatically</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="space-y-2">
          <p className="text-red-400 text-sm text-center leading-relaxed">{error}</p>
          {modelsReady && (
            <button
              type="button"
              onClick={startCamera}
              className="w-full flex items-center justify-center gap-2 text-sm text-purple-300 hover:text-purple-200 py-2"
            >
              <RefreshCw size={14} />
              Retry camera
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-white/45 text-center leading-relaxed max-lg:text-[11px] max-lg:px-0.5 break-words">
        {detectionLocked
          ? 'Detection complete. Tap Scan again below to detect a new mood.'
          : cameraOn
            ? 'Smile=Happy · frown+look down=Sad · tense face=Angry · relax=Calm. Hold 2 sec.'
            : 'Camera permission is required for live mood detection.'}
      </p>

      <style>{`.mirror { transform: scaleX(-1); }`}</style>
    </div>
  );
}
