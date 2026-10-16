import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();
vi.mock('@vercel/blob', () => ({
  put: async (path, body) => { store.set(path, body); },
  get: async (path) => (store.has(path) ? { statusCode: 200, stream: new Response(store.get(path)).body } : null),
}));
const { GET, PUT } = await import('./backup.js');

const req = (method, code, body, query = '') =>
  new Request(`https://x/api/backup${query}`, { method, headers: code ? { 'x-kode': code } : {}, body: body ? JSON.stringify(body) : undefined });
const data = (n) => ({ app: 'catatan-keuangan', version: 1, exportedAt: 'x', transactions: Array.from({ length: n }, (_, i) => ({ id: i })), wallets: [], categories: [], investments: [], receivables: [] });

describe('backup api', () => {
  beforeEach(() => { store.clear(); process.env.BLOB_READ_WRITE_TOKEN = 't'; });

  it('reports when storage is not connected', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await GET(req('GET'))).status).toBe(503);
  });

  it('saves and returns a backup by code, case-insensitively, and keeps a daily copy', async () => {
    expect((await PUT(req('PUT', 'RahasiaIto', data(3)))).status).toBe(200);
    const r = await GET(req('GET', 'rahasiaito'));
    expect((await r.json()).transactions).toHaveLength(3);
    expect(store.size).toBe(2);
    expect((await GET(req('GET', 'kode-lain-1'))).status).toBe(404);
    expect([...store.keys()].some((k) => k.includes('rahasia'))).toBe(false);
  });

  it('refuses short codes and refuses to overwrite data with an empty phone unless forced', async () => {
    expect((await PUT(req('PUT', 'pendek', data(1)))).status).toBe(400);
    await PUT(req('PUT', 'rahasiaito', data(5)));
    expect((await PUT(req('PUT', 'rahasiaito', data(0)))).status).toBe(409);
    expect((await (await GET(req('GET', 'rahasiaito'))).json()).transactions).toHaveLength(5);
    expect((await PUT(req('PUT', 'rahasiaito', data(0), '?force=1'))).status).toBe(200);
  });
});
