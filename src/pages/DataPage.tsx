import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { ModalHeader, toast } from '../components/ui';
import { applyImport } from '../lib/applyImport';
import { exportAll, restoreAll, type BackupData } from '../lib/db';
import { backupToDrive, driveConfigured, restoreFromDrive } from '../lib/gdrive';
import { FIELD_LABELS, findHeaderRow, guessMapping, mapRows, readSheet, type Cell, type Field, type Mapping } from '../lib/importer';
import { longDate, rp, todayISO } from '../lib/format';
import { updateSettings, useSettings } from '../lib/settings';

export function DataPage({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  return (
    <div className="page">
      <ModalHeader title="Impor & Cadangan" onClose={onBack} />
      <ImportSection onDone={onDone} />
      <BackupSection />
    </div>
  );
}

function ImportSection({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Cell[][] | null>(null);
  const [header, setHeader] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [done, setDone] = useState<{ added: number; duplicates: number } | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(''); setDone(null); setShowMapping(false);
    try {
      const r = await readSheet(f);
      if (!r.length) throw new Error();
      const h = findHeaderRow(r);
      const m = guessMapping(r[h]);
      setRows(r); setHeader(h); setMapping(m); setFileName(f.name);
      setShowMapping(!mapRows(r.slice(h + 1), m).rows.length);
    } catch {
      setError('File tidak bisa dibaca. Pakai file Excel (.xlsx/.xls) atau CSV.');
      setRows(null);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const body = rows ? rows.slice(header + 1) : [];
  const result = rows ? mapRows(body, mapping) : null;
  const cols = rows ? Math.max(...rows.slice(header, header + 20).map((r) => r.length)) : 0;
  const colName = (i: number) => (rows && rows[header][i] != null && String(rows[header][i]).trim()) || `Kolom ${i + 1}`;
  const fields: Field[] = ['date', 'amount', 'type', 'income', 'expense', 'category', 'note'];

  async function doImport() {
    if (!result) return;
    setBusy(true);
    try {
      const r = await applyImport(result.rows);
      setDone({ added: r.added, duplicates: r.duplicates });
      setRows(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="section-label">Pindahkan catatan lama</div>
      {done && (
        <div className="card pad" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center', alignItems: 'center' }}>
          <span className="round-btn" style={{ background: 'var(--inc-soft)', color: 'var(--inc)' }}><Icon name="check" /></span>
          <strong style={{ fontSize: 18 }}>{done.added} transaksi masuk ke riwayat</strong>
          {done.duplicates > 0 && <span className="small muted">{done.duplicates} transaksi sudah ada sebelumnya, jadi tidak dimasukkan lagi.</span>}
          <button className="btn primary block" onClick={onDone}>Lihat di Beranda</button>
        </div>
      )}
      {!rows && (
        <div className="card pad" style={{ border: '2px dashed var(--acc)', background: 'var(--acc-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <span className="round-btn" style={{ background: 'var(--acc)', color: '#fff' }}><Icon name="upload" /></span>
          <strong>Unggah file dari aplikasi lama</strong>
          <span className="small muted">Excel (.xlsx/.xls) atau CSV hasil ekspor</span>
          <button className="btn primary" onClick={() => fileRef.current?.click()}>Pilih file</button>
        </div>
      )}
      {/* No accept filter: some Android apps hand over Excel files with a generic type, which a filter would grey out. */}
      <input ref={fileRef} type="file" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {error && <div className="notice err" role="alert">{error}</div>}

      {rows && result && (
        <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row"><Icon name="file" /><strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</strong>
            <button className="btn small" onClick={() => setRows(null)}>Batal</button></div>
          <div className="bold" style={{ fontSize: 17 }}>{result.rows.length} transaksi siap dimasukkan</div>
          <button className="btn primary block" disabled={!result.rows.length || busy} onClick={doImport}>{busy ? 'Memasukkan…' : `Masukkan ${result.rows.length} transaksi`}</button>
          {!result.rows.length && <div className="notice warn">Belum ada transaksi yang terbaca. Ketuk “Ubah pencocokan kolom” dan pilih kolom tanggal serta jumlahnya.</div>}
          {result.skipped > 0 && <div className="small muted">{result.skipped} baris dilewati karena tidak ada tanggal atau jumlahnya.</div>}
          {result.rows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tanggal</th><th>Kategori</th><th>Jumlah</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {result.rows.slice(0, 5).map((r, i) => (
                    <tr key={i}><td>{r.date}</td><td>{r.category}</td><td className={r.type === 'in' ? 'inc' : 'exp'}>{r.type === 'in' ? '+' : '−'}{rp(r.amount)}</td><td>{r.note}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowMapping(!showMapping)} aria-expanded={showMapping}>{showMapping ? 'Tutup pencocokan kolom' : 'Ubah pencocokan kolom'}</button>
          {showMapping && (
            <>
              <div className="small muted">Cocokkan kolom file dengan isian aplikasi. Saya sudah menebak, ubah kalau salah.</div>
              <div className="card fields">
                {fields.map((f) => (
                  <div className="field" key={f}>
                    <label htmlFor={`map-${f}`} style={{ width: 150 }}>{FIELD_LABELS[f]}</label>
                    <select id={`map-${f}`} value={mapping[f] ?? ''} onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                      <option value="">Tidak ada</option>
                      {Array.from({ length: cols }, (_, i) => <option key={i} value={i}>{colName(i)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function BackupSection() {
  const s = useSettings();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const jsonRef = useRef<HTMLInputElement>(null);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }

  const backupNow = () => run('backup', async () => {
    const at = await backupToDrive(true);
    updateSettings({ lastBackupAt: at.toISOString() });
    toast('Tercadang di Google Drive');
  });
  const restoreDrive = () => run('restore', async () => {
    if (!confirm('Data di HP ini akan diganti dengan cadangan dari Google Drive. Lanjutkan?')) return;
    const d = await restoreFromDrive();
    toast(`Dipulihkan: ${d.transactions.length} transaksi`);
  });
  const downloadJson = async () => {
    const data = await exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `catatan-keuangan-${todayISO()}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const restoreJson = (f: File | undefined) => f && run('json', async () => {
    const data = JSON.parse(await f.text()) as BackupData;
    if (!confirm(`Ganti semua data di HP ini dengan isi file (${data.transactions?.length ?? 0} transaksi)?`)) return;
    await restoreAll(data);
    toast('Data dipulihkan dari file');
  });

  const last = s.lastBackupAt ? new Date(s.lastBackupAt) : null;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="section-label">Cadangan Google Drive</div>
      {driveConfigured() ? (
        <>
          <div className="card fields">
            <div className="field">
              <label htmlFor="auto-backup" style={{ flex: 1, width: 'auto', color: 'var(--text)' }}>Cadangkan otomatis tiap hari</label>
              <input id="auto-backup" type="checkbox" checked={s.autoBackup} onChange={(e) => updateSettings({ autoBackup: e.target.checked })} style={{ flex: 'none', width: 22, height: 22, accentColor: 'var(--acc)' }} />
            </div>
            <div className="field"><span className="muted" style={{ flex: 1, fontSize: 14 }}>Terakhir dicadangkan</span><span className="bold" style={{ fontSize: 14 }}>{last ? `${longDate(todayISO(last))}, ${last.toTimeString().slice(0, 5).replace(':', '.')}` : 'Belum pernah'}</span></div>
          </div>
          <div className="grid2">
            <button className="btn primary" disabled={!!busy} onClick={backupNow}>{busy === 'backup' ? 'Mencadangkan…' : 'Cadangkan sekarang'}</button>
            <button className="btn" disabled={!!busy} onClick={restoreDrive}>{busy === 'restore' ? 'Memulihkan…' : 'Pulihkan dari Drive'}</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>File “Catatan Keuangan - cadangan.json” disimpan di Google Drive Anda. Aplikasi hanya bisa melihat file yang dibuatnya sendiri.</p>
        </>
      ) : (
        <div className="notice warn">Cadangan Google Drive belum diaktifkan di aplikasi ini. Sementara itu, simpan cadangan sebagai file di bawah, lalu unggah ke Drive secara manual.</div>
      )}
      {error && <div className="notice err" role="alert">{error}</div>}

      <div className="section-label" style={{ marginTop: 6 }}>Cadangan manual</div>
      <div className="grid2">
        <button className="btn" onClick={downloadJson}><Icon name="download" size={18} />Unduh file</button>
        <button className="btn" onClick={() => jsonRef.current?.click()}><Icon name="upload" size={18} />Pulihkan file</button>
      </div>
      <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={(e) => { restoreJson(e.target.files?.[0]); e.target.value = ''; }} />
      <p className="small muted" style={{ margin: 0 }}>Data tersimpan di HP ini. Rutin cadangkan supaya aman kalau HP hilang atau ganti HP.</p>
    </section>
  );
}
