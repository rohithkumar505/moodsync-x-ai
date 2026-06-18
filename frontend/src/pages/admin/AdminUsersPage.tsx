import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Key, RefreshCw, Search } from 'lucide-react';
import api, { getApiErrorMessage } from '../../api/client';
import type { AdminUserRow } from '../../lib/adminApi';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<{ users: AdminUserRow[] }>('/api/admin/users');
      setUsers(data.users);
    } catch (err) {
      setUsers([]);
      setError(getApiErrorMessage(err, 'Could not load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-bold">All Users</h1>
        <p className="text-sm text-white/50 mt-1">
          Every registered user — emails, passwords, stats, and full detail on click
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            className="glass-input pl-10"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="button" onClick={load} className="p-2.5 rounded-lg border border-white/10 bg-white/5">
          <RefreshCw size={16} />
        </button>
      </div>

      {error ? <p className="text-red-300 text-sm">{error}</p> : null}

      <div className="glass rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/45 border-b border-white/10 bg-white/5">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">
                <span className="flex items-center gap-1">
                  <Key size={12} /> Password
                </span>
              </th>
              <th className="p-3 font-medium">Language</th>
              <th className="p-3 font-medium">Moods</th>
              <th className="p-3 font-medium">Last login</th>
              <th className="p-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/40">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/40">
                  No users found
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-white/60">{u.email}</td>
                  <td className="p-3 font-mono text-amber-300 text-xs">{u.passwordPlain || '—'}</td>
                  <td className="p-3 text-white/50">{u.preferredLanguage}</td>
                  <td className="p-3">{u.stats.moodChecks}</td>
                  <td className="p-3 text-white/40 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="p-3">
                    <Link
                      to={`/admin/users/${u.id}`}
                      className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 text-xs"
                    >
                      <Eye size={12} /> View all
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
