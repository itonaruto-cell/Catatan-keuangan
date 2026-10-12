import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Badge, Modal, ModalHeader, MoneyField, toast } from '../components/ui';
import { db, receivableRemaining, type Investment, type InvestmentKind, type Receivable } from '../lib/db';
import { shortDate, rp, todayISO } from '../lib/format';

const KINDS: { v: InvestmentKind; l: string; color: string }[] = [
  { v: 'deposito', l: 'Deposito', color: 'var(--acc)' },
  { v: 'reksadana', l: 'Reksadana', color: '#60a5fa' },
  { v: 'saham', l: 'Saham', color: '#f59e0b' },
  { v: 'emas', l: 'Emas', color: '#eab308' },
  { v: 'obligasi', l: 'Obligasi / SBN', color: '#14b8a6' },
  { v: 'crypto', l: 'Kripto', color: '#a855f7' },
  { v: 'lainnya', l: 'Lainnya', color: '#64748b' },
];
const kindLabel = (k: InvestmentKind) => KINDS.find((x) => x.v === k)!.l;

export function Aset() {
  const investments = useLiveQuery(() => db.investments.toArray(), []) ?? [];
  const receivables = useLiveQuery(() => db.receivables.toArray(), []) ?? [];
  const [tab, setTab] = useState<'inv' | 'piutang'>('inv');
  const [invForm, setInvForm] = useState<Investment | 'new' | null>(null);
  const [recForm, setRecForm] = useState<Receivable | 'new' | null>(null);

  const invTotal = investments.reduce((s, i) => s + i.currentValue, 0);
  const openRec = receivables.filter((r) => receivableRemaining(r) > 0);
  const recTotal = openRec.reduce((s, r) => s + receivableRemaining(r), 0);
  const total = invTotal + recTotal;

  const parts = [
    ...KINDS.map((k) => ({ label: k.l, color: k.color, value: investments.filter((i) => i.kind === k.v).reduce((s, i) => s + i.currentValue, 0) })),
    { label: 'Piutang', color: '#94a3b8', value: recTotal },
  ].filter((p) => p.value > 0);

  return (
    <>
      <div className="hero" style={{ alignItems: 'stretch' }}>
        <div className="between">
          <h1 className="page-title">Aset</h1>
          <button className="pill-btn" onClick={() => (tab === 'inv' ? setInvForm('new') : setRecForm('new'))}><Icon name="plus" size={16} stroke={2} />Tambah</button>
        </div>
        <div>
          <div className="hero-label">Investasi + piutang</div>
          <div className="hero-amount" style={{ textAlign: 'left' }}>{rp(total)}</div>
        </div>
        {total > 0 && (
          <>
            <div className="stack-bar" aria-hidden="true">{parts.map((p) => <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}</div>
            <div className="row small muted" style={{ flexWrap: 'wrap', gap: '4px 14px' }}>
              {parts.map((p) => <span key={p.label} className="row" style={{ gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: p.color }} />{p.label} {Math.round((p.value / total) * 100)}%</span>)}
            </div>
          </>
        )}
      </div>

      <div className="sheet-body">
        <div className="seg" role="group" aria-label="Jenis aset">
          <button aria-pressed={tab === 'inv'} onClick={() => setTab('inv')}>Investasi</button>
          <button aria-pressed={tab === 'piutang'} onClick={() => setTab('piutang')}>Piutang{openRec.length ? ` (${openRec.length})` : ''}</button>
        </div>

        {tab === 'inv' && (investments.length === 0
          ? <div className="empty">Belum ada investasi.<br />Catat deposito, saham, reksadana, emas, dan lainnya.</div>
          : <div className="list">
              {investments.map((i) => {
                const gain = i.currentValue - i.principal;
                const pct = i.principal ? (gain / i.principal) * 100 : 0;
                return (
                  <button key={i.id} className="item" onClick={() => setInvForm(i)}>
                    <Badge label={kindLabel(i.kind)} />
                    <span className="main">
                      <span className="title" style={{ display: 'block' }}>{i.name}</span>
                      <span className="sub" style={{ display: 'block' }}>
                        {kindLabel(i.kind)}{i.ratePct ? ` · ${i.ratePct.toLocaleString('id-ID')}%/th` : ''}{i.maturityDate ? ` · cair ${shortDate(i.maturityDate)}` : ''}
                      </span>
                    </span>
                    <span className="right">
                      <span className="amt" style={{ display: 'block', fontSize: 14 }}>{rp(i.currentValue)}</span>
                      {gain !== 0 && <span className={`small bold ${gain > 0 ? 'inc' : 'exp'}`}>{rp(gain, true)} ({pct.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%)</span>}
                    </span>
                  </button>
                );
              })}
            </div>)}

        {tab === 'piutang' && (receivables.length === 0
          ? <div className="empty">Belum ada piutang.<br />Catat uang yang dipinjam teman supaya tidak lupa.</div>
          : <div className="list">
              {[...receivables].sort((a, b) => receivableRemaining(b) - receivableRemaining(a) || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9')).map((r) => {
                const left = receivableRemaining(r);
                const overdue = left > 0 && r.dueDate && r.dueDate < todayISO();
                return (
                  <button key={r.id} className="item" onClick={() => setRecForm(r)} style={{ opacity: left > 0 ? 1 : 0.6 }}>
                    <Badge label={r.name} round />
                    <span className="main">
                      <span className="title" style={{ display: 'block' }}>{r.name}</span>
                      <span className="sub" style={{ display: 'block', color: overdue ? 'var(--exp)' : undefined }}>
                        {left <= 0 ? 'Lunas' : r.payments.length ? `Sudah dicicil ${rp(r.amount - left)}` : r.dueDate ? `${overdue ? 'Lewat' : 'Janji bayar'} ${shortDate(r.dueDate)}` : r.note || `Pinjam ${shortDate(r.date)}`}
                      </span>
                    </span>
                    <span className="amt" style={{ textDecoration: left <= 0 ? 'line-through' : undefined }}>{rp(left > 0 ? left : r.amount)}</span>
                  </button>
                );
              })}
            </div>)}
      </div>

      {invForm && <InvestmentForm inv={invForm === 'new' ? undefined : invForm} onClose={() => setInvForm(null)} />}
      {recForm && <ReceivableForm rec={recForm === 'new' ? undefined : recForm} onClose={() => setRecForm(null)} />}
    </>
  );
}

function InvestmentForm({ inv, onClose }: { inv?: Investment; onClose: () => void }) {
  const [f, setF] = useState<Investment>(inv ?? { name: '', kind: 'deposito', principal: 0, currentValue: 0, startDate: todayISO() });
  const set = (p: Partial<Investment>) => setF({ ...f, ...p });

  async function save() {
    const data = { ...f, name: f.name.trim(), currentValue: f.currentValue || f.principal };
    if (inv?.id) await db.investments.update(inv.id, data); else await db.investments.add(data);
    toast('Investasi disimpan');
    onClose();
  }
  async function remove() {
    if (inv?.id && confirm(`Hapus ${inv.name}?`)) { await db.investments.delete(inv.id); onClose(); }
  }

  return (
    <Modal onClose={onClose} label="Investasi">
      <div className="grab" />
      <ModalHeader title={inv ? 'Ubah Investasi' : 'Tambah Investasi'} onClose={onClose} />
      <div className="chips" role="group" aria-label="Jenis investasi">
        {KINDS.map((k) => <button key={k.v} aria-pressed={f.kind === k.v} onClick={() => set({ kind: k.v })}>{k.l}</button>)}
      </div>
      <div className="card fields">
        <div className="field"><label htmlFor="i-name">Nama</label><input id="i-name" placeholder={f.kind === 'saham' ? 'BBCA · 4 lot' : f.kind === 'deposito' ? 'Deposito BCA' : 'Nama produk'} value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <MoneyField id="i-principal" label="Modal" value={f.principal} onChange={(v) => set({ principal: v })} />
        <MoneyField id="i-value" label="Nilai sekarang" value={f.currentValue} onChange={(v) => set({ currentValue: v })} />
        <div className="field"><label htmlFor="i-start">Mulai</label><input id="i-start" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></div>
        {(f.kind === 'deposito' || f.kind === 'obligasi') && <>
          <div className="field"><label htmlFor="i-rate">Bunga %/th</label><input id="i-rate" inputMode="decimal" placeholder="4,5" value={f.ratePct?.toString().replace('.', ',') ?? ''} onChange={(e) => set({ ratePct: Number(e.target.value.replace(',', '.')) || undefined })} /></div>
          <div className="field"><label htmlFor="i-mat">Jatuh tempo</label><input id="i-mat" type="date" value={f.maturityDate ?? ''} onChange={(e) => set({ maturityDate: e.target.value || undefined })} /></div>
        </>}
        <div className="field"><label htmlFor="i-note">Catatan</label><input id="i-note" placeholder="Opsional" value={f.note ?? ''} onChange={(e) => set({ note: e.target.value })} /></div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Perbarui “Nilai sekarang” kapan saja untuk melihat untung atau rugi.</p>
      <div className="row">
        {inv && <button className="btn danger" onClick={remove} aria-label="Hapus investasi"><Icon name="trash" /></button>}
        <button className="btn primary block" disabled={!f.name.trim() || !f.principal} onClick={save}>Simpan</button>
      </div>
    </Modal>
  );
}

function ReceivableForm({ rec, onClose }: { rec?: Receivable; onClose: () => void }) {
  const [f, setF] = useState<Receivable>(rec ?? { name: '', amount: 0, date: todayISO(), payments: [] });
  const [pay, setPay] = useState(0);
  const set = (p: Partial<Receivable>) => setF({ ...f, ...p });
  const left = receivableRemaining(f);

  async function save(next = f) {
    const data = { ...next, name: next.name.trim() };
    if (rec?.id) await db.receivables.update(rec.id, data); else await db.receivables.add(data);
    toast('Piutang disimpan');
    onClose();
  }
  async function remove() {
    if (rec?.id && confirm(`Hapus piutang ${rec.name}?`)) { await db.receivables.delete(rec.id); onClose(); }
  }
  const reminder = `Halo ${f.name}, mau mengingatkan soal pinjaman ${rp(left)}${f.dueDate ? ` yang janjinya dibayar ${shortDate(f.dueDate)}` : ''}. Terima kasih ya.`;

  return (
    <Modal onClose={onClose} label="Piutang">
      <div className="grab" />
      <ModalHeader title={rec ? 'Piutang' : 'Tambah Piutang'} onClose={onClose} />
      <div className="card fields">
        <div className="field"><label htmlFor="r-name">Nama teman</label><input id="r-name" value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <MoneyField id="r-amount" label="Jumlah pinjam" value={f.amount} onChange={(v) => set({ amount: v })} />
        <div className="field"><label htmlFor="r-date">Tanggal pinjam</label><input id="r-date" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></div>
        <div className="field"><label htmlFor="r-due">Janji bayar</label><input id="r-due" type="date" value={f.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || undefined })} /></div>
        <div className="field"><label htmlFor="r-note">Keterangan</label><input id="r-note" placeholder="Opsional" value={f.note ?? ''} onChange={(e) => set({ note: e.target.value })} /></div>
      </div>

      {rec && (
        <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="between"><span className="bold">Sisa</span><span className="bold">{rp(Math.max(left, 0))}</span></div>
          <div className="bar"><span style={{ width: `${Math.min(100, ((f.amount - left) / (f.amount || 1)) * 100)}%` }} /></div>
          {f.payments.map((p, i) => <div key={i} className="between small muted"><span>Dibayar {shortDate(p.date)}</span><span>{rp(p.amount)}</span></div>)}
          {left > 0 && <>
            <div className="card fields"><MoneyField id="r-pay" label="Bayar cicilan" value={pay} onChange={setPay} /></div>
            <div className="grid2">
              <button className="btn small" disabled={!pay} onClick={() => save({ ...f, payments: [...f.payments, { amount: Math.min(pay, left), date: todayISO() }] })}>Catat cicilan</button>
              <button className="btn small" onClick={() => save({ ...f, payments: [...f.payments, { amount: left, date: todayISO() }] })}>Tandai lunas</button>
            </div>
            <a className="btn small" href={`https://wa.me/?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Kirim pengingat lewat WhatsApp</a>
          </>}
        </div>
      )}

      <div className="row">
        {rec && <button className="btn danger" onClick={remove} aria-label="Hapus piutang"><Icon name="trash" /></button>}
        <button className="btn primary block" disabled={!f.name.trim() || !f.amount} onClick={() => save()}>Simpan</button>
      </div>
    </Modal>
  );
}
