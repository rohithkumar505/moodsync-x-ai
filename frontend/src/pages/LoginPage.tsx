import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Shield, Sparkles, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../api/client';
import { useBackendStatus } from '../hooks/useBackendStatus';

const ADMIN_HINT = {
  email: 'admin@moodsync.ai',
  password: 'Admin1234',
};

function AuthBackdrop() {
  return (
    <>
      <div className="auth-glow-orb w-72 h-72 bg-violet-600 -top-20 -left-20" />
      <div className="auth-glow-orb w-64 h-64 bg-fuchsia-600 bottom-0 right-0" />
      <div className="auth-glow-orb w-48 h-48 bg-sky-500 top-1/3 right-1/4 opacity-30" />
    </>
  );
}

export default function LoginPage() {
  const { login, token, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [flipped, setFlipped] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const backendOnline = useBackendStatus();

  if (authLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4">
        <div className="glass p-8 text-center">Loading…</div>
      </div>
    );
  }

  if (token && user) {
    return <Navigate to={user.isAdmin ? '/admin' : '/mood-sync'} replace />;
  }

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError('');
  };

  const toggleFlip = () => {
    setFlipped((v) => !v);
    resetForm();
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const user = await login(trimmedEmail, password);
      if (user.isAdmin) {
        setError('This is an admin account. Flip the card to use Admin login.');
        return;
      }
      navigate('/mood-sync');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError('Admin email and password are required');
      return;
    }
    setLoading(true);
    try {
      const user = await login(trimmedEmail, password);
      if (!user.isAdmin) {
        setError('Not an admin account. Use the user side or register as a regular user.');
        return;
      }
      navigate('/admin');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Admin login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-3 sm:p-4 relative overflow-hidden auth-mobile-shell">
      <AuthBackdrop />

      <div className="auth-scene relative z-10 w-full max-w-md">
        <div className={`auth-flip-card ${flipped ? 'is-flipped' : ''}`}>
          {/* User login — front */}
          <div className="auth-flip-face">
            <div className="auth-glass-panel p-6 sm:p-8 h-full flex flex-col">
              <div className="flex items-center gap-2 text-purple-300 text-sm mb-2">
                <Sparkles size={16} />
                Welcome back
              </div>
              <h1 className="text-2xl font-bold mb-1">User Sign In</h1>
              <p className="text-white/55 text-sm mb-6">Access MoodSync — moods, music & wellness</p>

              {backendOnline === false && (
                <p className="text-amber-300 text-xs mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  Backend offline. Run: <code className="text-[10px]">cd backend && python app.py</code>
                </p>
              )}

              <form onSubmit={handleUserLogin} className="space-y-4 flex-1">
                <input
                  className="glass-input"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <input
                  className="glass-input"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                {error && !flipped ? <p className="text-red-400 text-sm">{error}</p> : null}
                <button type="submit" className="glass-btn w-full" disabled={loading}>
                  {loading && !flipped ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <p className="text-center text-white/50 mt-5 text-sm">
                No account?{' '}
                <Link to="/register" className="text-purple-300 hover:underline">
                  Register
                </Link>
              </p>

              <button
                type="button"
                onClick={toggleFlip}
                className="mt-4 w-full py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm hover:bg-amber-500/20 transition flex items-center justify-center gap-2"
              >
                <Shield size={14} />
                Flip to Admin Area
              </button>
            </div>
          </div>

          {/* Admin login — back */}
          <div className="auth-flip-face auth-flip-back">
            <div className="auth-glass-panel p-6 sm:p-8 h-full flex flex-col border-amber-500/25 bg-gradient-to-br from-amber-950/40 to-slate-900/40">
              <div className="flex items-center gap-2 text-amber-300 text-sm mb-2">
                <Shield size={16} />
                Admin control panel
              </div>
              <h1 className="text-2xl font-bold mb-1">Admin Sign In</h1>
              <p className="text-white/55 text-sm mb-4">
                Full access — users, passwords, moods, journals, activity
              </p>

              <div className="text-xs text-amber-200/70 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 space-y-1">
                <p className="font-medium text-amber-200">Default admin credentials</p>
                <p>Email: {ADMIN_HINT.email}</p>
                <p>Password: {ADMIN_HINT.password}</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4 flex-1">
                <input
                  className="glass-input"
                  type="email"
                  placeholder="Admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
                <input
                  className="glass-input"
                  type="password"
                  placeholder="Admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                {error && flipped ? <p className="text-red-400 text-sm">{error}</p> : null}
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl font-medium bg-gradient-to-r from-amber-600 to-orange-600 border border-amber-400/30 hover:opacity-90 transition disabled:opacity-50"
                  disabled={loading}
                >
                  {loading && flipped ? 'Verifying…' : 'Enter Admin Area'}
                </button>
              </form>

              <button
                type="button"
                onClick={toggleFlip}
                className="mt-4 w-full py-2.5 rounded-xl border border-white/15 bg-white/5 text-white/70 text-sm hover:bg-white/10 transition flex items-center justify-center gap-2"
              >
                <User size={14} />
                Back to User Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
