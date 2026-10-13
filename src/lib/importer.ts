// Import transactions from another app's Excel/CSV export.

import { MONTHS, MONTHS_SHORT, todayISO } from './format';
import type { TxType } from './db';

export type Field = 'date' | 'type' | 'category' | 'amount' | 'income' | 'expense' | 'note' | 'wallet';
export type Mapping = Partial<Record<Field, number>>;

export const FIELD_LABELS: Record<Field, string> = {
  date: 'Tanggal',
  type: 'Jenis (masuk/keluar)',
  category: 'Kategori',
  amount: 'Jumlah',
  income: 'Kolom pemasukan',
  expense: 'Kolom pengeluaran',
  note: 'Keterangan',
  wallet: 'Dompet / akun',
};

const GUESS: [Field, RegExp][] = [
  ['date', /tanggal|tgl|date|waktu|hari/i],
  ['income', /^(pemasukan|uang masuk|income|masuk)$/i],
  ['expense', /^(pengeluaran|uang keluar|expense|keluar)$/i],
  ['type', /tipe|jenis|type|kind|pemasukan.*pengeluaran/i],
  ['category', /kategori|category|kat\b/i],
  ['amount', /jumlah|nominal|amount|nilai|harga|total|rp/i],
  ['note', /keterangan|catatan|note|deskripsi|description|memo|ket\b/i],
  ['wallet', /akun|dompet|account|wallet|rekening|sumber/i],
];

export type Cell = string | number | boolean | Date | null | undefined;

export async function readSheet(file: File): Promise<Cell[][]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true, raw: false, dense: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
  return rows.filter((r) => r.some((c) => c !== null && c !== ''));
}

/** Index of the header row: the row in the top 15 with the most recognised column names. */
export function findHeaderRow(rows: Cell[][]): number {
  let best = 0;
  let bestHits = 1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const hits = rows[i].filter((c) => typeof c === 'string' && !/\d/.test(c) && GUESS.some(([, re]) => re.test(c.trim()))).length;
    if (hits > bestHits) { best = i; bestHits = hits; }
  }
  return best;
}

export function guessMapping(header: Cell[]): Mapping {
  const m: Mapping = {};
  header.forEach((h, idx) => {
    if (typeof h !== 'string') return;
    const name = h.trim();
    for (const [field, re] of GUESS) {
      if (m[field] === undefined && re.test(name)) { m[field] = idx; return; }
    }
  });
  if (m.income !== undefined && m.expense !== undefined) delete m.type;
  return m;
}

const MONTH_LOOKUP: Record<string, number> = {};
MONTHS.forEach((m, i) => { MONTH_LOOKUP[m.toLowerCase()] = i; });
MONTHS_SHORT.forEach((m, i) => { MONTH_LOOKUP[m.toLowerCase()] = i; });
Object.assign(MONTH_LOOKUP, { january: 0, february: 1, march: 2, may: 4, june: 5, july: 6, august: 7, aug: 7, october: 9, oct: 9, december: 11, dec: 11, agt: 7, nop: 10 });

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const dt = new Date(y, m, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
  return todayISO(dt);
}

export function parseDate(c: Cell): string | null {
  if (c instanceof Date) return todayISO(c);
  if (typeof c === 'number') {
    // Excel serial date
    if (c > 20000 && c < 80000) return todayISO(new Date(Math.round((c - 25569) * 86400 * 1000) + new Date().getTimezoneOffset() * 60000));
    return null;
  }
  if (typeof c !== 'string') return null;
  const s = c.trim().toLowerCase();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return iso(+m[3], +m[2] - 1, +m[1]); // Indonesian order: day/month/year
  m = s.match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{2,4})/);
  if (m && m[2] in MONTH_LOOKUP) return iso(+m[3], MONTH_LOOKUP[m[2]], +m[1]);
  return null;
}

export function parseMoney(c: Cell): number | null {
  if (typeof c === 'number') return c;
  if (typeof c !== 'string') return null;
  let s = c.trim().replace(/rp\.?/i, '').replace(/\s/g, '');
  if (!s) return null;
  const neg = /^-|^\(.*\)$/.test(s) || s.startsWith('−');
  s = s.replace(/[()−-]/g, '');
  // 1.250.000 or 1,250,000 -> thousands; 1250000,50 -> decimal comma
  if (/^\d{1,3}([.,]\d{3})+([.,]\d{1,2})?$/.test(s)) {
    const dec = s.match(/[.,](\d{1,2})$/);
    const intPart = dec ? s.slice(0, -dec[0].length) : s;
    s = intPart.replace(/[.,]/g, '') + (dec ? '.' + dec[1] : '');
  } else {
    s = s.replace(',', '.');
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

export interface ImportRow {
  date: string;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  wallet?: string;
}

export interface ImportResult {
  rows: ImportRow[];
  skipped: number;
}

export function mapRows(rows: Cell[][], mapping: Mapping): ImportResult {
  const out: ImportRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    const date = mapping.date !== undefined ? parseDate(r[mapping.date]) : null;
    let type: TxType = 'out';
    let amount: number | null = null;
    if (mapping.income !== undefined || mapping.expense !== undefined) {
      const inc = mapping.income !== undefined ? parseMoney(r[mapping.income]) : null;
      const exp = mapping.expense !== undefined ? parseMoney(r[mapping.expense]) : null;
      if (inc) { type = 'in'; amount = Math.abs(inc); }
      else if (exp) { type = 'out'; amount = Math.abs(exp); }
    }
    if (amount === null && mapping.amount !== undefined) {
      const v = parseMoney(r[mapping.amount]);
      if (v !== null) {
        amount = Math.abs(v);
        if (v < 0) type = 'out';
        const t = mapping.type !== undefined ? String(r[mapping.type] ?? '').toLowerCase() : '';
        if (t) type = /masuk|income|pemasukan|pendapatan|^\+|kredit|credit/.test(t) ? 'in' : 'out';
      }
    }
    if (!date || !amount) { skipped++; continue; }
    const text = (i: number | undefined) => (i === undefined || r[i] == null ? '' : String(r[i]).trim());
    out.push({
      date,
      type,
      amount: Math.round(amount),
      category: text(mapping.category) || 'Lain-lain',
      note: text(mapping.note),
      wallet: text(mapping.wallet) || undefined,
    });
  }
  return { rows: out, skipped };
}
