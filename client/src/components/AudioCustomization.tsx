import type { Settings } from '../services/api';
import { defaults } from '../services/api';
export function AudioCustomization({
  value,
  onChange,
  styles,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
  styles: string[];
}) {
  return (
    <section className="settings">
      <div className="section-row">
        <h3>Speech settings</h3>
        <button className="text-button" onClick={() => onChange({ ...defaults })}>
          Reset
        </button>
      </div>
      {(
        [
          {
            key: 'speed',
            label: 'Speed',
            min: 0.5,
            max: 2,
            step: 0.05,
            display: `${value.speed.toFixed(2)}×`,
          },
          {
            key: 'pitch',
            label: 'Pitch',
            min: -50,
            max: 50,
            step: 1,
            display: `${value.pitch > 0 ? '+' : ''}${value.pitch}%`,
          },
          {
            key: 'volume',
            label: 'Volume',
            min: 0,
            max: 1,
            step: 0.05,
            display: `${Math.round(value.volume * 100)}%`,
          },
        ] as const
      ).map((item) => (
        <label className="range-field" key={item.key}>
          <span>
            {item.label}
            <output>{item.display}</output>
          </span>
          <input
            aria-label={item.label}
            type="range"
            min={item.min}
            max={item.max}
            step={item.step}
            value={value[item.key]}
            onChange={(e) => onChange({ ...value, [item.key]: Number(e.target.value) })}
          />
        </label>
      ))}
      {styles.length > 0 && (
        <label className="field">
          Voice style
          <select
            value={value.style}
            onChange={(e) => onChange({ ...value, style: e.target.value })}
          >
            <option value="">Natural</option>
            {styles.map((style) => (
              <option key={style}>{style}</option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
