import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MOOD_COLORS } from '../api/client';

interface Props {
  data: { mood: string; count: number }[];
}

export default function MoodFrequencyChart({ data }: Props) {
  const hasData = data?.some((d) => d.count > 0);

  return (
    <div className="glass p-4 sm:p-5 h-72 rounded-xl border border-white/10">
      <h3 className="text-sm font-semibold text-white/80 mb-1">Mood frequency</h3>
      <p className="text-xs text-white/40 mb-3">How often each mood appears</p>
      {!hasData ? (
        <div className="h-[85%] flex items-center justify-center text-sm text-white/40">
          No mood data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={data}>
            <XAxis dataKey="mood" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)' }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.mood} fill={MOOD_COLORS[entry.mood as keyof typeof MOOD_COLORS]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
