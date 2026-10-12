import { db, type Transaction } from './db';
import type { ImportRow } from './importer';

/** Saves imported rows, creating missing categories and wallets. Skips exact duplicates. */
export async function applyImport(rows: ImportRow[], fallbackWalletId: number): Promise<{ added: number; duplicates: number }> {
  return db.transaction('rw', [db.transactions, db.categories, db.wallets], async () => {
    const cats = await db.categories.toArray();
    const wallets = await db.wallets.toArray();
    const existing = new Set((await db.transactions.toArray()).map(key));
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
      if (existing.has(key(tx))) { duplicates++; continue; }
      existing.add(key(tx));
      toAdd.push(tx);
    }
    await db.transactions.bulkAdd(toAdd);
    return { added: toAdd.length, duplicates };
  });
}

function key(t: Pick<Transaction, 'date' | 'type' | 'amount' | 'category' | 'note'>): string {
  return [t.date, t.type, t.amount, t.category.toLowerCase(), t.note.toLowerCase()].join('|');
}
