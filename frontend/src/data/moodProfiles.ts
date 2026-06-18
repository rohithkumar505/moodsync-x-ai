import type { Mood } from '../api/client';
import { MOOD_COLORS, MOOD_EMOJI } from '../api/client';

export interface MoodProfile {
  title: string;
  tagline: string;
  description: string;
  musicVibe: string;
  wellnessTip: string;
  gradient: string;
  glow: string;
}

export const MOOD_PROFILES: Record<Mood, MoodProfile> = {
  HAPPY: {
    title: 'Happy & Smiling',
    tagline: 'Smile, laugh, shine — we see your joy',
    description:
      'Your smile or laugh is clear on camera — cheeks up, bright eyes, positive energy. This is real happy detection, not a guess. Upbeat feel-good music matches this mood.',
    musicVibe: 'Arijit Singh, Jubin Nautiyal, Atif Aslam & Armaan Malik — upbeat romantic hits',
    wellnessTip: 'Ride this wave — share a moment with someone or jot down what made you smile today.',
    gradient: 'from-amber-500/30 via-orange-500/20 to-yellow-400/10',
    glow: MOOD_COLORS.HAPPY,
  },
  SAD: {
    title: 'Feeling Low',
    tagline: 'We hear you — playing happy songs to lift you up',
    description:
      'You look sad or down. Instead of sad songs, we play upbeat happy tracks from Arijit, Jubin, Atif & more — real music therapy to cheer you up.',
    musicVibe: 'Happy uplifting hits — Arijit, Jubin, Atif, Armaan Malik & more',
    wellnessTip: 'Let the music lift you gently. You deserve to feel better.',
    gradient: 'from-blue-500/30 via-indigo-500/20 to-slate-400/10',
    glow: MOOD_COLORS.SAD,
  },
  ANGRY: {
    title: 'Tense & Fired Up',
    tagline: 'Cooling you down with calm music',
    description:
      'You look tense or angry. We play soft, peaceful calm songs — not intense tracks — to help your mind settle and relax.',
    musicVibe: 'Calm peaceful songs — Jubin, Atif, Arijit soft melodies',
    wellnessTip: 'Breathe slowly with the music. Calm songs help release tension.',
    gradient: 'from-red-500/30 via-rose-500/20 to-orange-600/10',
    glow: MOOD_COLORS.ANGRY,
  },
  RELAXED: {
    title: 'Calm & Peaceful',
    tagline: 'Not happy, not sad — just calm',
    description:
      'Your face is soft and steady — no big smile, no sadness. This is the calm zone: peaceful, relaxed, mind at ease. Mellow soothing music fits perfectly.',
    musicVibe: 'Jubin Nautiyal & Arijit Singh — soft acoustic melodies',
    wellnessTip: 'Savor this calm. A few mindful breaths can deepen this relaxed feeling.',
    gradient: 'from-emerald-500/30 via-teal-500/20 to-green-400/10',
    glow: MOOD_COLORS.RELAXED,
  },
  NEUTRAL: {
    title: 'Balanced & Steady',
    tagline: 'Even, composed expression',
    description:
      'Your expression is balanced — neither clearly smiling nor clearly sad. Versatile tracks that won\'t push your mood too hard either way.',
    musicVibe: 'Arijit Singh, Jubin Nautiyal & Atif Aslam — top chart hits',
    wellnessTip: 'Neutral is a great baseline. Check in — how does your body feel right now?',
    gradient: 'from-slate-400/25 via-zinc-500/15 to-gray-400/10',
    glow: MOOD_COLORS.NEUTRAL,
  },
};

export const EXPRESSION_LABELS: Record<string, string> = {
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  fearful: 'Fearful',
  disgusted: 'Disgusted',
  surprised: 'Surprised',
  neutral: 'Neutral',
};

export function formatMoodLabel(mood: Mood): string {
  return MOOD_PROFILES[mood].title;
}

export function getMoodEmoji(mood: Mood): string {
  return MOOD_EMOJI[mood];
}
