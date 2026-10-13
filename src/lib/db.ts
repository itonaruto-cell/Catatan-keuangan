import Dexie, { type EntityTable } from 'dexie';

export type TxType = 'out' | 'in';

export interface Transaction {
  id?: number;
  type: TxType;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  note: string;
  createdAt: number;
}

export type WalletKind = 'bank' | 'ewallet' | 'cash';

export interface Wallet {
  id?: number;
  name: string;
  kind: WalletKind;
  /** Typed in by the user; transactions never change it. */
  balance: number;
  note?: string;
}

export interface Category {
  id?: number;
  name: string;
  type: 'out' | 'in';
}

export type InvestmentKind = 'deposito' | 'saham' | 'reksadana' | 'emas' | 'obligasi' | 'crypto' | 'lainnya';

export interface Investment {
  id?: number;
  name: string;
  kind: InvestmentKind;
  principal: number;
  currentValue: number;
  startDate: string;
  maturityDate?: string;
  ratePct?: number;
  note?: string;
}

export interface Payment {
  amount: number;
  date: string;
}

export interface Receivable {
  id?: number;
  name: string;
  amount: number;
  date: string;
  dueDate?: string;
  note?: string;
  payments: Payment[];
}

export const db = new Dexie('catatan-keuangan') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  wallets: EntityTable<Wallet, 'id'>;
  categories: EntityTable<Category, 'id'>;
  investments: EntityTable<Investment, 'id'>;
  receivables: EntityTable<Receivable, 'id'>;
};

db.version(1).stores({
  transactions: '++id, date, type, category, walletId',
  wallets: '++id, name',
  categories: '++id, name, type',
  investments: '++id, kind',
  receivables: '++id, name',
});

// v2: wallets are just balances the user keeps up to date; transactions no longer touch them.
db.version(2).stores({ transactions: '++id, date, type, category' }).upgrade(async (tx) => {
  const { transactions, wallets } = separateWallets(await tx.table('transactions').toArray(), await tx.table('wallets').toArray());
  await tx.table('transactions').clear();
  await tx.table('transactions').bulkAdd(transactions);
  await tx.table('wallets').bulkPut(wallets);
});

type LegacyTx = Omit<Transaction, 'type'> & { type: TxType | 'transfer'; walletId?: number; toWalletId?: number };
type LegacyWallet = Wallet & { initialBalance?: number };

/** Converts data from before v2: each wallet keeps the balance it showed (never below zero), wallet transfers are dropped. */
export function separateWallets(txs: LegacyTx[], wallets: LegacyWallet[]): { transactions: Transaction[]; wallets: Wallet[] } {
  return {
    wallets: wallets.map(({ initialBalance, ...w }) => {
      if (initialBalance === undefined) return w;
      let b = initialBalance;
      for (const t of txs) {
        if (t.walletId === w.id) b += t.type === 'in' ? t.amount : -t.amount;
        if (t.type === 'transfer' && t.toWalletId === w.id) b += t.amount;
      }
      return { ...w, balance: Math.max(0, b) };
    }),
    transactions: txs.filter((t) => t.type !== 'transfer').map(({ walletId: _w, toWalletId: _t, ...t }) => t as Transaction),
  };
}

export const DEFAULT_OUT_CATEGORIES = [
  'Belanja', 'Bensin', 'Buah-buahan', 'Cemilan', 'Elektronik', 'Hadiah', 'Hiburan', 'Kantor',
  'Kecantikan', 'Kesehatan', 'Makanan', 'Motor', 'Pakaian', 'Pendidikan', 'Rumah', 'Tagihan',
  'Transportasi', 'Lain-lain',
];
export const DEFAULT_IN_CATEGORIES = ['Gaji', 'Bonus', 'Hadiah', 'Penjualan', 'Bunga & dividen', 'Lain-lain'];

db.on('populate', async () => {
  await db.categories.bulkAdd([
    ...DEFAULT_OUT_CATEGORIES.map((name) => ({ name, type: 'out' as const })),
    ...DEFAULT_IN_CATEGORIES.map((name) => ({ name, type: 'in' as const })),
  ]);
});

export function receivableRemaining(r: Receivable): number {
  return r.amount - r.payments.reduce((s, p) => s + p.amount, 0);
}


export interface BackupData {
  app: 'catatan-keuangan';
  version: 1;
  exportedAt: string;
  transactions: Transaction[];
  wallets: Wallet[];
  categories: Category[];
  investments: Investment[];
  receivables: Receivable[];
}

export async function exportAll(): Promise<BackupData> {
  return {
    app: 'catatan-keuangan',
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: await db.transactions.toArray(),
    wallets: await db.wallets.toArray(),
    categories: await db.categories.toArray(),
    investments: await db.investments.toArray(),
    receivables: await db.receivables.toArray(),
  };
}

export async function restoreAll(data: BackupData): Promise<void> {
  if (data.app !== 'catatan-keuangan') throw new Error('File ini bukan cadangan Catatan Keuangan.');
  await db.transaction('rw', [db.transactions, db.wallets, db.categories, db.investments, db.receivables], async () => {
    await Promise.all([db.transactions.clear(), db.wallets.clear(), db.categories.clear(), db.investments.clear(), db.receivables.clear()]);
    const { transactions, wallets } = separateWallets(data.transactions, data.wallets);
    await db.transactions.bulkAdd(transactions);
    await db.wallets.bulkAdd(wallets);
    await db.categories.bulkAdd(data.categories);
    await db.investments.bulkAdd(data.investments);
    await db.receivables.bulkAdd(data.receivables);
  });
}
