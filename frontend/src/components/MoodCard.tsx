import type { Mood } from '../api/client';
import { MOOD_COLORS, MOOD_EMOJI } from '../api/client';
import { MOOD_PROFILES } from '../data/moodProfiles';

interface Props {
  mood: Mood;
  confidence?: number;
  label?: string;
  large?: boolean;
}

export default function MoodCard({ mood, confidence, label, large }: Props) {
  const profile = MOOD_PROFILES[mood];

  return (
    <div
      className={`glass p-5 sm:p-6 mood-${mood} rounded-xl border ${large ? 'min-h-[160px]' : ''}`}
      style={{
        borderColor: `${MOOD_COLORS[mood]}44`,
        background: large
          ? `linear-gradient(135deg, ${MOOD_COLORS[mood]}18 0%, transparent 60%)`
          : undefined,
      }}
    >
      <div className="flex items-center gap-4">
        <span
          className={`${large ? 'text-5xl sm:text-6xl' : 'text-3xl'} drop-shadow-lg`}
          role="img"
          aria-label={mood}
        >
          {MOOD_EMOJI[mood]}
        </span>
        <div className="min-w-0">
          <p className="text-white/50 text-xs uppercase tracking-wide">{label || 'Current mood'}</p>
          <p className={`font-bold ${large ? 'text-2xl sm:text-3xl' : 'text-xl'}`} style={{ color: MOOD_COLORS[mood] }}>
            {profile?.title || formatMoodLabel(mood)}
          </p>
          {large && profile?.tagline && (
            <p className="text-sm text-white/55 mt-1 line-clamp-2">{profile.tagline}</p>
          )}
          {confidence !== undefined && (
            <p className="text-sm text-white/45 mt-1">
              {Math.round(confidence * 100)}% confidence
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMoodLabel(mood: Mood): string {
  return mood.charAt(0) + mood.slice(1).toLowerCase();
}
