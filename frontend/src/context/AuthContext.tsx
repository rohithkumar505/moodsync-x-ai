import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { isAxiosError } from 'axios';
import api from '../api/client';
import { extractProfileUser, type ProfileUser } from '../lib/profileApi';

interface User extends ProfileUser {}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, preferredLanguage?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
const PROFILE_CACHE_KEY = 'moodsync_profile';

function readCachedProfile(): User | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    return parsed?.id && parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(user: User | null) {
  try {
    if (!user) {
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
      return;
    }
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user));
  } catch {
    // sessionStorage may be unavailable in private mode
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedProfile = readCachedProfile();
  const [user, setUserState] = useState<User | null>(cachedProfile);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token') && !cachedProfile));
  const freshSession = useRef(false);

  const setUser = (next: User) => {
    setUserState(next);
    writeCachedProfile(next);
  };

  const clearSession = () => {
    localStorage.removeItem('token');
    writeCachedProfile(null);
    setToken(null);
    setUserState(null);
  };

  const applySession = (newToken: string, newUser: User) => {
    freshSession.current = true;
    localStorage.setItem('token', newToken);
    writeCachedProfile(newUser);
    setToken(newToken);
    setUserState(newUser);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    if (freshSession.current) {
      freshSession.current = false;
      setLoading(false);
      return;
    }

    let cancelled = false;
    if (!user) setLoading(true);

    api.get('/api/profile')
      .then((r) => {
        const profileUser = extractProfileUser(r.data);
        if (!cancelled && profileUser) setUser(profileUser);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = isAxiosError(err) ? err.response?.status : undefined;
        if (status === 401 || status === 404 || status === 422) {
          clearSession();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    applySession(data.token, data.user);
    return data.user as User;
  };

  const register = async (name: string, email: string, password: string, preferredLanguage = 'English') => {
    const { data } = await api.post('/api/auth/register', {
      name,
      email,
      password,
      preferredLanguage,
    });
    applySession(data.token, data.user);
  };

  const logout = () => {
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAdmin: Boolean(user?.isAdmin),
        login,
        register,
        logout,
        setUser,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
