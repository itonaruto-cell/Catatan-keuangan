import { db, type Transaction } from './db';
import type { ImportRow } from './importer';

/**
 * Saves imported rows, creating missing categories. Wallet balances are not touched.
 * Rows already in the app are skipped, so importing the same file twice adds nothing;
 * identical rows within one file (two coffees on the same day) are all kept.
 */
export async function applyImport(rows: ImportRow[]): Promise<{ added: number; duplicates: number }> {
  return db.transaction('rw', [db.transactions, db.categories], async () => {
    const cats = await db.categories.toArray();
    const existing = new Map<string, number>();
    for (const t of await db.transactions.toArray()) existing.set(key(t), (existing.get(key(t)) ?? 0) + 1);
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
      const tx: Transaction = { type: r.type, amount: r.amount, category: r.category, date: r.date, note: r.note, createdAt: now };
      const k = key(tx);
      const left = existing.get(k) ?? 0;
      if (left > 0) { existing.set(k, left - 1); duplicates++; continue; }
      toAdd.push(tx);
    }
    await db.transactions.bulkAdd(toAdd);
    return { added: toAdd.length, duplicates };
  });
}

function key(t: Pick<Transaction, 'date' | 'type' | 'amount' | 'category' | 'note'>): string {
  return [t.date, t.type, t.amount, t.category.toLowerCase(), t.note.toLowerCase()].join('|');
}
