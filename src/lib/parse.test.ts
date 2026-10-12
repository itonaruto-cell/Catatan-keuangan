import { describe, expect, it } from 'vitest';
import { findAmount, parseSentence, totalFromReceipt } from './parse';
import { DEFAULT_IN_CATEGORIES, DEFAULT_OUT_CATEGORIES } from './db';

const cats = [
  ...DEFAULT_OUT_CATEGORIES.map((name) => ({ name, type: 'out' as const })),
  ...DEFAULT_IN_CATEGORIES.map((name) => ({ name, type: 'in' as const })),
];
const wallets = [
  { id: 1, name: 'Tunai' },
  { id: 2, name: 'Bank BCA' },
  { id: 3, name: 'GoPay' },
];

describe('findAmount', () => {
  it.each([
    ['50rb', 50000], ['50 ribu', 50000], ['1,5 juta', 1500000], ['1.5jt', 1500000], ['Rp 25.000', 25000],
    ['25000', 25000], ['25k', 25000], ['lima puluh ribu', 50000], ['dua ratus lima puluh ribu', 250000],
    ['seratus dua puluh tiga ribu', 123000], ['satu juta lima ratus ribu', 1500000], ['dua belas ribu', 12000],
    ['setengah juta', 500000], ['Rp1.250.000', 1250000],
  ])('%s', (s, v) => expect(findAmount(s)?.value).toBe(v));
  it('ignores small quantities', () => expect(findAmount('beli 2 bungkus 15rb')?.value).toBe(15000));
});

describe('parseSentence', () => {
  it('voice example', () => {
    const d = parseSentence('Beli bensin lima puluh ribu, bayar pakai BCA', cats, wallets);
    expect(d).toMatchObject({ type: 'out', amount: 50000, category: 'Bensin', walletId: 2 });
  });
  it('typed example', () => {
    const d = parseSentence('makan siang 25rb gopay', cats, wallets);
    expect(d).toMatchObject({ type: 'out', amount: 25000, category: 'Makanan', walletId: 3, note: 'Makan siang' });
  });
  it('income', () => {
    const d = parseSentence('terima gaji 8 juta ke BCA', cats, wallets);
    expect(d).toMatchObject({ type: 'in', amount: 8000000, category: 'Gaji', walletId: 2 });
  });
  it('cash', () => {
    expect(parseSentence('jajan gorengan 10rb cash', cats, wallets)).toMatchObject({ category: 'Cemilan', walletId: 1 });
  });
});

describe('totalFromReceipt', () => {
  it('finds total', () => {
    const r = totalFromReceipt('INDOMARET\nJL MERDEKA 1\nBERAS 5KG 78.000\nMINYAK 36.000\nSUBTOTAL 114.000\nTOTAL 114.000\nTUNAI 120.000\nKEMBALI 6.000');
    expect(r).toEqual({ amount: 114000, merchant: 'INDOMARET' });
  });
});
