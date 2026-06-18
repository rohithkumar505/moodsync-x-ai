import { Link } from 'react-router-dom';
import { Music, Heart, BarChart3, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-6 flex justify-between items-center">
        <span className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
          MoodSync X AI
        </span>
        <div className="flex gap-3">
          <Link to="/login" className="px-4 py-2 text-white/80 hover:text-white">Login</Link>
          <Link to="/register" className="glass-btn">Get Started</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="glass p-12 max-w-3xl">
          <p className="text-purple-300 text-sm font-medium mb-4 flex items-center justify-center gap-2">
            <Sparkles size={16} /> Your Mood, Your Music — in your language
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            MoodSync X AI
          </h1>
          <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto">
            Scan your face to detect mood instantly. Pick Hindi, Tamil, Telugu and more — we play the perfect song in your language.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="glass-btn text-center">Start Free</Link>
            <Link to="/login" className="px-6 py-2.5 rounded-xl border border-white/20 hover:bg-white/10 transition">Sign In</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl w-full">
          {[
            { icon: Heart, title: 'Mood Tracking', desc: 'Log moods with AI-powered analysis' },
            { icon: Music, title: 'Smart Playlists', desc: 'Music matched to your emotional state' },
            { icon: BarChart3, title: 'Deep Analytics', desc: 'Charts, DNA profiles, and growth reports' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass p-6 text-left">
              <Icon className="text-purple-400 mb-3" size={28} />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-white/60">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
