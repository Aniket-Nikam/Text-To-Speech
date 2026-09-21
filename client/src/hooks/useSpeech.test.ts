import { it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSpeech } from './useSpeech';
import { defaults } from '../services/api';
afterEach(() => vi.unstubAllGlobals());
it('reports network and invalid audio errors, recovers loading state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
  const { result } = renderHook(useSpeech);
  await act(() => result.current.generate('hello', 'en-US', 'voice', defaults, false));
  expect(result.current.error).toMatch(/Cannot reach/);
  expect(result.current.busy).toBe(false);
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } })),
  );
  await act(() => result.current.generate('hello', 'en-US', 'voice', defaults, false));
  expect(result.current.error).toMatch(/playable audio/);
});
it('does not request whitespace text and prevents concurrent generation', async () => {
  let resolve!: (r: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(useSpeech);
  await act(() => result.current.generate('  ', 'en-US', 'voice', defaults, false));
  expect(fetch).not.toHaveBeenCalled();
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.generate('hello', 'en-US', 'voice', defaults, false);
  });
  await act(() => result.current.generate('hello', 'en-US', 'voice', defaults, false));
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
    await pending;
  });
  await waitFor(() => expect(result.current.busy).toBe(false));
});
