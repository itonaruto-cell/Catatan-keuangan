// Automatic online backup (api/backup.js), stored in the owner's own Vercel Blob store.
// After the user sets a recovery code, every change is uploaded a few seconds later,
// so the data survives the phone or browser clearing its storage.

import { useSyncExternalStore } from 'react';
import { db, exportAll, restoreAll, type BackupData } from './db';

const CODE = 'ck-cloud-code';
const LAST = 'ck-cloud-last';

export type CloudState = { code: string | null; lastAt: string | null; busy: boolean; error: string };

let state: CloudState = { code: load(CODE), lastAt: load(LAST), busy: false, error: '' };
const listeners = new Set<() => void>();
function set(patch: Partial<CloudState>) { state = { ...state, ...patch }; listeners.forEach((l) => l()); }
function load(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function save(k: string, v: string | null) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* memory only */ } }

export function useCloud(): CloudState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

async function call(method: 'GET' | 'PUT', code?: string, body?: BackupData, force = false): Promise<Response> {
  return fetch(`/api/backup${force ? '?force=1' : ''}`, {
    method, cache: 'no-store',
    headers: { ...(code ? { 'x-kode': code } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Whether online backup is switched on for this app (a Blob store is connected). */
export async function cloudAvailable(): Promise<boolean> {
  try { return (await call('GET')).ok; } catch { return false; }
}

/** The backup stored under a code, or null when there is none. */
export async function fetchBackup(code: string): Promise<BackupData | null> {
  const r = await call('GET', code);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Cadangan online belum bisa dibuka. Pastikan HP tersambung internet.');
  return r.json();
}

export async function uploadNow(force = false): Promise<void> {
  if (!state.code) return;
  set({ busy: true, error: '' });
  try {
    const r = await call('PUT', state.code, await exportAll(), force);
    if (r.status === 409) throw new Error('Data di HP ini kosong, jadi cadangan online yang berisi data tidak ditimpa. Pulihkan dulu dari cadangan online.');
    if (!r.ok) throw new Error('Gagal mencadangkan. Akan dicoba lagi otomatis.');
    const { savedAt } = await r.json();
    save(LAST, savedAt);
    set({ lastAt: savedAt });
  } catch (e) {
    set({ error: e instanceof TypeError ? 'Tidak ada internet. Dicadangkan otomatis saat online.' : (e as Error).message });
    throw e;
  } finally {
    set({ busy: false });
  }
}

/** Turns on online backup with this code: either restores the backup stored under it, or uploads this phone's data. */
export async function connect(code: string, mode: 'restore' | 'upload'): Promise<void> {
  code = code.trim();
  if (mode === 'restore') {
    const data = await fetchBackup(code);
    if (!data) throw new Error('Tidak ada cadangan dengan kode itu. Cek lagi ejaannya.');
    await restoreAll(data);
  }
  save(CODE, code);
  set({ code });
  if (mode === 'upload') await uploadNow();
}

export function disconnect() {
  save(CODE, null); save(LAST, null);
  set({ code: null, lastAt: null, error: '' });
}

// Upload a few seconds after any change, and when the phone comes back online.
let timer: ReturnType<typeof setTimeout> | undefined;
let pending = false;
function schedule() {
  if (!state.code) return;
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (navigator.onLine) uploadNow().then(() => { pending = false; }, () => {});
  }, 3000);
}
for (const t of [db.transactions, db.wallets, db.categories, db.investments, db.receivables]) {
  t.hook('creating', schedule);
  t.hook('updating', schedule);
  t.hook('deleting', schedule);
}
window.addEventListener('online', () => { if (pending) schedule(); });
// Safety upload on start in case a change was missed.
if (state.code && (!state.lastAt || Date.now() - new Date(state.lastAt).getTime() > 12 * 3600 * 1000)) setTimeout(schedule, 5000);
