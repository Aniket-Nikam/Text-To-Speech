export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
let accessToken: string | undefined;
export function setAccessToken(value?: string) {
  accessToken = value;
}
export async function apiFetch(path: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
      signal: options.signal || AbortSignal.timeout(65000),
    });
    if (!response.ok) {
      let message = 'The request failed. Please try again.';
      try {
        const data = await response.json();
        message = data.error?.message || message;
      } catch {
        /* Non-JSON gateway failure. */
      }
      throw Error(message);
    }
    return response;
  } catch (e) {
    if (e instanceof TypeError)
      throw Error('Cannot reach the server. Check your connection and try again.');
    if (e instanceof DOMException && e.name === 'TimeoutError')
      throw Error('The request took too long. Please try again.');
    throw e;
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await apiFetch(path, options);
  try {
    return await r.json();
  } catch {
    throw Error('The server returned an unreadable response. Please try again.');
  }
}
export type Voice = {
  id: string;
  name: string;
  language: string;
  localeName: string;
  gender: string;
  type: string;
  styles: string[];
};
export type Settings = { speed: number; pitch: number; volume: number; style: string };
export const defaults: Settings = { speed: 1, pitch: 0, volume: 1, style: '' };
export type Capabilities = { tts: boolean; auth: boolean; ai: boolean; maxCharacters: number };
