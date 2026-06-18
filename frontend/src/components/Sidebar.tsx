import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, PenLine, History, BarChart3, Dna, Music, Trophy,
  FileText, User, LogOut, X, ScanFace, Library,
} from 'lucide-react';

const links = [
  { to: '/mood-sync', label: 'Mood Sync', icon: ScanFace },
  { to: '/music', label: 'Music Library', icon: Library },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/journal', label: 'Journal', icon: PenLine },
  { to: '/history', label: 'History', icon: History },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/emotion-dna', label: 'Emotion DNA', icon: Dna },
  { to: '/playlists', label: 'Playlists', icon: Music },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/profile', label: 'Profile', icon: User },
];

interface Props {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, onMobileOpenChange }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const nav = (
    <div className="flex flex-col h-full">
      <div className="p-5 lg:p-6 border-b border-white/10 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
            MoodSync X AI
          </h1>
          <p className="text-sm text-white/60 mt-1">{user?.name}</p>
        </div>
        <button
          type="button"
          className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-white/60"
          onClick={() => onMobileOpenChange(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 p-3 lg:p-4 space-y-0.5 overflow-y-auto">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => onMobileOpenChange(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 lg:py-2.5 rounded-xl transition ${
                isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-6 py-4 text-white/60 hover:text-red-400 transition border-t border-white/10"
      >
        <LogOut size={18} /> Logout
      </button>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 glass m-4 mr-0 min-h-[calc(100vh-2rem)] no-print">
        {nav}
      </aside>
      {mobileOpen ? (
        <aside className="lg:hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" onClick={() => onMobileOpenChange(false)}>
          <div
            className="w-[min(100vw-2.5rem,18rem)] h-full glass m-0 rounded-none shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {nav}
          </div>
        </aside>
      ) : null}
    </>
  );
}
