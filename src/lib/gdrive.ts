// Backup to the user's own Google Drive (a visible JSON file this app creates).

import { exportAll, restoreAll, type BackupData } from './db';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'Catatan Keuangan - cadangan.json';

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string }): void; callback: (r: TokenResponse) => void }
type GoogleNs = { accounts: { oauth2: { initTokenClient(o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }): TokenClient } } };

let token: { value: string; expires: number } | null = null;
let client: TokenClient | null = null;

export function driveConfigured(): boolean {
  return !!CLIENT_ID;
}

function loadScript(): Promise<GoogleNs> {
  const w = window as unknown as { google?: GoogleNs };
  if (w.google?.accounts) return Promise.resolve(w.google);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve((window as unknown as { google: GoogleNs }).google);
    s.onerror = () => reject(new Error('Tidak bisa memuat layanan Google. Periksa koneksi internet.'));
    document.head.appendChild(s);
  });
}

/** interactive=false tries a silent token (works after the user has agreed once). */
async function getToken(interactive: boolean): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  if (!CLIENT_ID) throw new Error('Cadangan Google Drive belum diaktifkan di aplikasi ini.');
  const google = await loadScript();
  return new Promise((resolve, reject) => {
    const cb = (r: TokenResponse) => {
      if (r.error || !r.access_token) return reject(new Error('Akses Google Drive tidak diberikan.'));
      token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
      resolve(r.access_token);
    };
    if (!client) {
      client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: cb,
        error_callback: () => reject(new Error('Login Google dibatalkan.')),
      });
    }
    client.callback = cb;
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

async function api(path: string, init: RequestInit, accessToken: string): Promise<Response> {
  const res = await fetch(`https://www.googleapis.com${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Google Drive menolak permintaan (${res.status}).`);
  return res;
}

async function findFile(t: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const res = await api(`/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id)`, {}, t);
  const json = (await res.json()) as { files: { id: string }[] };
  return json.files[0]?.id ?? null;
}

export async function backupToDrive(interactive = true): Promise<Date> {
  const t = await getToken(interactive);
  const data = await exportAll();
  const id = await findFile(t);
  const boundary = 'ck' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(id ? {} : { name: FILE_NAME, mimeType: 'application/json' })}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
  const path = id ? `/upload/drive/v3/files/${id}?uploadType=multipart` : '/upload/drive/v3/files?uploadType=multipart';
  await api(path, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }, t);
  return new Date();
}

export async function restoreFromDrive(): Promise<BackupData> {
  const t = await getToken(true);
  const id = await findFile(t);
  if (!id) throw new Error('Belum ada cadangan di Google Drive.');
  const res = await api(`/drive/v3/files/${id}?alt=media`, {}, t);
  const data = (await res.json()) as BackupData;
  await restoreAll(data);
  return data;
}
