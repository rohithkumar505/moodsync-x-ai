import { NavLink } from 'react-router-dom';
import { Library, ListMusic, MoreHorizontal, ScanFace, User } from 'lucide-react';

interface Props {
  onMore: () => void;
}

const tabs = [
  { to: '/mood-sync', label: 'Mood', icon: ScanFace },
  { to: '/music', label: 'Music', icon: Library },
  { to: '/playlists', label: 'Lists', icon: ListMusic },
  { to: '/profile', label: 'You', icon: User },
] as const;

export default function MobileBottomNav({ onMore }: Props) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[48] mobile-bottom-nav no-print"
      aria-label="Main navigation"
    >
      <div className="mobile-bottom-nav-inner">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `mobile-nav-tab ${isActive ? 'mobile-nav-tab-active' : ''}`
            }
          >
            <Icon size={22} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={onMore} className="mobile-nav-tab" aria-label="More pages">
          <MoreHorizontal size={22} strokeWidth={2} />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
