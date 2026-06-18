export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  preferredLanguage?: string;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  passwordPlain?: string;
  stats: {
    moodChecks: number;
    journals: number;
    playlists: number;
    achievements: number;
  };
}

export interface AdminActivityItem {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  action: string;
  detail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | null;
}

export interface AdminDashboard {
  summary: {
    totalUsers: number;
    totalMoodChecks: number;
    totalJournals: number;
    totalPlaylists: number;
    totalAchievements: number;
    activeToday: number;
  };
  recentActivity: AdminActivityItem[];
  recentUsers: AdminUserRow[];
}

export interface AdminUserDetail {
  user: AdminUserRow;
  moods: { id: string; mood: string; date?: string; source?: string; confidence?: number; journalText?: string }[];
  journals: { id: string; journalText: string; detectedMood: string; date: string }[];
  playlists: { id: string; playlistName: string; songs?: unknown[] }[];
  achievements: { achievementName: string; description: string; date?: string }[];
  activities: AdminActivityItem[];
}
