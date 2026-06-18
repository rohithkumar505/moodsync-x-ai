import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import api, { getApiErrorMessage } from '../../api/client';
import type { AdminActivityItem } from '../../lib/adminApi';

export default function AdminActivityPage() {
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<{ items: AdminActivityItem[] }>('/api/admin/activity', {
        params: { limit: 200 },
      });
      setItems(data.items);
    } catch (err) {
      setItems([]);
      setError(getApiErrorMessage(err, 'Could not load activity'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold">Live Activity</h1>
          <p className="text-sm text-white/50 mt-1">
            Logins, mood checks, page views — everything users do (auto-refreshes every 15s)
          </p>
        </div>
        <button type="button" onClick={load} className="p-2 rounded-lg border border-white/10 bg-white/5">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {error ? <p className="text-red-300 text-sm">{error}</p> : null}

      <div className="glass rounded-xl border border-white/10 divide-y divide-white/5">
        {items.length === 0 && !loading ? (
          <p className="p-8 text-center text-white/40">No activity recorded yet</p>
        ) : (
          items.map((a) => (
            <div key={a.id} className="p-4 hover:bg-white/5 transition">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="text-amber-200 font-medium capitalize">{a.action.replace(/_/g, ' ')}</span>
                  <p className="text-sm text-white/60 mt-0.5">
                    {a.userName}{' '}
                    <Link to={`/admin/users/${a.userId}`} className="text-sky-300 hover:underline">
                      ({a.userEmail})
                    </Link>
                  </p>
                </div>
                <span className="text-xs text-white/40 shrink-0">
                  {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                </span>
              </div>
              {a.detail ? <p className="text-sm text-white/45 mt-2">{a.detail}</p> : null}
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-white/30">
                {a.ipAddress ? <span>IP: {a.ipAddress}</span> : null}
                {a.userAgent ? <span className="truncate max-w-md">UA: {a.userAgent}</span> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
