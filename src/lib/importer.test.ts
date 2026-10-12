import { describe, expect, it } from 'vitest';
import { findHeaderRow, guessMapping, mapRows, parseDate, parseMoney } from './importer';

describe('parse helpers', () => {
  it.each([
    ['12/10/2026', '2026-10-12'], ['12-10-26', '2026-10-12'], ['2026-10-12', '2026-10-12'],
    ['12 Okt 2026', '2026-10-12'], ['9 Oktober 2026', '2026-10-09'], [46307, '2026-10-12'],
  ])('date %s', (c, v) => expect(parseDate(c)).toBe(v));
  it.each([
    ['Rp1.157.000', 1157000], ['-110.000', -110000], ['16000', 16000], ['1,250,000', 1250000], [85000, 85000], ['12.500,50', 12500.5],
  ])('money %s', (c, v) => expect(parseMoney(c)).toBe(v));
});

describe('mapRows', () => {
  it('single amount + type column', () => {
    const rows = [
      ['Laporan Keuangan Okt 2026'],
      ['Tanggal', 'Kategori', 'Jumlah', 'Keterangan', 'Tipe'],
      ['12/10/2026', 'Hadiah', '110.000', 'Oliv & ava', 'Pengeluaran'],
      ['10/10/2026', 'Belanja', '16.000', 'Filter air', 'Pengeluaran'],
      ['01/10/2026', 'Gaji', '8.000.000', '', 'Pemasukan'],
    ];
    const h = findHeaderRow(rows);
    expect(h).toBe(1);
    const m = guessMapping(rows[h]);
    expect(m).toEqual({ date: 0, category: 1, amount: 2, note: 3, type: 4 });
    const r = mapRows(rows.slice(h + 1), m);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toEqual({ date: '2026-10-12', type: 'out', amount: 110000, category: 'Hadiah', note: 'Oliv & ava', wallet: undefined });
    expect(r.rows[2].type).toBe('in');
  });
  it('separate income/expense columns', () => {
    const rows = [['Tanggal', 'Kategori', 'Pemasukan', 'Pengeluaran'], ['11/10/2026', 'Makanan', '', '8.000'], ['11/10/2026', 'Gaji', '500.000', '']];
    const m = guessMapping(rows[0]);
    const r = mapRows(rows.slice(1), m);
    expect(r.rows.map((x) => [x.type, x.amount])).toEqual([['out', 8000], ['in', 500000]]);
  });
});
