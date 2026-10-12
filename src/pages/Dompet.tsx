import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal, ModalHeader, MoneyField, toast, WalletIcon } from '../components/ui';
import { db, walletBalances, type Wallet, type WalletKind } from '../lib/db';
import { rp, shortJuta } from '../lib/format';

const KIND_LABEL: Record<WalletKind, string> = { bank: 'Rekening bank', ewallet: 'E-wallet', cash: 'Tunai' };

export function Dompet({ onTransfer }: { onTransfer: () => void }) {
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? [];
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const [editing, setEditing] = useState<Wallet | 'new' | null>(null);

  const bal = walletBalances(wallets, txs);
  const total = [...bal.values()].reduce((a, b) => a + b, 0);
  const sumKind = (k: WalletKind) => wallets.filter((w) => w.kind === k).reduce((s, w) => s + (bal.get(w.id!) ?? 0), 0);

  return (
    <>
      <div className="hero" style={{ alignItems: 'stretch' }}>
        <div className="between">
          <h1 className="page-title">Dompet</h1>
          <button className="pill-btn" onClick={() => setEditing('new')}><Icon name="plus" size={16} stroke={2} />Tambah</button>
        </div>
        <div>
          <div className="hero-label">Total di semua dompet</div>
          <div className="hero-amount" style={{ textAlign: 'left' }}>{rp(total)}</div>
        </div>
        <div className="grid3">
          {(['bank', 'ewallet', 'cash'] as WalletKind[]).map((k) => (
            <div key={k} className="card" style={{ padding: 10, background: 'color-mix(in srgb, var(--card) 70%, transparent)', border: 'none' }}>
              <div className="small muted">{k === 'bank' ? 'Bank' : KIND_LABEL[k]}</div>
              <div className="bold" style={{ fontSize: 14 }}>{shortJuta(sumKind(k))}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sheet-body">
        {(['bank', 'ewallet', 'cash'] as WalletKind[]).map((k) => {
          const list = wallets.filter((w) => w.kind === k);
          if (!list.length) return null;
          return (
            <section key={k} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="section-label">{KIND_LABEL[k]}</div>
              <div className="list">
                {list.map((w) => (
                  <button key={w.id} className="item" onClick={() => setEditing(w)}>
                    <WalletIcon kind={w.kind} />
                    <span className="main"><span className="title" style={{ display: 'block' }}>{w.name}</span>{w.note && <span className="sub" style={{ display: 'block' }}>{w.note}</span>}</span>
                    <span className="amt">{rp(bal.get(w.id!) ?? 0)}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {wallets.length > 1 && <button className="btn" onClick={onTransfer}><Icon name="swap" size={18} />Pindahkan saldo antar dompet</button>}
      </div>

      {editing && <WalletForm wallet={editing === 'new' ? undefined : editing} balance={editing === 'new' ? 0 : bal.get(editing.id!) ?? 0} onClose={() => setEditing(null)} />}
    </>
  );
}

function WalletForm({ wallet, balance, onClose }: { wallet?: Wallet; balance: number; onClose: () => void }) {
  const [name, setName] = useState(wallet?.name ?? '');
  const [kind, setKind] = useState<WalletKind>(wallet?.kind ?? 'bank');
  const [note, setNote] = useState(wallet?.note ?? '');
  const [current, setCurrent] = useState(balance);

  async function save() {
    if (!name.trim()) return;
    if (wallet?.id) {
      // Changing the balance adjusts the starting balance so history stays intact.
      await db.wallets.update(wallet.id, { name: name.trim(), kind, note, initialBalance: wallet.initialBalance + (current - balance) });
    } else {
      await db.wallets.add({ name: name.trim(), kind, note, initialBalance: current });
    }
    toast('Dompet disimpan');
    onClose();
  }

  async function remove() {
    if (!wallet?.id) return;
    const used = await db.transactions.where('walletId').equals(wallet.id).count() + await db.transactions.filter((t) => t.toWalletId === wallet.id).count();
    if (used) { alert(`Dompet ini dipakai di ${used} transaksi, jadi tidak bisa dihapus.`); return; }
    if (!confirm(`Hapus dompet ${wallet.name}?`)) return;
    await db.wallets.delete(wallet.id);
    onClose();
  }

  return (
    <Modal onClose={onClose} label="Dompet">
      <div className="grab" />
      <ModalHeader title={wallet ? 'Ubah Dompet' : 'Tambah Dompet'} onClose={onClose} />
      <div className="seg" role="group" aria-label="Jenis dompet">
        {(['bank', 'ewallet', 'cash'] as WalletKind[]).map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'bank' ? 'Bank' : KIND_LABEL[k]}</button>)}
      </div>
      <div className="card fields">
        <div className="field"><label htmlFor="w-name">Nama</label><input id="w-name" placeholder={kind === 'bank' ? 'Bank BCA' : kind === 'ewallet' ? 'GoPay' : 'Dompet'} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <MoneyField id="w-bal" label="Saldo sekarang" value={current} onChange={setCurrent} />
        <div className="field"><label htmlFor="w-note">Catatan</label><input id="w-note" placeholder="Opsional" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <div className="row">
        {wallet && <button className="btn danger" onClick={remove} aria-label="Hapus dompet"><Icon name="trash" /></button>}
        <button className="btn primary block" disabled={!name.trim()} onClick={save}>Simpan</button>
      </div>
    </Modal>
  );
}
