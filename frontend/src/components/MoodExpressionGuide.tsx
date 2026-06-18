import type { Mood } from '../api/client';
import { MOOD_COLORS, MOOD_EMOJI } from '../api/client';
import { MOOD_EXPRESSION_GUIDE } from '../lib/faceMoodEngine';

const GUIDE_MOODS: Mood[] = ['HAPPY', 'SAD', 'ANGRY', 'RELAXED'];

interface Props {
  activeMood?: Mood | null;
  compact?: boolean;
  mobileHorizontal?: boolean;
  hideTitle?: boolean;
}

export default function MoodExpressionGuide({ activeMood, compact, mobileHorizontal, hideTitle }: Props) {
  if (mobileHorizontal) {
    return (
      <div className="w-full min-w-0">
        {!hideTitle ? (
          <p className="mobile-mood-step-label">Pick a face and hold still for ~2 seconds</p>
        ) : null}
        <div className="mobile-contained-scroll">
          {GUIDE_MOODS.map((m) => {
            const isActive = activeMood === m;
            const moodName = m.charAt(0) + m.slice(1).toLowerCase();
            return (
              <div
                key={m}
                className={`rounded-xl px-3 py-2.5 border shrink-0 w-[10.25rem] max-lg:w-[9.5rem] ${
                  isActive ? 'border-2 bg-white/10' : 'border-white/10 bg-white/5'
                }`}
                style={isActive ? { borderColor: MOOD_COLORS[m] } : undefined}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg leading-none">{MOOD_EMOJI[m]}</span>
                    <p className="font-semibold text-xs leading-tight" style={{ color: MOOD_COLORS[m] }}>
                      {moodName}
                    </p>
                  </div>
                  <p className="text-[10px] text-white/50 leading-snug">
                    {MOOD_EXPRESSION_GUIDE[m]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`glass border border-white/10 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <p className={`text-white/70 font-medium ${compact ? 'text-xs mb-2' : 'text-sm mb-3'}`}>
        How to show each mood — do this, then hold still 2 seconds:
      </p>
      <div className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        {GUIDE_MOODS.map((m) => {
          const isActive = activeMood === m;
          return (
            <div
              key={m}
              className={`rounded-xl px-3 py-2.5 border transition-all ${
                isActive
                  ? 'border-2 bg-white/10 scale-[1.02]'
                  : 'border-white/10 bg-white/5'
              }`}
              style={isActive ? { borderColor: MOOD_COLORS[m] } : undefined}
            >
              <div className="flex items-start gap-2">
                <span className={compact ? 'text-xl' : 'text-2xl'}>{MOOD_EMOJI[m]}</span>
                <div className="min-w-0 text-left">
                  <p
                    className={`font-bold ${compact ? 'text-xs' : 'text-sm'}`}
                    style={{ color: MOOD_COLORS[m] }}
                  >
                    {m}
                    {isActive && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-emerald-300 font-semibold">
                        detecting…
                      </span>
                    )}
                  </p>
                  <p className={`text-white/60 leading-snug ${compact ? 'text-[11px]' : 'text-xs'}`}>
                    {MOOD_EXPRESSION_GUIDE[m]}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
