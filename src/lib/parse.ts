// Turns a spoken or typed Indonesian sentence ("beli bensin 50 ribu pakai BCA")
// into a draft transaction.

import type { TxType } from './db';

const UNITS: Record<string, number> = {
  nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
  sepuluh: 10, sebelas: 11, seratus: 100, seribu: 1000, sejuta: 1_000_000, setengah: 0.5,
};
const MULT: Record<string, number> = {
  belas: 0, puluh: 10, ratus: 100, ribu: 1000, rb: 1000, k: 1000, juta: 1_000_000, jt: 1_000_000, miliar: 1_000_000_000, m: 1_000_000_000,
};

/** Spoken-number words to a number, e.g. "dua ratus lima puluh ribu" -> 250000. */
function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let group = 0; // value below 1000
  let last = 0;
  let seen = false;
  for (const w of words) {
    if (w === 'puluh') { group += last * 10 - last; last = 0; seen = true; continue; }
    if (w === 'belas') { group += 10; last = 0; seen = true; continue; }
    if (w === 'ratus') { group += last * 100 - last; last = 0; seen = true; continue; }
    if (w === 'ribu' || w === 'juta' || w === 'miliar') { total += (group || 1) * MULT[w]; group = 0; last = 0; seen = true; continue; }
    if (w in UNITS) {
      const v = UNITS[w];
      seen = true;
      if (v === 1000 || v === 1_000_000) { total += v; group = 0; last = 0; }
      else if (v === 100) { group += 100; last = 0; }
      else { group += v; last = v; }
      continue;
    }
    break;
  }
  return seen ? total + group : null;
}

export interface AmountMatch { value: number; start: number; end: number }

/** Find the money amount in a sentence. */
export function findAmount(text: string): AmountMatch | null {
  const t = text.toLowerCase();
  // Digits with optional unit: 50rb, 50 ribu, 1,5 jt, 1.5 juta, rp 25.000, 25k
  const re = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(ribu|rb|k|juta|jt|miliar|m)?\b/g;
  let best: AmountMatch | null = null;
  for (const m of t.matchAll(re)) {
    let raw = m[1];
    const unit = m[2];
    let value: number;
    if (unit) {
      value = Number(raw.replace(/\./g, '').replace(',', '.'));
      if (/^\d+\.\d{1,2}$/.test(raw)) value = Number(raw); // 1.5 juta
      value *= MULT[unit];
    } else {
      // 25.000 / 25,000 thousand separators
      if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) raw = raw.replace(/[.,]/g, '');
      value = Number(raw.replace(',', '.'));
      if (value < 100 && !m[0].startsWith('rp')) continue; // likely a quantity ("4 lot", "2 bungkus")
    }
    if (!Number.isFinite(value) || value <= 0) continue;
    const cand = { value: Math.round(value), start: m.index!, end: m.index! + m[0].length };
    if (!best || cand.value > best.value) best = cand;
  }
  if (best) return best;

  // Spoken words: "lima puluh ribu"
  const tokens = [...t.matchAll(/[a-z]+/g)];
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i][0];
    if (!(w in UNITS)) continue;
    const words = tokens.slice(i).map((x) => x[0]);
    let n = 0;
    while (n < words.length && (words[n] in UNITS || words[n] in MULT)) n++;
    const v = wordsToNumber(words.slice(0, n));
    if (v && v >= 100) {
      const last = tokens[i + n - 1];
      return { value: Math.round(v), start: tokens[i].index!, end: last.index! + last[0].length };
    }
  }
  return null;
}

const IN_WORDS = /\b(gaji|gajian|terima|diterima|dapat|dapet|bonus|pemasukan|masuk|dibayar|dikembalikan|thr|komisi|jual|menjual|laku)\b/;

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/\b(bensin|pertamax|pertalite|solar|bbm|spbu)\b/, 'Bensin'],
  [/\b(makan|nasi|ayam|bakso|soto|mie|sarapan|kopi|minum|warteg|padang|geprek|sate|lauk|makanan)\b/, 'Makanan'],
  [/\b(jajan|snack|cemilan|camilan|gorengan|es krim|roti)\b/, 'Cemilan'],
  [/\b(buah|mangga|pisang|apel|jeruk|semangka)\b/, 'Buah-buahan'],
  [/\b(bioskop|nonton|netflix|spotify|game|karaoke|liburan|wisata)\b/, 'Hiburan'],
  [/\b(hadiah|kado|angpao|sumbangan)\b/, 'Hadiah'],
  [/\b(obat|dokter|apotek|klinik|rumah sakit|vitamin)\b/, 'Kesehatan'],
  [/\b(servis|service|oli|ban|motor|parkir|cuci motor)\b/, 'Motor'],
  [/\b(listrik|pln|token|pulsa|kuota|internet|wifi|pdam|bpjs|tagihan|cicilan)\b/, 'Tagihan'],
  [/\b(grab|gojek|ojek|ojol|bus|kereta|krl|tol|taksi|angkot)\b/, 'Transportasi'],
  [/\b(skincare|salon|potong rambut|kosmetik|makeup)\b/, 'Kecantikan'],
  [/\b(baju|celana|sepatu|kaos|sarung|pakaian)\b/, 'Pakaian'],
  [/\b(hp|laptop|charger|kabel|elektronik)\b/, 'Elektronik'],
  [/\b(belanja|beli|indomaret|alfamart|supermarket|pasar|shopee|tokopedia)\b/, 'Belanja'],
];
const IN_CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/\b(gaji|gajian)\b/, 'Gaji'],
  [/\b(bonus|thr|komisi)\b/, 'Bonus'],
  [/\b(jual|menjual|laku)\b/, 'Penjualan'],
  [/\b(bunga|dividen)\b/, 'Bunga & dividen'],
];

