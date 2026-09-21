import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trash, ClockCounterClockwise, Play } from '@phosphor-icons/react';
import { api, apiFetch } from '../services/api';
import { ErrorMessage } from '../components/Buttons';
import { AudioPlayer } from '../components/AudioPlayer';
type Speech = {
  id: string;
  text: string;
  language: string;
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
  style: string;
  created_at: string;
  audio_path: string | null;
};
export default function History() {
  const [items, setItems] = useState<Speech[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ url: string; title: string; id: string } | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api<{ items: Speech[]; total: number }>(`/history?offset=${offset}`),
      api<{ favorites: { speech_id: string }[] }>('/favorites'),
    ])
      .then(([history, fav]) => {
        if (active) {
          setItems(history.items);
          setTotal(history.total);
          setFavorites(new Set(fav.favorites.map((f) => f.speech_id)));
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
  }, [offset, revision]);
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio.url);
    },
    [audio],
  );
  async function action(id: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This action failed. Please try again.');
    } finally {
      setBusy(null);
    }
  }
  async function play(item: Speech) {
    const r = await api<{ audioUrl: string }>(`/history/${item.id}/audio`);
    const response = await fetch(r.audioUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error('This audio is no longer available.');
    const blob = await response.blob();
    if (!blob.type.includes('audio/')) throw Error('The stored file is not playable audio.');
    setAudio({ url: URL.createObjectURL(blob), title: item.text.slice(0, 70), id: item.id });
  }
  async function remove(item: Speech) {
    if (!window.confirm('Delete this speech and its saved audio? This cannot be undone.')) return;
    await action(item.id, async () => {
      await apiFetch(`/history/${item.id}`, { method: 'DELETE' });
      if (audio?.id === item.id) setAudio(null);
      if (items.length === 1 && offset > 0) setOffset(Math.max(0, offset - 20));
      else setRevision((r) => r + 1);
    });
  }
  async function favorite(item: Speech) {
    await action(item.id, async () => {
      await apiFetch(favorites.has(item.id) ? `/favorites/${item.id}` : '/favorites', {
        method: favorites.has(item.id) ? 'DELETE' : 'POST',
        ...(!favorites.has(item.id) ? { body: JSON.stringify({ speechId: item.id }) } : {}),
      });
      setFavorites((previous) => {
        const next = new Set(previous);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR VOICE LIBRARY</div>
          <h1>Speech history.</h1>
          <p>Your words, ready for another listen. Saved audio is retained for 30 days.</p>
        </div>
        <Link className="primary" to="/">
          Create speech
        </Link>
      </div>
      <ErrorMessage message={error} />
      <div className="history-toolbar">
        <span>
          {total} saved {total === 1 ? 'speech' : 'speeches'}
        </span>
        <label className="check-field">
          <input
            type="checkbox"
            checked={onlyFavorites}
            onChange={(e) => setOnlyFavorites(e.target.checked)}
          />
          Favorites on this page
        </label>
        <button
          className="text-button"
          onClick={() => setRevision((r) => r + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p role="status">Loading your speech library…</p>
      ) : items.length === 0 ? (
        <div className="empty-state panel">
          <ClockCounterClockwise size={38} />
          <h2>Your story starts here.</h2>
          <p>Enable “Save to my history” when generating speech to keep it here.</p>
          <Link className="primary" to="/">
            Open speech studio
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {items
            .filter((item) => !onlyFavorites || favorites.has(item.id))
            .map((item) => (
              <article className="history-item panel" key={item.id}>
                <div className="history-meta">
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                  <span>
                    {item.language} · {item.voice}
                  </span>
                </div>
                <details>
                  <summary>
                    {item.text.slice(0, 130)}
                    {item.text.length > 130 ? '…' : ''}
                  </summary>
                  <p>{item.text}</p>
                  <small>
                    Speed {item.speed}× · Pitch {item.pitch}% · Volume{' '}
                    {Math.round(item.volume * 100)}%{item.style ? ` · ${item.style}` : ''}
                  </small>
                </details>
                <div className="history-actions">
                  <button
                    className="subtle"
                    onClick={() => void action(item.id, () => play(item))}
                    disabled={!!busy || !item.audio_path}
                  >
                    <Play size={17} />
                    {busy === item.id
                      ? 'Please wait…'
                      : item.audio_path
                        ? 'Load audio'
                        : 'Audio expired'}
                  </button>
                  <button
                    className="subtle"
                    aria-pressed={favorites.has(item.id)}
                    onClick={() => void favorite(item)}
                    disabled={!!busy}
                  >
                    <Star size={17} weight={favorites.has(item.id) ? 'fill' : 'regular'} />
                    {favorites.has(item.id) ? 'Favorited' : 'Favorite'}
                  </button>
                  <button className="subtle" onClick={() => void remove(item)} disabled={!!busy}>
                    <Trash size={17} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          {onlyFavorites && !items.some((i) => favorites.has(i.id)) && (
            <p>No favorites on this page.</p>
          )}
        </div>
      )}
      <div className="pagination">
        <button
          className="subtle"
          disabled={offset === 0 || loading}
          onClick={() => setOffset((n) => Math.max(0, n - 20))}
        >
          Previous
        </button>
        <span>Page {Math.floor(offset / 20) + 1}</span>
        <button
          className="subtle"
          disabled={offset + 20 >= total || loading}
          onClick={() => setOffset((n) => n + 20)}
        >
          Next
        </button>
      </div>
      {audio && <AudioPlayer audio={audio} onError={setError} />}
    </>
  );
}
