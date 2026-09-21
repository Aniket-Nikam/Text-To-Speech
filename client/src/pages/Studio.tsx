import { useState } from 'react';
import {
  SlidersHorizontal,
  TextT,
  ShieldCheck,
  Headphones,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { TextInput } from '../components/TextInput';
import { FileUpload } from '../components/FileUpload';
import { ClearButton, ErrorMessage, GenerateButton } from '../components/Buttons';
import { LanguageSelector, VoiceSelector } from '../components/VoiceSelectors';
import { AudioCustomization } from '../components/AudioCustomization';
import { AudioPlayer } from '../components/AudioPlayer';
import { useVoices } from '../hooks/useVoices';
import { useSpeech } from '../hooks/useSpeech';
import { defaults } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { AiEnhancement } from '../components/AiEnhancement';
export default function Studio() {
  const [text, setText] = useState('');
  const [settings, setSettings] = useState({ ...defaults });
  const auth = useAuth();
  const [save, setSave] = useState(false);
  const catalog = useVoices();
  const speech = useSpeech();
  const selected = catalog.voices.find((v) => v.id === catalog.voice);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CREATE WITH YOUR VOICE</div>
          <h1>Bring your words to life.</h1>
          <p>Turn your text into natural speech. Make every word heard.</p>
        </div>
        <span className="studio-label">
          <Headphones size={18} />
          Speech studio
        </span>
      </div>
      <div className="studio-grid">
        <section className="panel editor-panel">
          <div className="toolbar">
            <span className="section-title">
              <TextT size={19} />
              Your text
            </span>
            <div className="toolbar-actions">
              <FileUpload
                onText={(value) => {
                  setText(value);
                  speech.setError('');
                }}
                onError={speech.setError}
              />
              <ClearButton
                onClick={() => {
                  setText('');
                  speech.clear();
                }}
                disabled={speech.busy || (!text && !speech.audio)}
              />
            </div>
          </div>
          <TextInput text={text} onChange={setText} />
          <div className="editor-foot">
            <span>Start with an idea. We’ll give it a voice.</span>
            <button
              className="text-button"
              onClick={() =>
                setText(
                  'A small idea can become something extraordinary. Give yourself the space to explore, the courage to begin, and the patience to keep going. Your next chapter starts with a single word.',
                )
              }
              disabled={speech.busy}
            >
              Try sample text
            </button>
          </div>
        </section>
        <aside className="panel voice-panel">
          <div className="toolbar">
            <span className="section-title">
              <SlidersHorizontal size={19} />
              Voice configuration
            </span>
          </div>
          <div className="voice-content">
            {catalog.loading ? (
              <div className="loading" role="status">
                <span className="spinner" />
                Loading available voices…
              </div>
            ) : catalog.error ? (
              <div className="provider-notice">
                <strong>Connect your speech provider</strong>
                <p>{catalog.error}</p>
                <button className="subtle" onClick={catalog.retry}>
                  <ArrowClockwise size={16} />
                  Retry connection
                </button>
              </div>
            ) : catalog.voices.length === 0 ? (
              <p role="status">No compatible voices are available in this region.</p>
            ) : null}
            <LanguageSelector
              voices={catalog.voices}
              value={catalog.language}
              onChange={(language) => {
                catalog.setLanguage(language);
                setSettings({ ...settings, style: '' });
              }}
              disabled={catalog.loading}
            />
            <VoiceSelector
              voices={catalog.voices}
              language={catalog.language}
              value={catalog.voice}
              onChange={(voice) => {
                catalog.setVoice(voice);
                setSettings({ ...settings, style: '' });
              }}
              disabled={catalog.loading}
            />
            {selected && (
              <div className="voice-meta">
                <span className="voice-avatar">{selected.name.slice(0, 1)}</span>
                <div>
                  <strong>{selected.name}</strong>
                  <span>
                    {selected.type} · {selected.language}
                  </span>
                </div>
              </div>
            )}
            <AudioCustomization
              value={settings}
              onChange={setSettings}
              styles={selected?.styles || []}
            />
            {auth.session && (
              <label className="check-field save-option">
                <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
                Save to my history
              </label>
            )}
            <GenerateButton
              onClick={() =>
                void speech.generate(
                  text,
                  catalog.language,
                  catalog.voice,
                  settings,
                  !!auth.session && save,
                )
              }
              busy={speech.busy}
              disabled={!catalog.voice}
            />
            <div className="generation-note">MP3 audio · Ready to download</div>
          </div>
        </aside>
        <div className="studio-output">
          {auth.session && auth.capabilities?.ai && <AiEnhancement text={text} onApply={setText} />}
          <ErrorMessage message={speech.error} />
          {speech.notice && (
            <p className="notice" role="status">
              {speech.notice}
            </p>
          )}
          <AudioPlayer audio={speech.audio} onError={speech.setError} />
        </div>
      </div>
      <div className="privacy-note">
        <ShieldCheck size={17} />
        <span>
          Your text is sent securely to the speech provider. Guest audio is not stored on the
          server.
        </span>
      </div>
    </>
  );
}
