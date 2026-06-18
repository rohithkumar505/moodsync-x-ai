import { useLocation } from 'react-router-dom';

const TITLES: Record<string, string> = {
  '/mood-sync': 'Mood Sync',
  '/music': 'Music',
  '/playlists': 'Playlists',
  '/profile': 'You',
  '/dashboard': 'Home',
  '/journal': 'Journal',
  '/history': 'History',
  '/analytics': 'Analytics',
  '/emotion-dna': 'Emotion DNA',
  '/achievements': 'Achievements',
  '/reports': 'Reports',
};

export default function MobileAppHeader() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] || 'MoodSync';

  return (
    <header className="lg:hidden sticky top-0 z-30 mobile-app-header">
      <h1 className="text-[1.35rem] font-bold truncate leading-tight tracking-tight">{title}</h1>
    </header>
  );
}
