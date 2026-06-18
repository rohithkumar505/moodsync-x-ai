import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  Flame,
  ListMusic,
  LogOut,
  Mail,
  RefreshCw,
  Save,
  Shield,
  Trophy,
  User,
} from 'lucide-react';
import api, { getApiErrorMessage, MOOD_EMOJI, validatePassword, type Mood } from '../api/client';
import LanguageSelector from '../components/LanguageSelector';
import { useAuth } from '../context/AuthContext';
import { normalizeProfileBundle, type ProfileBundle } from '../lib/profileApi';
import type { Language } from '../types/music';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
}

function formatMemberSince(iso?: string | null) {
  if (!iso) return 'Recently joined';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMoodLabel(mood: string) {
  return mood.charAt(0) + mood.slice(1).toLowerCase();
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-pulse max-lg:space-y-4">
      <div className="h-36 rounded-2xl bg-white/5 max-lg:h-28" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-lg:gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5 max-lg:h-20" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-white/5 max-lg:h-64" />
    </div>
  );
}

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<Language>('English');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/profile');
      const normalized = normalizeProfileBundle(data);
      if (!normalized) {
        setError('Unexpected profile response from server');
        setBundle(null);
        return;
      }
      setBundle(normalized);
      setName(normalized.user.name);
      setLanguage((normalized.user.preferredLanguage as Language) || 'English');
    } catch (err) {
      setBundle(null);
      setError(getApiErrorMessage(err, 'Could not load profile'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!bundle) return false;
    const nameChanged = name.trim() !== bundle.user.name;
    const langChanged = language !== (bundle.user.preferredLanguage || 'English');
    const passwordChanged = password.length > 0;
    return nameChanged || langChanged || passwordChanged;
  }, [bundle, name, language, password]);

  const save = async () => {
    setMessage('');
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name cannot be empty');
      return;
    }

    if (password) {
      const pwdErr = validatePassword(password);
      if (pwdErr) {
        setError(pwdErr);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: trimmedName,
        preferredLanguage: language,
      };
      if (password) payload.password = password;

      const { data } = await api.patch('/api/profile', payload);
      const updated = normalizeProfileBundle(data);
      if (!updated) {
        throw new Error('Unexpected response after save');
      }

      setBundle(updated);
      setUser(updated.user);
      setPassword('');
      setConfirmPassword('');
      setMessage(`Profile saved. Song recommendations will use ${language}.`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) return <ProfileSkeleton />;

  if (error && !bundle) {
    return (
      <div className="max-w-3xl mx-auto glass rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <User size={36} className="mx-auto mb-3 text-red-300/50" />
        <p className="text-red-200 font-medium mb-2">Profile unavailable</p>
        <p className="text-sm text-red-200/70 mb-4">{error}</p>
        <button type="button" onClick={load} className="glass-btn text-sm inline-flex items-center gap-2">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }

  if (!bundle) return null;

  const { stats, currentMood } = bundle;
  const email = bundle.user.email || user?.email || '';

  return (
    <div className="w-full space-y-5 lg:space-y-6 profile-mobile max-lg:space-y-4 min-w-0">
      <header className="glass rounded-2xl border border-white/10 p-4 sm:p-5 lg:p-6 max-lg:p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 max-lg:gap-3">
          <div className="flex items-start gap-4 min-w-0 max-lg:gap-3">
            <div className="w-16 h-16 max-lg:w-14 max-lg:h-14 rounded-2xl bg-gradient-to-br from-violet-500/40 to-fuchsia-500/30 border border-white/15 flex items-center justify-center text-xl max-lg:text-lg font-bold shrink-0">
              {initials(bundle.user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="hidden lg:flex items-center gap-2 text-sky-300/80 text-sm mb-1">
                <User size={16} />
                Account
              </div>
              <p className="lg:hidden text-xs text-sky-300/80 font-medium mb-1">Your account</p>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words leading-tight">{bundle.user.name}</h1>
              <p className="text-sm text-white/50 mt-1 flex items-start gap-1.5 max-lg:text-xs max-lg:leading-relaxed break-all">
                <Mail size={14} className="shrink-0 mt-0.5" />
                <span className="min-w-0">{email}</span>
              </p>
              <p className="text-xs text-white/35 mt-1 flex items-start gap-1.5 max-lg:leading-relaxed break-words">
                <Calendar size={12} className="shrink-0 mt-0.5" />
                <span>
                  Member since {formatMemberSince(bundle.user.createdAt)}
                  {stats.memberDays > 0 ? ` · ${stats.memberDays} days` : ''}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            className="self-start p-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white"
            aria-label="Refresh profile"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-lg:gap-2.5">
        <div className="glass rounded-xl border border-white/10 p-4 max-lg:p-3 min-w-0">
          <p className="text-xs text-white/45 uppercase tracking-wide max-lg:normal-case max-lg:tracking-normal">Check-ins</p>
          <p className="text-2xl font-bold mt-1 max-lg:text-xl">{stats.totalMoodChecks}</p>
        </div>
        <div className="glass rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 max-lg:p-3 min-w-0">
          <p className="text-xs text-orange-200/70 uppercase tracking-wide flex items-center gap-1 max-lg:normal-case max-lg:tracking-normal">
            <Flame size={12} /> Streak
          </p>
          <p className="text-2xl font-bold mt-1 max-lg:text-xl">{stats.streakDays}d</p>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4 max-lg:p-3 min-w-0">
          <p className="text-xs text-white/45 uppercase tracking-wide flex items-center gap-1 max-lg:normal-case max-lg:tracking-normal">
            <BookOpen size={12} /> Journals
          </p>
          <p className="text-2xl font-bold mt-1 max-lg:text-xl">{stats.journalCount}</p>
        </div>
        <div className="glass rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 max-lg:p-3 min-w-0">
          <p className="text-xs text-emerald-200/70 uppercase tracking-wide flex items-center gap-1 max-lg:normal-case max-lg:tracking-normal">
            <Trophy size={12} /> Badges
          </p>
          <p className="text-2xl font-bold mt-1 max-lg:text-xl">{stats.achievementsUnlocked}</p>
        </div>
      </div>

      {currentMood ? (
        <section className="glass rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 sm:p-5 max-lg:p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-lg:gap-2.5 min-w-0">
          <div className="min-w-0">
            <p className="text-xs text-violet-200/70 uppercase tracking-wide mb-1 max-lg:normal-case max-lg:tracking-normal">Latest mood</p>
            <p className="text-lg font-semibold flex items-center gap-2 max-lg:text-base">
              {MOOD_EMOJI[currentMood.mood as Mood]} {formatMoodLabel(currentMood.mood)}
            </p>
          </div>
          <Link to="/history" className="text-sm text-violet-300 hover:text-violet-200 max-lg:text-xs shrink-0">
            View mood history →
          </Link>
        </section>
      ) : null}

      <section className="glass rounded-xl border border-white/10 p-5 sm:p-6 max-lg:p-3.5 space-y-5 max-lg:space-y-4 min-w-0">
        <div>
          <h2 className="text-lg font-semibold max-lg:text-base">Account settings</h2>
          <p className="text-sm text-white/50 mt-1 max-lg:text-xs max-lg:leading-relaxed">Update your display name, song language, or password.</p>
        </div>

        <div>
          <label htmlFor="profile-name" className="text-sm text-white/60 block mb-2">
            Display name
          </label>
          <input
            id="profile-name"
            className="glass-input w-full"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div className="lg:hidden">
          <LanguageSelector
            value={language}
            onChange={setLanguage}
            label="Preferred song language"
            compact
          />
        </div>
        <div className="hidden lg:block">
          <LanguageSelector value={language} onChange={setLanguage} label="Preferred song language" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 max-lg:grid-cols-1 max-lg:gap-3">
          <div>
            <label htmlFor="profile-password" className="text-sm text-white/60 block mb-2">
              New password
            </label>
            <input
              id="profile-password"
              className="glass-input w-full"
              type="password"
              placeholder="Leave blank to keep current"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="profile-confirm" className="text-sm text-white/60 block mb-2">
              Confirm password
            </label>
            <input
              id="profile-confirm"
              className="glass-input w-full"
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <p className="text-xs text-white/40 flex items-start gap-2 max-lg:leading-relaxed break-words">
          <Shield size={14} className="shrink-0 mt-0.5" />
          Password must be at least 8 characters with one uppercase letter and one number.
        </p>

        {error ? (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 max-lg:text-xs break-words">{error}</p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 max-lg:text-xs break-words">{message}</p>
        ) : null}

        <button
          type="button"
          className="glass-btn w-full sm:w-auto max-lg:w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
          onClick={save}
          disabled={saving || !dirty}
        >
          <Save size={16} />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </section>

      <section className="glass rounded-xl border border-white/10 p-5 max-lg:p-3.5 min-w-0">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3 max-lg:normal-case max-lg:tracking-normal max-lg:text-base">
          Quick links
        </h2>
        <div className="hidden lg:grid lg:grid-cols-3 gap-2 text-sm">
          <Link to="/playlists" className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center gap-2">
            <ListMusic size={14} /> Playlists ({stats.playlistCount})
          </Link>
          <Link to="/achievements" className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center gap-2">
            <Trophy size={14} /> Achievements
          </Link>
          <Link to="/reports" className="px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center gap-2">
            <Calendar size={14} /> Reports
          </Link>
        </div>
        <div className="lg:hidden profile-mobile-links">
          <Link to="/playlists" className="profile-mobile-link">
            <ListMusic size={16} className="shrink-0 text-purple-300" />
            <span className="min-w-0 truncate">Playlists ({stats.playlistCount})</span>
          </Link>
          <Link to="/achievements" className="profile-mobile-link">
            <Trophy size={16} className="shrink-0 text-amber-300" />
            <span className="min-w-0 truncate">Achievements</span>
          </Link>
          <Link to="/reports" className="profile-mobile-link">
            <Calendar size={16} className="shrink-0 text-sky-300" />
            <span className="min-w-0 truncate">Reports</span>
          </Link>
        </div>
      </section>

      <section className="glass rounded-xl border border-red-500/20 bg-red-500/5 p-5 max-lg:p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-lg:gap-2.5 min-w-0">
        <div className="min-w-0">
          <p className="font-medium text-red-100 max-lg:text-sm">Sign out</p>
          <p className="text-sm text-red-200/60 max-lg:text-xs max-lg:leading-relaxed">End your session on this device.</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 inline-flex items-center justify-center gap-2 text-sm max-lg:w-full"
        >
          <LogOut size={14} /> Log out
        </button>
      </section>
    </div>
  );
}
