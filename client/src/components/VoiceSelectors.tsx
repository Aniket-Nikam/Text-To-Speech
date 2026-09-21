import type { Voice } from '../services/api';
export function LanguageSelector({
  voices,
  value,
  onChange,
  disabled,
}: {
  voices: Voice[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const languages = Array.from(
    new Map(voices.map((v) => [v.language, v.localeName])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <label className="field">
      Language
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !languages.length}
      >
        {!languages.length && <option value="">No languages available</option>}
        {languages.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function VoiceSelector({
  voices,
  language,
  value,
  onChange,
  disabled,
}: {
  voices: Voice[];
  language: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      Voice
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !voices.length}
      >
        {!voices.length && <option value="">No voices available</option>}
        {voices
          .filter((v) => v.language === language)
          .map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.gender}
            </option>
          ))}
      </select>
    </label>
  );
}
