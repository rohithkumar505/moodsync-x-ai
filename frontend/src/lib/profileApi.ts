export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  preferredLanguage?: string;
  createdAt?: string | null;
  isAdmin?: boolean;
  lastLoginAt?: string | null;
}

export interface ProfileStats {
  totalMoodChecks: number;
  streakDays: number;
  journalCount: number;
  playlistCount: number;
  achievementsUnlocked: number;
  memberDays: number;
}

export interface ProfileBundle {
  user: ProfileUser;
  stats: ProfileStats;
  currentMood: { mood: string; date?: string } | null;
}

const EMPTY_STATS: ProfileStats = {
  totalMoodChecks: 0,
  streakDays: 0,
  journalCount: 0,
  playlistCount: 0,
  achievementsUnlocked: 0,
  memberDays: 0,
};

function isProfileUser(value: unknown): value is ProfileUser {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    typeof (value as ProfileUser).email === 'string'
  );
}

/** Accept bundle or legacy flat user object from `/api/profile`. */
export function normalizeProfileBundle(data: unknown): ProfileBundle | null {
  if (!data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;

  if (raw.user && isProfileUser(raw.user)) {
    const stats = (raw.stats as ProfileStats) || EMPTY_STATS;
    return {
      user: raw.user,
      stats: { ...EMPTY_STATS, ...stats },
      currentMood: (raw.currentMood as ProfileBundle['currentMood']) ?? null,
    };
  }

  if (isProfileUser(raw)) {
    return {
      user: raw,
      stats: EMPTY_STATS,
      currentMood: null,
    };
  }

  return null;
}

export function extractProfileUser(data: unknown): ProfileUser | null {
  return normalizeProfileBundle(data)?.user ?? null;
}
