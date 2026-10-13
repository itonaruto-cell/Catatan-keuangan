import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Badge } from '../components/ui';
import { db, receivableRemaining, walletBalances, type Transaction } from '../lib/db';
import { dayLabel, MONTHS, MONTHS_SHORT, parseISO, rp, todayISO } from '../lib/format';

type Mode = 'harian' | 'mingguan' | 'bulanan' | 'tahunan';

export function Beranda({ onEdit, go }: { onEdit: (t: Transaction) => void; go: (p: 'laporan' | 'aset' | 'pengaturan' | 'data') => void }) {
  const [mode, setMode] = useState<Mode>('harian');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const txs = useLiveQuery(() => db.transactions.toArray(), []) ?? [];
  const wallets = useLiveQuery(() => db.wallets.toArray(), []) ?? [];
  const receivables = useLiveQuery(() => db.receivables.toArray(), []) ?? [];

  const balances = walletBalances(wallets, txs);
  const total = [...balances.values()].reduce((a, b) => a + b, 0);
  const walletName = new Map(wallets.map((w) => [w.id!, w.name]));

  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  const inScope = (t: Transaction) =>
    mode === 'tahunan' ? true : mode === 'bulanan' ? t.date.startsWith(String(year)) : t.date.startsWith(ym);
  const scoped = txs.filter(inScope);
  const income = scoped.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const expense = scoped.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);

  function shift(d: number) {
    if (mode === 'bulanan') { setYear(year + d); return; }
    let m = month + d, y = year;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  const today = todayISO();
  const soon = new Date(); soon.setDate(soon.getDate() + 7);
  const dueSoon = receivables.filter((r) => receivableRemaining(r) > 0 && r.dueDate && r.dueDate <= todayISO(soon));

  const periodLabel = mode === 'tahunan' ? 'Semua tahun' : mode === 'bulanan' ? String(year) : `${MONTHS[month]} ${year}`;

  return (
    <>
      <div className="hero">
        <div className="hero-top">
          <button className="round-btn" onClick={() => go('pengaturan')} aria-label="Pengaturan"><Icon name="settings" /></button>
          <div className="row" style={{ gap: 4 }}>
            {mode !== 'tahunan' && <button className="round-btn" style={{ width: 36, height: 36 }} onClick={() => shift(-1)} aria-label="Sebelumnya"><Icon name="chevL" size={18} /></button>}
            <div className="pill-btn" aria-live="polite">{periodLabel}</div>
            {mode !== 'tahunan' && <button className="round-btn" style={{ width: 36, height: 36 }} onClick={() => shift(1)} aria-label="Berikutnya"><Icon name="chevR" size={18} /></button>}
          </div>
          <button className="round-btn" onClick={() => go('aset')} aria-label="Pengingat piutang" style={{ position: 'relative' }}>
            <Icon name="bell" />
            {dueSoon.length > 0 && <span style={{ position: 'absolute', top: 9, right: 11, width: 9, height: 9, borderRadius: 5, background: 'var(--exp)' }} />}
          </button>
        </div>
        <div className="hero-label">Total Saldo</div>
        <div className="hero-amount">{rp(total)}</div>
        <div className="chip">Tersebar di {wallets.length} dompet</div>
      </div>

      <div className="sheet-body">
        <div className="seg" role="group" aria-label="Periode">
          {(['harian', 'mingguan', 'bulanan', 'tahunan'] as Mode[]).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m[0].toUpperCase() + m.slice(1)}</button>
          ))}
        </div>

        <div className="grid2">
          <div className="card stat">
            <span className="ico" style={{ background: 'var(--inc-soft)', color: 'var(--inc)' }}><Icon name="up" size={18} stroke={2} /></span>
            <span className="label">Pemasukan</span>
            <span className="value">{rp(income)}</span>
          </div>
          <div className="card stat">
            <span className="ico" style={{ background: 'var(--exp-soft)', color: 'var(--exp)' }}><Icon name="down" size={18} stroke={2} /></span>
            <span className="label">Pengeluaran</span>
            <span className="value">{rp(expense)}</span>
          </div>
        </div>

        {dueSoon.length > 0 && (
          <button className="notice warn row" style={{ border: 'none', textAlign: 'left' }} onClick={() => go('aset')}>
            <Icon name="bell" size={18} />
            <span style={{ flex: 1 }}>{dueSoon.map((r) => `${r.name} (${rp(receivableRemaining(r))})`).join(', ')} jatuh tempo minggu ini</span>
          </button>
        )}

        <button className="btn" style={{ justifyContent: 'flex-start', borderRadius: 14, background: 'var(--acc-soft)' }} onClick={() => go('laporan')}>
          <span style={{ color: 'var(--acc-text)' }}><Icon name="sparkle" /></span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>Lihat ringkasan per kategori</span>
          <span style={{ color: 'var(--acc-text)' }}>Lihat</span>
        </button>

        {txs.length === 0 && (
          <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong>Punya catatan dari aplikasi lama?</strong>
            <span className="small muted">Unggah file Excel atau CSV-nya supaya riwayat lama ikut masuk.</span>
            <button className="btn primary" onClick={() => go('data')}><Icon name="upload" size={18} />Impor file Excel</button>
          </div>
        )}

        <h2 style={{ margin: '4px 0 0', fontSize: 18 }}>Transaksi</h2>
        {mode === 'harian' && <DailyList txs={scoped} today={today} walletName={walletName} onEdit={onEdit} />}
        {mode === 'mingguan' && <WeeklyList txs={scoped} year={year} month={month} />}
        {mode === 'bulanan' && <PeriodRows rows={MONTHS.map((name, i) => ({ label: name, key: `${year}-${String(i + 1).padStart(2, '0')}` })).filter((r) => r.key <= today.slice(0, 7) || scoped.some((t) => t.date.startsWith(r.key))).reverse()} txs={scoped} onPick={(k) => { setMonth(Number(k.slice(5)) - 1); setMode('harian'); }} />}
        {mode === 'tahunan' && <PeriodRows rows={[...new Set(txs.map((t) => t.date.slice(0, 4)))].sort().reverse().map((y) => ({ label: y, key: y }))} txs={scoped} onPick={(k) => { setYear(Number(k)); setMode('bulanan'); }} />}
      </div>
    </>
  );
}

