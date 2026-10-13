import { db, type Transaction } from './db';
import type { ImportRow } from './importer';

/**
 * Saves imported rows, creating missing categories and wallets.
 * Rows already in the app are skipped, so importing the same file twice adds nothing;
 * identical rows within one file (two coffees on the same day) are all kept.
 */
export async function applyImport(rows: ImportRow[], fallbackWalletId: number, keepBalances = true): Promise<{ added: number; duplicates: number }> {
  return db.transaction('rw', [db.transactions, db.categories, db.wallets], async () => {
    const cats = await db.categories.toArray();
    const wallets = await db.wallets.toArray();
    const existing = new Map<string, number>();
    for (const t of await db.transactions.toArray()) existing.set(key(t), (existing.get(key(t)) ?? 0) + 1);
    const walletByName = new Map(wallets.map((w) => [w.name.toLowerCase(), w.id!]));
    const catKeys = new Set(cats.map((c) => `${c.type}|${c.name.toLowerCase()}`));

    const toAdd: Transaction[] = [];
    let duplicates = 0;
    const now = Date.now();
    for (const r of rows) {
      const catType = r.type === 'in' ? 'in' : 'out';
      if (!catKeys.has(`${catType}|${r.category.toLowerCase()}`)) {
        await db.categories.add({ name: r.category, type: catType });
        catKeys.add(`${catType}|${r.category.toLowerCase()}`);
      }
      let walletId = fallbackWalletId;
      if (r.wallet) {
        const k = r.wallet.toLowerCase();
        if (!walletByName.has(k)) {
          const id = await db.wallets.add({ name: r.wallet, kind: 'bank', initialBalance: 0 });
          walletByName.set(k, id as number);
        }
        walletId = walletByName.get(k)!;
      }
      const tx: Transaction = { type: r.type, amount: r.amount, category: r.category, walletId, date: r.date, note: r.note, createdAt: now };
      const k = key(tx);
      const left = existing.get(k) ?? 0;
      if (left > 0) { existing.set(k, left - 1); duplicates++; continue; }
      toAdd.push(tx);
    }
    await db.transactions.bulkAdd(toAdd);
    if (keepBalances) {
      // Old history should not change today's wallet balances: offset each wallet's starting balance.
      const net = new Map<number, number>();
      for (const t of toAdd) net.set(t.walletId, (net.get(t.walletId) ?? 0) + (t.type === 'in' ? t.amount : -t.amount));
      for (const [id, n] of net) {
        const w = await db.wallets.get(id);
        if (w) await db.wallets.update(id, { initialBalance: w.initialBalance - n });
      }
    }
    return { added: toAdd.length, duplicates };
  });
}

function key(t: Pick<Transaction, 'date' | 'type' | 'amount' | 'category' | 'note'>): string {
  return [t.date, t.type, t.amount, t.category.toLowerCase(), t.note.toLowerCase()].join('|');
}
