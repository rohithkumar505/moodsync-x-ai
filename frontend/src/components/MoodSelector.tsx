import type { Mood } from '../api/client';
import { MOODS, MOOD_COLORS, MOOD_EMOJI } from '../api/client';

interface Props {
  selected: Mood | null;
  onSelect: (mood: Mood) => void;
}

export default function MoodSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {MOODS.map((mood) => (
        <button
          key={mood}
          type="button"
          onClick={() => onSelect(mood)}
          className={`glass p-4 text-center transition hover:scale-105 ${
            selected === mood ? 'ring-2 ring-white/50' : ''
          }`}
          style={selected === mood ? { borderColor: MOOD_COLORS[mood] } : {}}
        >
          <span className="text-3xl block mb-1">{MOOD_EMOJI[mood]}</span>
          <span className="text-sm text-white/80">{mood.charAt(0) + mood.slice(1).toLowerCase()}</span>
        </button>
      ))}
    </div>
  );
}