const WALLET_ALIASES: Record<string, string[]> = {
  tunai: ['tunai', 'cash', 'uang tunai', 'dompet'],
  gopay: ['gopay', 'go pay', 'gojek pay'],
  ovo: ['ovo'],
  dana: ['dana'],
  shopeepay: ['shopeepay', 'shopee pay', 'spay'],
  bca: ['bca'],
  bri: ['bri'],
  bni: ['bni'],
  mandiri: ['mandiri', 'livin'],
  jago: ['jago'],
  seabank: ['seabank', 'sea bank'],
};

export interface Draft {
  type: TxType;
  amount: number;
  category?: string;
  walletId?: number;
  note: string;
}

export function parseSentence(
  text: string,
  categories: { name: string; type: 'in' | 'out' }[],
  wallets: { id?: number; name: string }[],
): Draft {
  const lower = ` ${text.toLowerCase()} `;
  const amount = findAmount(text);
  const type: TxType = IN_WORDS.test(lower) ? 'in' : 'out';

  // Category: exact name first, then keywords.
  const pool = categories.filter((c) => c.type === (type === 'in' ? 'in' : 'out'));
  let category = pool.find((c) => lower.includes(` ${c.name.toLowerCase()} `))?.name;
  if (!category) {
    const table = type === 'in' ? IN_CATEGORY_KEYWORDS : CATEGORY_KEYWORDS;
    const hit = table.find(([re]) => re.test(lower));
    if (hit && pool.some((c) => c.name === hit[1])) category = hit[1];
  }

  // Wallet: the user's own wallet names, then common aliases.
  let walletId: number | undefined;
  let walletPhrase: string | undefined;
  for (const w of wallets) {
    const name = w.name.toLowerCase();
    const candidates = [name, ...Object.entries(WALLET_ALIASES).filter(([k]) => name.includes(k)).flatMap(([, v]) => v)];
    const found = candidates.find((c) => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower));
    if (found) { walletId = w.id; walletPhrase = found; break; }
  }

  // Note: the sentence without the amount and "pakai <wallet>".
  let note = text;
  if (amount) note = note.slice(0, amount.start) + note.slice(amount.end);
  if (walletPhrase) note = note.replace(new RegExp(`\\b(pakai|pake|via|dari|lewat|dengan|ke)?\\s*${walletPhrase}\\b`, 'i'), '');
  note = note.replace(/\b(rupiah|rp)\b/gi, '').replace(/\s+/g, ' ').replace(/[,.\s]+$/, '').trim();
  note = note.charAt(0).toUpperCase() + note.slice(1);

  return { type, amount: amount?.value ?? 0, category, walletId, note };
}

/** Pick the grand total from OCR'd receipt text. */
export function totalFromReceipt(text: string): { amount: number; merchant: string } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const merchant = lines.find((l) => /[a-z]{3,}/i.test(l))?.slice(0, 40) ?? '';
  const money = (l: string) => {
    const ms = [...l.matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d{4,})/g)].map((m) => Number(m[1].replace(/[.,]/g, '')));
    return ms.length ? ms[ms.length - 1] : 0;
  };
  const priority = [/grand\s*total/i, /total\s*(bayar|belanja|harga)?/i, /jumlah|tagihan|amount|netto/i];
  for (const re of priority) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (re.test(lines[i]) && !/sub\s*total|kembali|tunai|cash|change|diskon|disc|ppn|tax|item|qty/i.test(lines[i])) {
        const v = money(lines[i]) || (lines[i + 1] ? money(lines[i + 1]) : 0);
        if (v) return { amount: v, merchant };
      }
    }
  }
  const all = lines.map(money).filter((v) => v > 0 && v < 100_000_000);
  return { amount: all.length ? Math.max(...all) : 0, merchant };
}
