import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { db, type Transaction } from '../lib/db';
import { MONTHS, rp } from '../lib/format';

export function Laporan() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];

  const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
  const cur = txs.filter((t) => t.date.startsWith(key(year, month)));
  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  const prev = txs.filter((t) => t.date.startsWith(key(prevY, prevM)));

  function shift(d: number) {
    let m = month + d, y = year;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  const out = sum(cur, 'out');
  const prevOut = sum(prev, 'out');
  const diff = out - prevOut;

  return (
    <div className="page">
      <div className="between">
        <h1 className="page-title">Laporan</h1>
        <div className="row" style={{ gap: 4 }}>
          <button className="round-btn" style={{ width: 36, height: 36 }} onClick={() => shift(-1)} aria-label="Bulan sebelumnya"><Icon name="chevL" size={18} /></button>
          <span className="bold" aria-live="polite">{MONTHS[month].slice(0, 3)} {year}</span>
          <button className="round-btn" style={{ width: 36, height: 36 }} onClick={() => shift(1)} aria-label="Bulan berikutnya"><Icon name="chevR" size={18} /></button>
        </div>
      </div>

      <div className="grid2">
        <div className="card stat"><span className="label">Pemasukan</span><span className="value inc">{rp(sum(cur, 'in'))}</span></div>
        <div className="card stat"><span className="label">Pengeluaran</span><span className="value exp">{rp(out)}</span></div>
      </div>
      {prevOut > 0 && (
        <div className="notice info">
          Pengeluaran {diff > 0 ? 'naik' : 'turun'} {rp(Math.abs(diff))} ({Math.abs(Math.round((diff / prevOut) * 100))}%) dibanding {MONTHS[prevM]}.
        </div>
      )}

      <Breakdown title="Pengeluaran per kategori" txs={cur.filter((t) => t.type === 'out')} prev={prev.filter((t) => t.type === 'out')} />
      <Breakdown title="Pemasukan per kategori" txs={cur.filter((t) => t.type === 'in')} />
    </div>
  );
}

function sum(txs: Transaction[], type: 'in' | 'out') {
  return txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}

function Breakdown({ title, txs, prev }: { title: string; txs: Transaction[]; prev?: Transaction[] }) {
  const by = new Map<string, number>();
  for (const t of txs) by.set(t.category, (by.get(t.category) ?? 0) + t.amount);
  const rows = [...by].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 1;
  const total = rows.reduce((s, r) => s + r[1], 0);
  const prevBy = new Map<string, number>();
  for (const t of prev ?? []) prevBy.set(t.category, (prevBy.get(t.category) ?? 0) + t.amount);

  return (
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="between"><h2 style={{ margin: 0, fontSize: 15 }}>{title}</h2><span className="bold">{rp(total)}</span></div>
      {rows.length === 0 && <div className="muted small">Belum ada data bulan ini.</div>}
      {rows.map(([cat, v]) => {
        const p = prevBy.get(cat);
        return (
          <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="between small">
              <span>{cat} <span className="muted">· {Math.round((v / total) * 100)}%</span></span>
              <span className="bold">{rp(v)}{p ? <span className="muted" style={{ fontWeight: 400 }}> (bln lalu {rp(p)})</span> : null}</span>
            </div>
            <div className="bar"><span style={{ width: `${(v / max) * 100}%` }} /></div>
          </div>
        );
      })}
    </section>
  );
}
