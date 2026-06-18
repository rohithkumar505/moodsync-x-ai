import axios, { isAxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

/** Longer timeout for music search / stream resolution. */
export const musicApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000,
});

function attachAuth(config: import('axios').InternalAxiosRequestConfig) {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}

api.interceptors.request.use(attachAuth);
musicApi.interceptors.request.use(attachAuth);

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Check your connection and try again.';
    }
    if (!error.response) {
      return 'Cannot reach the server. Start the backend with: cd backend && source venv/bin/activate && python app.py';
    }
    if (error.response.status === 401) return 'Invalid email or password';
    if (error.response.status === 409 && !(data && typeof data === 'object' && 'error' in data)) {
      return 'Email already registered';
    }
    if (error.response.status === 503) {
      const data = error.response?.data;
      if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
        return data.error;
      }
      return 'Database is not ready. Run: docker compose up -d db then restart the backend.';
    }
    if (error.response.status === 429) {
      return 'Too many requests. Wait a minute and refresh the page.';
    }
  }
  return fallback;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  return null;
}

export default api;

export const MOODS = ['HAPPY', 'SAD', 'ANGRY', 'RELAXED', 'NEUTRAL'] as const;
export type Mood = typeof MOODS[number];

export const MOOD_EMOJI: Record<Mood, string> = {
  HAPPY: '😊',
  SAD: '😔',
  ANGRY: '😡',
  RELAXED: '😌',
  NEUTRAL: '😐',
};

export const MOOD_COLORS: Record<Mood, string> = {
  HAPPY: '#f59e0b',
  SAD: '#3b82f6',
  ANGRY: '#ef4444',
  RELAXED: '#22c55e',
  NEUTRAL: '#9ca3af',
};
