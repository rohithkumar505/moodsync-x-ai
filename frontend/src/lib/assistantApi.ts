import type { Song } from '../types/music';

export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantResponse {
  reply: string;
  songs: Song[];
  suggestions?: string[];
  intent?: string;
  detectedMood?: string | null;
  moodEmoji?: string | null;
  playNow?: boolean;
}

export const MOOD_ASSISTANT_EMOJI: Record<string, string> = {
  HAPPY: '😊',
  SAD: '😔',
  ANGRY: '😡',
  RELAXED: '😌',
  NEUTRAL: '😐',
};

export const QUICK_PROMPTS = [
  { label: '😔 Feeling sad', text: "I'm sad, please suggest some comforting songs" },
  { label: '😊 Feeling happy', text: "I'm happy today! Suggest upbeat songs" },
  { label: '🎢 Mood swing', text: 'Mood swing — suggest a mixed playlist' },
  { label: '😌 Need calm', text: 'I feel stressed, suggest calm relaxing music' },
  { label: '🎤 Arijit Singh', text: 'Play Arijit Singh songs' },
  { label: '🎬 RRR movie', text: 'Songs from RRR movie' },
] as const;
