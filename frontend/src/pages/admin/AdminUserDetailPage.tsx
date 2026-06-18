import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Key, RefreshCw } from 'lucide-react';
import api, { getApiErrorMessage, MOOD_EMOJI, type Mood } from '../../api/client';
import type { AdminUserDetail } from '../../lib/adminApi';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get<AdminUserDetail>(`/api/admin/users/${id}`);
      setData(res);
    } catch (err) {
      setData(null);
      setError(getApiErrorMessage(err, 'Could not load user'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="animate-pulse h-96 glass rounded-xl" />;

  if (error || !data) {
    return (
      <div className="glass p-8 text-center rounded-xl border border-red-500/30">
        <p className="text-red-200 mb-3">{error}</p>
        <Link to="/admin/users" className="text-amber-300 text-sm">← Back to users</Link>
      </div>
    );
  }

  const { user, moods, journals, playlists, achievements, activities } = data;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link to="/admin/users" className="text-sm text-white/50 hover:text-white inline-flex items-center gap-1">
        <ArrowLeft size={14} /> All users
      </Link>

      <header className="glass rounded-xl border border-amber-500/20 p-6">
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <p className="text-white/60 mt-1">{user.email}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25">
            <Key size={14} className="text-amber-300" />
            Password: <code className="font-mono text-amber-200">{user.passwordPlain}</code>
          </span>
          <span className="text-white/50">Language: {user.preferredLanguage}</span>
          <span className="text-white/50">Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4 text-center text-sm">
          <MiniStat label="Moods" value={user.stats.moodChecks} />
          <MiniStat label="Journals" value={user.stats.journals} />
          <MiniStat label="Playlists" value={user.stats.playlists} />
          <MiniStat label="Badges" value={user.stats.achievements} />
        </div>
        <button type="button" onClick={load} className="mt-4 text-xs text-white/40 hover:text-white inline-flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
      </header>

      <Section title={`Mood history (${moods.length})`}>
        {moods.length ? (
          <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {moods.map((m) => (
              <li key={m.id} className="p-2 rounded-lg bg-white/5 flex justify-between gap-2">
                <span>
                  {MOOD_EMOJI[m.mood as Mood]} {m.mood} · {m.source}
                </span>
                <span className="text-white/40 text-xs">{m.date ? new Date(m.date).toLocaleString() : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-white/40 text-sm">No moods</p>
        )}
      </Section>

      <Section title={`Journals (${journals.length})`}>
        {journals.map((j) => (
          <div key={j.id} className="p-3 rounded-lg bg-white/5 mb-2 text-sm">
            <p className="text-white/80">{j.journalText}</p>
            <p className="text-xs text-white/40 mt-1">{j.detectedMood} · {j.date}</p>
          </div>
        ))}
        {!journals.length ? <p className="text-white/40 text-sm">No journals</p> : null}
      </Section>

      <Section title={`Playlists (${playlists.length})`}>
        {playlists.map((p) => (
          <div key={p.id} className="p-3 rounded-lg bg-white/5 mb-2 text-sm">
            <p className="font-medium">{p.playlistName}</p>
            <p className="text-xs text-white/40">{p.songs?.length ?? 0} songs</p>
          </div>
        ))}
        {!playlists.length ? <p className="text-white/40 text-sm">No playlists</p> : null}
      </Section>

      <Section title={`Achievements (${achievements.length})`}>
        <div className="flex flex-wrap gap-2">
          {achievements.map((a, i) => (
            <span key={i} className="px-2 py-1 rounded-full bg-white/10 text-xs">
              🏆 {a.achievementName}
            </span>
          ))}
        </div>
        {!achievements.length ? <p className="text-white/40 text-sm">None</p> : null}
      </Section>

      <Section title={`Activity log (${activities.length})`}>
        <ul className="space-y-2 text-sm max-h-72 overflow-y-auto">
          {activities.map((a) => (
            <li key={a.id} className="p-2 rounded-lg bg-white/5">
              <div className="flex justify-between">
                <span className="capitalize text-amber-200">{a.action.replace(/_/g, ' ')}</span>
                <span className="text-xs text-white/40">{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</span>
              </div>
              {a.detail ? <p className="text-xs text-white/50 mt-1">{a.detail}</p> : null}
              {a.ipAddress ? <p className="text-xs text-white/30">IP: {a.ipAddress}</p> : null}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-xl border border-white/10 p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2 rounded-lg bg-white/5">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-white/40">{label}</p>
    </div>
  );
}
