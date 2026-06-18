import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, BookOpen, Heart, RefreshCw, Users } from 'lucide-react';
import api, { getApiErrorMessage } from '../../api/client';
import type { AdminDashboard } from '../../lib/adminApi';

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get<AdminDashboard>('/api/admin/dashboard');
      setData(res);
    } catch (err) {
      setData(null);
      setError(getApiErrorMessage(err, 'Could not load dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return <div className="animate-pulse h-64 glass rounded-xl" />;
  }

  if (error || !data) {
    return (
      <div className="glass border border-red-500/30 p-8 text-center rounded-xl">
        <p className="text-red-200 mb-3">{error}</p>
        <button type="button" onClick={load} className="glass-btn text-sm inline-flex items-center gap-2">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const { summary, recentActivity, recentUsers } = data;

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-white/50 mt-1">Full visibility into all MoodSync users and activity</p>
        </div>
        <button type="button" onClick={load} className="p-2 rounded-lg border border-white/10 bg-white/5">
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Users" value={summary.totalUsers} color="amber" />
        <StatCard icon={Heart} label="Mood checks" value={summary.totalMoodChecks} />
        <StatCard icon={BookOpen} label="Journals" value={summary.totalJournals} />
        <StatCard icon={Activity} label="Achievements" value={summary.totalAchievements} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="glass rounded-xl border border-white/10 p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users size={16} className="text-amber-300" />
            Recent users
          </h2>
          <div className="space-y-2">
            {recentUsers.map((u) => (
              <Link
                key={u.id}
                to={`/admin/users/${u.id}`}
                className="block p-3 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/30 transition"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-xs text-amber-300 font-mono">{u.passwordPlain}</span>
                </div>
                <p className="text-xs text-white/45 mt-1">{u.email}</p>
              </Link>
            ))}
            {recentUsers.length === 0 ? <p className="text-sm text-white/40">No users yet</p> : null}
          </div>
          <Link to="/admin/users" className="text-sm text-amber-300 mt-3 inline-block">
            View all users →
          </Link>
        </section>

        <section className="glass rounded-xl border border-white/10 p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Activity size={16} className="text-sky-300" />
            Live activity
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentActivity.map((a) => (
              <div key={a.id} className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-amber-200 capitalize">{a.action.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-white/40 shrink-0">{formatWhen(a.createdAt)}</span>
                </div>
                <p className="text-white/60 mt-1">{a.userName || 'User'} · {a.userEmail}</p>
                {a.detail ? <p className="text-xs text-white/40 mt-1">{a.detail}</p> : null}
              </div>
            ))}
          </div>
          <Link to="/admin/activity" className="text-sm text-amber-300 mt-3 inline-block">
            Full activity log →
          </Link>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  color?: string;
}) {
  const border = color === 'amber' ? 'border-amber-500/25 bg-amber-500/5' : 'border-white/10';
  return (
    <div className={`glass rounded-xl border p-4 ${border}`}>
      <p className="text-xs text-white/45 uppercase tracking-wide flex items-center gap-1">
        <Icon size={12} /> {label}
      </p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
