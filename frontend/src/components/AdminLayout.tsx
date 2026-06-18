import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, LayoutDashboard, LogOut, Shield, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'All Users', icon: Users },
  { to: '/admin/activity', label: 'Live Activity', icon: Activity },
];

export default function AdminLayout() {
  const { user, isAdmin, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8">Loading admin…</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-950 via-amber-950/20 to-slate-950">
      <aside className="w-64 shrink-0 border-r border-amber-500/15 bg-black/30 backdrop-blur-xl p-4 flex flex-col">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2 text-amber-300">
            <Shield size={20} />
            <span className="font-bold">Admin Area</span>
          </div>
          <p className="text-xs text-white/40 mt-1 truncate">{user.email}</p>
        </div>

        <nav className="space-y-1 flex-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-100 border-amber-500/30'
                    : 'text-white/70 hover:bg-amber-500/10 hover:text-amber-100 border-transparent hover:border-amber-500/20'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
        >
          <LogOut size={16} />
          Log out
        </button>
      </aside>

      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
