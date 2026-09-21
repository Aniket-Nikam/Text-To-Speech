import { useState, useEffect, useCallback } from 'react';
import { api, type Voice } from '../services/api';
export function useVoices() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [language, setLanguageState] = useState('');
  const [voice, setVoice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<{ voices: Voice[] }>('/voices')
      .then((data) => {
        if (
          !Array.isArray(data.voices) ||
          data.voices.some(
            (v) =>
              typeof v.id !== 'string' ||
              typeof v.language !== 'string' ||
              !Array.isArray(v.styles),
          )
        )
          throw Error('The server returned an invalid voice list.');
        if (active) {
          setVoices(data.voices);
          const first = data.voices.find((v) => v.language === 'en-US') || data.voices[0];
          setLanguageState(first?.language || '');
          setVoice(first?.id || '');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const setLanguage = useCallback(
    (language: string) => {
      setLanguageState(language);
      setVoice(voices.find((v) => v.language === language)?.id || '');
    },
    [voices],
  );
  return {
    voices,
    language,
    voice,
    setLanguage,
    setVoice,
    loading,
    error,
    retry: () => setRevision((v) => v + 1),
  };
}
