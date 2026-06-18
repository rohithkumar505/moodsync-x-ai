import type { Language } from '../types/music';

interface Props {
  value: Language;
  onChange: (lang: Language) => void;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
}

const LANGUAGES: Language[] = ['English', 'Hindi', 'Tamil', 'Telugu', 'Punjabi', 'Kannada'];

export default function LanguageSelector({
  value,
  onChange,
  label = 'Your song language',
  disabled = false,
  compact = false,
}: Props) {
  if (compact) {
    return (
      <div className={`w-full min-w-0 ${disabled ? 'opacity-60' : ''}`}>
        {label ? (
          <p className="mobile-mood-step-label">{label}</p>
        ) : null}
        <div className="mobile-contained-scroll">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              disabled={disabled}
              onClick={() => onChange(lang)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium transition shrink-0 disabled:cursor-not-allowed ${
                value === lang
                  ? 'bg-purple-500/40 border border-purple-400/50 text-white'
                  : 'bg-white/6 border border-white/10 text-white/65 active:bg-white/10'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`glass p-4 ${disabled ? 'opacity-60' : ''}`}>
      <label className="text-sm text-white/70 block mb-3">{label}</label>
      <p className="text-xs text-white/50 mb-3">
        {disabled
          ? 'Language is locked while your mood playlist is playing. Tap Scan again to change.'
          : 'Select the language you know — mood-based songs will play in this language.'}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            disabled={disabled}
            onClick={() => onChange(lang)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:cursor-not-allowed ${
              value === lang
                ? 'bg-purple-500/40 border border-purple-400/50 text-white'
                : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 disabled:hover:bg-white/5'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>
    </div>
  );
}
