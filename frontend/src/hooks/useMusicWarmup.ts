import { useEffect } from 'react';
import api from '../api/client';

let warmed = false;

export function useMusicWarmup(enabled: boolean) {
  useEffect(() => {
    if (!enabled || warmed) return;
    warmed = true;
    api.post('/api/music/warm').catch(() => undefined);
  }, [enabled]);
}
