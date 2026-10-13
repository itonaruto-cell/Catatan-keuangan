import { describe, expect, it } from 'vitest';
import { separateWallets } from './db';

describe('separateWallets', () => {
  it('keeps the balance each wallet showed, never below zero, and drops wallet links', () => {
    const txs = [
      { id: 1, type: 'out', amount: 215000, category: 'Hiburan', walletId: 1, date: '2026-10-13', note: '', createdAt: 1 },
      { id: 2, type: 'in', amount: 500000, category: 'Gaji', walletId: 2, date: '2026-10-13', note: '', createdAt: 2 },
      { id: 3, type: 'transfer', amount: 100000, category: 'Transfer', walletId: 2, toWalletId: 3, date: '2026-10-13', note: '', createdAt: 3 },
    ] as never[];
    const wallets = [
      { id: 1, name: 'Tunai', kind: 'cash', initialBalance: 0 },
      { id: 2, name: 'BCA', kind: 'bank', initialBalance: 1000000 },
      { id: 3, name: 'GoPay', kind: 'ewallet', initialBalance: 50000 },
    ] as never[];
    const r = separateWallets(txs, wallets);
    expect(r.wallets.map((w) => w.balance)).toEqual([0, 1400000, 150000]);
    expect(r.wallets[0]).not.toHaveProperty('initialBalance');
    expect(r.transactions).toHaveLength(2);
    expect(r.transactions[0]).not.toHaveProperty('walletId');
  });

  it('leaves current data as it is', () => {
    const w = { id: 1, name: 'BCA', kind: 'bank' as const, balance: 7 };
    expect(separateWallets([], [w]).wallets).toEqual([w]);
  });
});
