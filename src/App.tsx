import { useEffect, useState } from 'react';
import { CatatSheet } from './components/CatatSheet';
import { Icon } from './components/Icon';
import { Toaster } from './components/ui';
import type { Transaction, TxType } from './lib/db';
import { backupToDrive, driveConfigured } from './lib/gdrive';
import { useOnline } from './lib/offline';
import { getSettings, updateSettings, useApplyTheme } from './lib/settings';
import { Aset } from './pages/Aset';
import { Beranda } from './pages/Beranda';
import { DataPage } from './pages/DataPage';
import { Dompet } from './pages/Dompet';
import { Laporan } from './pages/Laporan';
import { Pengaturan } from './pages/Pengaturan';

type Page = 'beranda' | 'dompet' | 'aset' | 'laporan' | 'pengaturan' | 'data';
type Sheet = { edit?: Transaction; type?: TxType } | null;

const NAV: { page: Page; label: string; icon: string }[] = [
  { page: 'beranda', label: 'Beranda', icon: 'home' },
  { page: 'dompet', label: 'Dompet', icon: 'wallet' },
  { page: 'aset', label: 'Aset', icon: 'trend' },
  { page: 'laporan', label: 'Laporan', icon: 'chart' },
];

function pageFromHash(): Page {
  const h = location.hash.slice(1) as Page;
  return ['beranda', 'dompet', 'aset', 'laporan', 'pengaturan', 'data'].includes(h) ? h : 'beranda';
}

export function App() {
  useApplyTheme();
  const [page, setPage] = useState<Page>(pageFromHash);
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    const on = () => setPage(pageFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  // Daily automatic backup, silently, once the user has connected Google Drive.
  // Offline it waits and runs as soon as the phone is back online.
  const online = useOnline();
  useEffect(() => {
    const s = getSettings();
    if (!online || !driveConfigured() || !s.autoBackup || !s.lastBackupAt) return;
    if (Date.now() - new Date(s.lastBackupAt).getTime() < 24 * 3600 * 1000) return;
    backupToDrive(false).then((at) => updateSettings({ lastBackupAt: at.toISOString() })).catch(() => {});
  }, [online]);

  const go = (p: Page) => { location.hash = p === 'beranda' ? '' : p; setPage(p); };

  return (
    <div className="app">
      {!online && <div className="offline-pill" role="status">Offline · data tetap tersimpan di HP</div>}
      <main>
        {page === 'beranda' && <Beranda onEdit={(t) => setSheet({ edit: t })} go={go} />}
        {page === 'dompet' && <Dompet />}
        {page === 'aset' && <Aset />}
        {page === 'laporan' && <Laporan onEdit={(t) => setSheet({ edit: t })} />}
        {page === 'pengaturan' && <Pengaturan onData={() => go('data')} />}
        {page === 'data' && <DataPage onBack={() => go('pengaturan')} onDone={() => go('beranda')} />}
      </main>

      <nav className="nav" aria-label="Menu utama">
        {NAV.slice(0, 2).map((n) => (
          <button key={n.page} aria-current={page === n.page ? 'page' : undefined} onClick={() => go(n.page)}><Icon name={n.icon} />{n.label}</button>
        ))}
        <div className="fab-wrap">
          <button className="fab" onClick={() => setSheet({})} aria-label="Catat transaksi"><Icon name="plus" size={26} stroke={2.2} /></button>
          <span aria-hidden="true">Catat</span>
        </div>
        {NAV.slice(2).map((n) => (
          <button key={n.page} aria-current={page === n.page ? 'page' : undefined} onClick={() => go(n.page)}><Icon name={n.icon} />{n.label}</button>
        ))}
      </nav>

      {sheet && <CatatSheet edit={sheet.edit} initialType={sheet.type} onClose={() => setSheet(null)} />}
      <Toaster />
    </div>
  );
}
