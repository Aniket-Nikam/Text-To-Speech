import { useEffect, useRef, useState } from 'react';
import { apiFetch, type Settings } from '../services/api';
import { validateText } from '../utils/text';
export function useSpeech() {
  const [audio, setAudio] = useState<{ url: string; title: string; historyId?: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio.url);
    },
    [audio],
  );
  async function generate(
    text: string,
    language: string,
    voice: string,
    settings: Settings,
    save: boolean,
  ) {
    if (running.current) return;
    const invalid = validateText(text);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!language || !voice) {
      setError('Select an available language and voice.');
      return;
    }
    running.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    controller.current = new AbortController();
    try {
      const r = await apiFetch('/tts', {
        method: 'POST',
        body: JSON.stringify({ text, language, voice, ...settings, save }),
        signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(65000)]),
      });
      if (!r.headers.get('Content-Type')?.includes('audio/mpeg'))
        throw Error('The server did not return playable audio.');
      const blob = await r.blob();
      if (!blob.size) throw Error('The generated audio was empty. Please try again.');
      setAudio({
        url: URL.createObjectURL(blob),
        title: text.trim().slice(0, 70),
        historyId: r.headers.get('X-History-Id') || undefined,
      });
      setNotice(r.headers.get('X-Save-Warning') || 'Your speech is ready.');
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError'))
        setError(e instanceof Error ? e.message : 'Speech generation failed.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function clear() {
    controller.current?.abort();
    setAudio(null);
    setError('');
    setNotice('');
  }
  return { audio, busy, error, notice, setError, generate, clear };
}
