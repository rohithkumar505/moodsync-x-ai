import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingPage from '../pages/LandingPage';
import { isMobileViewport } from '../lib/isMobile';

export default function HomePage() {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center">
        <div className="glass p-8 text-center">Loading MoodSync...</div>
      </div>
    );
  }

  if (isMobileViewport()) {
    if (token && user) {
      return <Navigate to={user.isAdmin ? '/admin' : '/mood-sync'} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <LandingPage />;
}

export function NotFoundRedirect() {
  if (isMobileViewport()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/" replace />;
}
