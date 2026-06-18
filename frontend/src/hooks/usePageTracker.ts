import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const DEBOUNCE_MS = 900;
let lastTrackedPath = '';

/** Log page views for admin activity feed (best-effort, debounced). */
export function usePageTracker() {
  const { token, user } = useAuth();
  const location = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token || user?.isAdmin) return;

    const path = location.pathname;
    if (path === lastTrackedPath) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      lastTrackedPath = path;
      api
        .post('/api/activity/track', { action: 'page_view', detail: path })
        .catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname, token, user?.isAdmin]);
}
