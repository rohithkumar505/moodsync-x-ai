import type { Mood } from '../api/client';

const KEYWORDS: Record<Mood, string[]> = {
  HAPPY: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'glad', 'cheerful', 'grateful'],
  SAD: ['sad', 'depressed', 'lonely', 'cry', 'unhappy', 'miserable', 'grief', 'down', 'hurt', 'tired'],
  ANGRY: ['angry', 'furious', 'mad', 'rage', 'annoyed', 'frustrated', 'hate', 'irritated', 'stress'],
  RELAXED: ['relaxed', 'calm', 'peaceful', 'chill', 'serene', 'tranquil', 'easy', 'rested', 'quiet'],
  NEUTRAL: ['okay', 'fine', 'normal', 'neutral', 'alright', 'meh', 'average', 'usual'],
};

export function hintMoodFromText(text: string): { mood: Mood; confidence: number } | null {
  const lowered = text.toLowerCase().trim();
  if (lowered.length < 12) return null;

  const scores: Record<Mood, number> = {
    HAPPY: 0,
    SAD: 0,
    ANGRY: 0,
    RELAXED: 0,
    NEUTRAL: 0,
  };

  for (const [mood, words] of Object.entries(KEYWORDS) as [Mood, string[]][]) {
    for (const word of words) {
      if (lowered.includes(word)) scores[mood] += 1;
    }
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const mood = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as Mood;
  const confidence = Math.min(0.92, 0.45 + (scores[mood] / total) * 0.5);
  return { mood, confidence };
}
