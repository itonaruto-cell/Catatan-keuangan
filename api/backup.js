// Online backup of the whole app, stored privately in Vercel Blob.
// Each backup is filed under a hash of the user's recovery code; the code itself is never stored.
// Needs a private Blob store connected to the project (BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID with Vercel OIDC).
import { createHash } from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';

const configured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

function folder(request) {
  const code = request.headers.get('x-kode') ?? '';
  if (code.trim().length < 8) return null;
  return `backups/${createHash('sha256').update(`catatan-keuangan:${code.trim().toLowerCase()}`).digest('hex')}`;
}

async function readLatest(dir) {
  const r = await get(`${dir}/latest.json`, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export async function GET(request) {
  if (!configured()) return json({ configured: false }, 503);
  const dir = folder(request);
  if (!dir) return json({ configured: true });
  const data = await readLatest(dir);
  return data ? json(data) : json({ error: 'not-found' }, 404);
}

export async function PUT(request) {
  if (!configured()) return json({ configured: false }, 503);
  const dir = folder(request);
  if (!dir) return json({ error: 'code' }, 400);
  const data = await request.json();
  if (data?.app !== 'catatan-keuangan' || !Array.isArray(data.transactions)) return json({ error: 'invalid' }, 400);

  // Never let an emptied phone overwrite a backup that has data, unless the user explicitly asked.
  const force = new URL(request.url).searchParams.get('force') === '1';
  if (!force) {
    const old = await readLatest(dir).catch(() => null);
    const count = (d) => d.transactions.length + d.wallets.length + d.investments.length + d.receivables.length;
    if (old && count(old) > 0 && count(data) === 0) return json({ error: 'empty-over-data' }, 409);
  }

  const body = JSON.stringify(data);
  const opts = { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true };
  await put(`${dir}/latest.json`, body, opts);
  // One copy per day as well, so an earlier state can be recovered.
  await put(`${dir}/${new Date().toISOString().slice(0, 10)}.json`, body, opts);
  return json({ ok: true, savedAt: new Date().toISOString() });
}

/** Removes every backup stored under a code (used when the user switches to a new code). */
export async function DELETE(request) {
  if (!configured()) return json({ configured: false }, 503);
  const dir = folder(request);
  if (!dir) return json({ error: 'code' }, 400);
  let cursor;
  do {
    const page = await list({ prefix: `${dir}/`, cursor });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return json({ ok: true });
}
