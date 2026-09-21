import { useRef, useState } from 'react';
import { Sparkle } from '@phosphor-icons/react';
import { api } from '../services/api';
import { validateText } from '../utils/text';
import { ErrorMessage } from './Buttons';
const actions = [
  ['summarize', 'Summarize'],
  ['grammar', 'Fix grammar'],
  ['rewrite', 'Rewrite'],
  ['conversational', 'Make conversational'],
];
export function AiEnhancement({
  text,
  onApply,
}: {
  text: string;
  onApply: (text: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const running = useRef(false);
  async function enhance(action: string) {
    if (running.current) return;
    const invalid = validateText(text);
    if (invalid) {
      setError(invalid);
      return;
    }
    running.current = true;
    setBusy(action);
    setError('');
    try {
      const result = await api<{ text: string }>(`/ai/${action}`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      if (typeof result.text !== 'string') throw Error('The enhancement response was invalid.');
      setPreview(result.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Text enhancement failed.');
    } finally {
      setBusy('');
      running.current = false;
    }
  }
  return (
    <section className="ai-section">
      <div className="section-row">
        <span className="section-title">
          <Sparkle size={17} />
          Polish your text
        </span>
        <small>Powered by Groq</small>
      </div>
      <div className="ai-actions">
        {actions.map(([action, label]) => (
          <button
            key={action}
            className="subtle"
            disabled={!!busy}
            onClick={() => void enhance(action)}
          >
            {busy === action ? 'Working…' : label}
          </button>
        ))}
      </div>
      <ErrorMessage message={error} />
      {preview !== null && (
        <div className="ai-preview">
          <label htmlFor="ai-preview">Review your enhanced text</label>
          <p>Your editor stays unchanged until you apply this version.</p>
          <textarea id="ai-preview" value={preview} onChange={(e) => setPreview(e.target.value)} />
          <div className="audio-actions">
            <button className="subtle" onClick={() => setPreview(null)}>
              Discard
            </button>
            <button
              className="primary"
              onClick={() => {
                const invalid = validateText(preview);
                if (invalid) {
                  setError(invalid);
                  return;
                }
                onApply(preview);
                setPreview(null);
                setError('');
              }}
            >
              Use this text
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
