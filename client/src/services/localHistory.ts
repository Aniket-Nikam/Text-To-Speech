export type LocalSpeech = {
  id: string;
  text: string;
  language: string;
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
  style: string;
  created_at: string;
  audio_path: string;
  favorite?: boolean;
};

const DB_NAME = 'labmentix_tts_db';
const STORE_NAME = 'audio_records';
const META_KEY = 'labmentix_tts_history_meta';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getLocalSpeechList(): LocalSpeech[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveLocalSpeech(item: {
  text: string;
  language: string;
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
  style?: string;
  blob: Blob;
}): Promise<LocalSpeech> {
  const id = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const record: LocalSpeech = {
    id,
    text: item.text,
    language: item.language,
    voice: item.voice,
    speed: item.speed,
    pitch: item.pitch,
    volume: item.volume,
    style: item.style || '',
    created_at: new Date().toISOString(),
    audio_path: 'local',
    favorite: false,
  };

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item.blob, id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // If IndexedDB is blocked, fallback gracefully
  }

  try {
    const list = getLocalSpeechList();
    list.unshift(record);
    localStorage.setItem(META_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    // Ignore quota errors
  }

  return record;
}

export async function getLocalAudioBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteLocalSpeech(id: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch {}
  try {
    const list = getLocalSpeechList().filter((x) => x.id !== id);
    localStorage.setItem(META_KEY, JSON.stringify(list));
  } catch {}
}

export function toggleLocalFavorite(id: string): boolean {
  try {
    const list = getLocalSpeechList();
    let fav = false;
    for (const item of list) {
      if (item.id === id) {
        item.favorite = !item.favorite;
        fav = !!item.favorite;
        break;
      }
    }
    localStorage.setItem(META_KEY, JSON.stringify(list));
    return fav;
  } catch {
    return false;
  }
}
