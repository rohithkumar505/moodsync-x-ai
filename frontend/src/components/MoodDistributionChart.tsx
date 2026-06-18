import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { MOOD_COLORS, MOOD_EMOJI, type Mood } from '../api/client';

interface Props {
  data: { mood: string; percentage: number; count: number }[];
}

function formatMoodLabel(mood: string): string {
  return mood.charAt(0) + mood.slice(1).toLowerCase();
}

export default function MoodDistributionChart({ data }: Props) {
  const chartData = data.filter((d) => d.count > 0);
  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  if (!chartData.length) {
    return (
      <div className="glass p-4 sm:p-5 h-72 rounded-xl border border-white/10 flex flex-col">
        <h3 className="text-sm font-semibold text-white/80 mb-1">Mood distribution</h3>
        <p className="text-xs text-white/40 mb-3">Share of each mood across all check-ins</p>
        <div className="flex-1 flex items-center justify-center text-sm text-white/40">
          No mood data yet
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-4 sm:p-5 h-72 rounded-xl border border-white/10">
      <h3 className="text-sm font-semibold text-white/80 mb-1">Mood distribution</h3>
      <p className="text-xs text-white/40 mb-3">
        {total} check-in{total === 1 ? '' : 's'} total
      </p>
      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="mood"
            cx="50%"
            cy="50%"
            innerRadius={42}
            outerRadius={78}
            paddingAngle={2}
            label={({ name, percent }) =>
              `${MOOD_EMOJI[name as Mood] || ''} ${Math.round((percent ?? 0) * 100)}%`
            }
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.mood}
                fill={MOOD_COLORS[entry.mood as keyof typeof MOOD_COLORS]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <Legend
            formatter={(value) => `${MOOD_EMOJI[value as Mood] || ''} ${formatMoodLabel(value)}`}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
