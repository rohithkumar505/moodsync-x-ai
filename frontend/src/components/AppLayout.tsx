import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MusicAssistantProvider } from '../context/MusicAssistantContext';
import { MusicPlayerProvider, useMusicPlayer } from '../context/MusicPlayerContext';
import Sidebar from './Sidebar';
import GlobalPlayerBar from './GlobalPlayerBar';
import FloatingMusicAssistant from './FloatingMusicAssistant';
import MobileBottomNav from './MobileBottomNav';
import MobileAppHeader from './MobileAppHeader';
import { usePageTracker } from '../hooks/usePageTracker';
import { useMusicWarmup } from '../hooks/useMusicWarmup';

function AppShell() {
  const { current, playerBarVisible } = useMusicPlayer();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const mobilePb = !current
    ? 'pb-mobile-nav'
    : playerBarVisible
      ? 'pb-mobile-expanded-player'
      : 'pb-mobile-mini-player';

  const mainPadding = [
    'flex-1 min-w-0 overflow-x-hidden overflow-y-auto transition-[padding]',
    'mobile-shell-main max-lg:pt-0',
    'lg:px-8 lg:py-8 lg:pt-8',
    mobilePb,
    current && playerBarVisible ? 'lg:pb-36' : 'lg:pb-20',
  ].join(' ');

  return (
    <MusicAssistantProvider>
      <div className="flex min-h-screen min-h-[100dvh]">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileOpenChange={setMobileMenuOpen} />
        <main className={mainPadding}>
          <MobileAppHeader />
          <div className="mobile-page-stack">
            <Outlet />
          </div>
        </main>
        <GlobalPlayerBar />
        <FloatingMusicAssistant />
        <MobileBottomNav onMore={() => setMobileMenuOpen(true)} />
      </div>
    </MusicAssistantProvider>
  );
}

export default function AppLayout() {
  const { user, token, loading } = useAuth();
  usePageTracker();
  useMusicWarmup(Boolean(token && user && !user.isAdmin));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8 text-center animate-pulse">Loading MoodSync…</div>
      </div>
    );
  }

  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;

  return (
    <MusicPlayerProvider>
      <AppShell />
    </MusicPlayerProvider>
  );
}
