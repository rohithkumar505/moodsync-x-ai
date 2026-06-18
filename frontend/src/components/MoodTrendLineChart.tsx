import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MOOD_COLORS, MOOD_EMOJI, type Mood } from '../api/client';

export interface TrendPoint {
  label?: string;
  date: string;
  mood: string | null;
  value?: number | null;
  checkIns?: number;
}

interface Props {
  data: TrendPoint[];
  title?: string;
  subtitle?: string;
}

const MOOD_SCORES: Record<string, number> = {
  HAPPY: 5,
  RELAXED: 4,
  NEUTRAL: 3,
  SAD: 2,
  ANGRY: 1,
};

const SCORE_LABELS: Record<number, string> = {
  5: 'Happy',
  4: 'Relaxed',
  3: 'Neutral',
  2: 'Sad',
  1: 'Angry',
};

function formatMoodLabel(mood: string): string {
  return mood.charAt(0) + mood.slice(1).toLowerCase();
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint & { plotValue: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (point.plotValue == null || !point.mood) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#1e1b4b] px-3 py-2 text-xs text-white/60">
        {point.label || point.date} · No check-ins
      </div>
    );
  }

  const mood = point.mood as Mood;
  return (
    <div className="rounded-lg border border-white/10 bg-[#1e1b4b] px-3 py-2 text-xs">
      <p className="text-white/50 mb-1">{point.label || point.date}</p>
      <p className="font-semibold" style={{ color: MOOD_COLORS[mood] }}>
        {MOOD_EMOJI[mood]} {formatMoodLabel(mood)}
      </p>
      <p className="text-white/45 mt-0.5">
        {point.checkIns === 1 ? '1 check-in' : `${point.checkIns ?? 0} check-ins`}
      </p>
    </div>
  );
}

export default function MoodTrendLineChart({
  data,
  title = 'Mood trend',
  subtitle = 'Daily average mood over the selected period',
}: Props) {
  const chartData = data.map((d) => ({
    ...d,
    plotValue: d.value ?? (d.mood ? MOOD_SCORES[d.mood] ?? 3 : null),
  }));

  const plotted = chartData.filter((d) => d.plotValue != null);
  const hasData = plotted.length > 0;

  if (!hasData) {
    return (
      <div className="glass p-4 sm:p-5 h-72 rounded-xl border border-white/10 flex flex-col">
        <h3 className="text-sm font-semibold text-white/80 mb-1">{title}</h3>
        <p className="text-xs text-white/40 mb-3">{subtitle}</p>
        <div className="flex-1 flex items-center justify-center text-sm text-white/40">
          No trend data yet — log moods to see your pattern
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-4 sm:p-5 h-72 rounded-xl border border-white/10">
      <h3 className="text-sm font-semibold text-white/80 mb-1">{title}</h3>
      <p className="text-xs text-white/40 mb-3">{subtitle}</p>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={chartData}>
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tickFormatter={(v) => SCORE_LABELS[v] || ''}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            width={56}
          />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="plotValue"
            stroke="#a78bfa"
            strokeWidth={2}
            connectNulls={false}
            dot={(props) => {
              const { cx, cy, payload } = props;
              if (payload.plotValue == null || !payload.mood) return null;
              const mood = payload.mood as Mood;
              return (
                <circle
                  key={`${payload.date}-${cx}`}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={MOOD_COLORS[mood]}
                  stroke="#1e1b4b"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
