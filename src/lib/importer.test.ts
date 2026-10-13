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

describe('export from the old "Catatan Keuangan" app', () => {
  it('skips the summary block and reads Pengeluaran/Pemasukan columns', () => {
    const rows = [
      [null, 'Tanggal', null, '01/02/2026 - 31/10/2026', null, null, null],
      [null, 'Pemasukan', null, 'Rp0', null, null, null],
      [null, 'Pengeluaran', null, 'Rp47.204.000', null, null, null],
      [null, 'Saldo', null, 'Rp-47.204.000', null, null, null],
      [null, 'No', 'Tanggal', 'Keterangan', 'Pengeluaran', 'Pemasukan', 'Kategori'],
      [null, '1', '01/02/2026', '', 'Rp100.000', '', 'Makanan'],
      [null, '7', '04/02/2026', 'Netflix', 'Rp45.000', '', 'Elektronik'],
      [null, '8', '05/02/2026', 'Gaji', '', 'Rp5.000.000', 'Gaji'],
      [null, 'File ini dibuat oleh aplikasi catatan keuangan', null, null, null, null, null],
    ];
    const h = findHeaderRow(rows);
    expect(h).toBe(4);
    const m = guessMapping(rows[h]);
    expect(m).toMatchObject({ date: 2, note: 3, expense: 4, income: 5, category: 6 });
    const r = mapRows(rows.slice(h + 1), m);
    expect(r.skipped).toBe(1);
    expect(r.rows).toEqual([
      { date: '2026-02-01', type: 'out', amount: 100000, category: 'Makanan', note: '', wallet: undefined },
      { date: '2026-02-04', type: 'out', amount: 45000, category: 'Elektronik', note: 'Netflix', wallet: undefined },
      { date: '2026-02-05', type: 'in', amount: 5000000, category: 'Gaji', note: 'Gaji', wallet: undefined },
    ]);
  });
});
