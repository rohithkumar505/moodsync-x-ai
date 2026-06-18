import { useEffect, useState } from 'react';
import api from '../api/client';

export function useBackendStatus() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      api.get('/api/health', { timeout: 5000 })
        .then(() => { if (!cancelled) setOnline(true); })
        .catch(() => { if (!cancelled) setOnline(false); });
    };

    check();
    const interval = setInterval(check, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return online;
}