function DailyList({ txs, today, walletName, onEdit }: { txs: Transaction[]; today: string; walletName: Map<number, string>; onEdit: (t: Transaction) => void }) {
  if (!txs.length) return <div className="empty">Belum ada transaksi di bulan ini.<br />Tekan tombol + untuk mencatat.</div>;
  const byDate = new Map<string, Transaction[]>();
  for (const t of [...txs].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')) || b.createdAt - a.createdAt)) {
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date)!.push(t);
  }
  return (
    <>
      {[...byDate].map(([date, list]) => {
        const out = list.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
        const inn = list.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
        return (
          <section key={date} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="between small muted" style={{ fontSize: 13 }}>
              <span>{dayLabel(date, today)}</span>
              <span>{inn > 0 && <span className="inc">+{rp(inn)} </span>}{out > 0 && <span>−{rp(out)}</span>}</span>
            </div>
            <div className="list">
              {list.map((t) => (
                <button key={t.id} className="item" onClick={() => onEdit(t)}>
                  {t.type === 'transfer'
                    ? <span className="ico" style={{ background: 'var(--acc-soft)', color: 'var(--acc-text)' }}><Icon name="swap" /></span>
                    : <Badge label={t.category} />}
                  <span className="main">
                    <span className="title" style={{ display: 'block' }}>{t.note || t.category}</span>
                    <span className="sub" style={{ display: 'block' }}>
                      {t.type === 'transfer' ? `${walletName.get(t.walletId)} → ${walletName.get(t.toWalletId!)}` : `${t.category} · ${walletName.get(t.walletId) ?? '-'}`}
                    </span>
                  </span>
                  <span className="right">
                    <span className={`amt ${t.type === 'in' ? 'inc' : t.type === 'out' ? 'exp' : ''}`} style={{ display: 'block' }}>
                      {t.type === 'in' ? '+' : t.type === 'out' ? '−' : ''}{rp(t.amount)}
                    </span>
                    {t.time && <span className="small muted">{t.time}</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function WeeklyList({ txs, year, month }: { txs: Transaction[]; year: number; month: number }) {
  const days = new Date(year, month + 1, 0).getDate();
  const weeks: { label: string; from: number; to: number }[] = [];
  for (let d = 1; d <= days; d += 7) weeks.push({ from: d, to: Math.min(d + 6, days), label: '' });
  return (
    <div className="list">
      {weeks.reverse().map((w) => {
        const list = txs.filter((t) => { const d = parseISO(t.date).getDate(); return d >= w.from && d <= w.to; });
        const inn = list.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
        const out = list.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
        return (
          <div key={w.from} className="item">
            <span className="main">
              <span className="title" style={{ display: 'block' }}>{w.from}–{w.to} {MONTHS_SHORT[month]}</span>
              <span className="sub" style={{ display: 'block' }}>{list.length} transaksi</span>
            </span>
            <span className="right">
              <span className="small inc" style={{ display: 'block' }}>+{rp(inn)}</span>
              <span className="amt exp">−{rp(out)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PeriodRows({ rows, txs, onPick }: { rows: { label: string; key: string }[]; txs: Transaction[]; onPick: (k: string) => void }) {
  if (!rows.length) return <div className="empty">Belum ada transaksi.</div>;
  return (
    <div className="list">
      {rows.map((r) => {
        const list = txs.filter((t) => t.date.startsWith(r.key));
        const inn = list.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
        const out = list.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
        return (
          <button key={r.key} className="item" onClick={() => onPick(r.key)}>
            <span className="main">
              <span className="title" style={{ display: 'block' }}>{r.label}</span>
              <span className="sub" style={{ display: 'block' }}>Selisih {rp(inn - out)}</span>
            </span>
            <span className="right">
              <span className="small inc" style={{ display: 'block' }}>+{rp(inn)}</span>
              <span className="amt exp">−{rp(out)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
