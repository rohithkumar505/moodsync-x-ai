import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Sparkles, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage, validatePassword } from '../api/client';
import { useBackendStatus } from '../hooks/useBackendStatus';
import LanguageSelector from '../components/LanguageSelector';
import type { Language } from '../types/music';

export default function RegistrationPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [language, setLanguage] = useState<Language>('Hindi');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const backendOnline = useBackendStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !password) {
      setError('Name, email, and password are required');
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address');
      return;
    }

    const pwdErr = validatePassword(password);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register(trimmedName, trimmedEmail, password, language);
      navigate('/mood-sync');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-3 sm:p-4 relative overflow-hidden auth-mobile-shell">
      <div className="auth-glow-orb w-80 h-80 bg-violet-600 -top-24 -right-16" />
      <div className="auth-glow-orb w-64 h-64 bg-pink-600 bottom-0 left-0 opacity-40" />

      <div className="w-full max-w-lg relative z-10">
        <div className="auth-glass-panel p-6 sm:p-8 lg:p-10">
          <div className="flex items-center gap-2 text-pink-300 text-sm mb-2">
            <UserPlus size={16} />
            Join MoodSync
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            Create your account
          </h1>
          <p className="text-white/55 text-sm mb-6 flex items-center gap-1.5">
            <Heart size={14} className="text-pink-400" />
            Track moods, get music in your language, grow your wellness journey
          </p>

          {backendOnline === false && (
            <p className="text-amber-300 text-xs mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              Backend offline. Start the server before registering.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-white/50 block mb-1.5">Full name</label>
              <input
                className="glass-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1.5">Email</label>
              <input
                className="glass-input"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 block mb-1.5">Password</label>
                <input
                  className="glass-input"
                  type="password"
                  placeholder="8+ chars, A-Z, 0-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1.5">Confirm</label>
                <input
                  className="glass-input"
                  type="password"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <LanguageSelector value={language} onChange={setLanguage} label="Preferred song language" />

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" className="glass-btn w-full flex items-center justify-center gap-2" disabled={loading}>
              <Sparkles size={16} />
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-white/50 mt-6 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-300 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
