import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { db } from '../lib/db';
import { updateSettings, useSettings, type Accent, type Mode } from '../lib/settings';

const ACCENTS: { v: Accent; l: string; c: string }[] = [
  { v: 'biru', l: 'Biru', c: '#1d4ed8' },
  { v: 'hijau', l: 'Hijau', c: '#0b7a55' },
  { v: 'ungu', l: 'Ungu', c: '#6d28d9' },
  { v: 'merah', l: 'Merah', c: '#c2382b' },
  { v: 'jingga', l: 'Jingga', c: '#c2410c' },
];

export function Pengaturan({ onData }: { onData: () => void }) {
  const s = useSettings();
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [catType, setCatType] = useState<'out' | 'in'>('out');
  const [newCat, setNewCat] = useState('');

  async function addCat() {
    const name = newCat.trim();
    if (!name || categories.some((c) => c.type === catType && c.name.toLowerCase() === name.toLowerCase())) return;
    await db.categories.add({ name, type: catType });
    setNewCat('');
  }
  async function renameCat(id: number, old: string) {
    const name = prompt('Ganti nama kategori', old)?.trim();
    if (!name || name === old) return;
    await db.transaction('rw', db.categories, db.transactions, async () => {
      await db.categories.update(id, { name });
      await db.transactions.where('category').equals(old).modify({ category: name });
    });
  }
  async function deleteCat(id: number, name: string) {
    const used = await db.transactions.where('category').equals(name).count();
    if (used) { alert(`Kategori ${name} dipakai di ${used} transaksi. Ganti namanya saja kalau perlu.`); return; }
    if (confirm(`Hapus kategori ${name}?`)) await db.categories.delete(id);
  }

  return (
    <div className="page">
      <h1 className="page-title">Pengaturan</h1>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="section-label">Warna</div>
        <div className="card pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }} role="group" aria-label="Warna aplikasi">
          {ACCENTS.map((a) => (
            <button key={a.v} onClick={() => updateSettings({ accent: a.v })} aria-pressed={s.accent === a.v} style={{ border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: s.accent === a.v ? 700 : 500 }}>
              <span className={`swatch${s.accent === a.v ? ' on' : ''}`} style={{ background: a.c, display: 'block' }} />{a.l}
            </button>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="section-label">Mode</div>
        <div className="seg" role="group" aria-label="Mode terang atau gelap">
          {([['terang', 'Terang'], ['gelap', 'Gelap'], ['sistem', 'Ikuti HP']] as [Mode, string][]).map(([v, l]) => (
            <button key={v} aria-pressed={s.mode === v} onClick={() => updateSettings({ mode: v })}>{l}</button>
          ))}
        </div>
      </section>

      <button className="list item" onClick={onData} style={{ border: '1px solid var(--border)' }}>
        <span className="ico" style={{ background: 'var(--acc-soft)', color: 'var(--acc-text)' }}><Icon name="cloud" /></span>
        <span className="main"><span className="title" style={{ display: 'block' }}>Impor & cadangan</span><span className="sub" style={{ display: 'block' }}>Masukkan file lama, cadangkan ke Google Drive</span></span>
        <Icon name="chevR" />
      </button>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="section-label">Kategori</div>
        <div className="seg" role="group" aria-label="Jenis kategori">
          <button aria-pressed={catType === 'out'} onClick={() => setCatType('out')}>Pengeluaran</button>
          <button aria-pressed={catType === 'in'} onClick={() => setCatType('in')}>Pemasukan</button>
        </div>
        <div className="list">
          {categories.filter((c) => c.type === catType).map((c) => (
            <div key={c.id} className="item" style={{ paddingTop: 6, paddingBottom: 6 }}>
              <span className="main title">{c.name}</span>
              <button className="round-btn" style={{ width: 40, height: 40, background: 'transparent' }} onClick={() => renameCat(c.id!, c.name)} aria-label={`Ganti nama ${c.name}`}><Icon name="tag" size={18} /></button>
              <button className="round-btn" style={{ width: 40, height: 40, background: 'transparent', color: 'var(--exp)' }} onClick={() => deleteCat(c.id!, c.name)} aria-label={`Hapus ${c.name}`}><Icon name="trash" size={18} /></button>
            </div>
          ))}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); addCat(); }}>
          <label htmlFor="new-cat" className="sr-only">Kategori baru</label>
          <input id="new-cat" className="card" style={{ flex: 1, height: 48, padding: '0 14px', borderRadius: 24 }} placeholder="Kategori baru" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn primary" type="submit" disabled={!newCat.trim()}>Tambah</button>
        </form>
      </section>
    </div>
  );
}
