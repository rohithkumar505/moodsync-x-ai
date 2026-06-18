import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Mood } from '../api/client';
import api from '../api/client';
import MoodSelector from '../components/MoodSelector';

export default function CheckInPage() {
  const navigate = useNavigate();
  const [mood, setMood] = useState<Mood | null>(null);
  const [text, setText] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post('/api/upload/mood-image', form);
      setImagePath(data.imagePath);
      if (data.detectedMood) setMood(data.detectedMood);
      setMessage(data.detectedMood ? `Image analyzed: ${data.detectedMood}` : 'Image uploaded');
    } catch {
      setMessage('Image upload failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mood) { setMessage('Please select a mood'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/api/moods', { mood, journalText: text, imagePath, source: text ? 'ai' : 'manual' });
      if (data.newAchievements?.length) {
        setMessage(`Achievement unlocked: ${data.newAchievements.join(', ')}!`);
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        navigate('/dashboard');
      }
    } catch {
      setMessage('Failed to log mood');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Mood Check-in</h1>
      <p className="text-white/60">How are you feeling right now?</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <MoodSelector selected={mood} onSelect={setMood} />

        <textarea
          className="glass-input min-h-24 resize-none"
          placeholder="Optional: describe how you feel (AI will analyze)..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="glass p-4">
          <label className="text-sm text-white/70 block mb-2">Upload mood image (optional)</label>
          <input type="file" accept="image/*" onChange={handleImage} className="text-sm text-white/60" />
          {imagePath && <p className="text-xs text-green-400 mt-1">Image saved</p>}
        </div>

        {message && <p className="text-purple-300 text-sm">{message}</p>}

        <button type="submit" className="glass-btn w-full" disabled={loading}>
          {loading ? 'Saving...' : 'Log Mood'}
        </button>
      </form>
    </div>
  );
}
