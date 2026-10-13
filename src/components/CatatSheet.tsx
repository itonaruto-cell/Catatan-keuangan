import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db, type Transaction, type TxType } from '../lib/db';
import { nowTime, todayISO } from '../lib/format';
import { readReceipt } from '../lib/ocr';
import { parseSentence } from '../lib/parse';
import { listen, voiceSupported } from '../lib/voice';
import { Icon } from './Icon';
import { Modal, ModalHeader, toast } from './ui';

export function CatatSheet({ edit, initialType, onClose }: { edit?: Transaction; initialType?: TxType; onClose: () => void }) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];

  const [type, setType] = useState<TxType>(edit?.type ?? initialType ?? 'out');
  const [amount, setAmount] = useState(edit?.amount ?? 0);
  const [category, setCategory] = useState(edit?.category ?? '');
  const [date, setDate] = useState(edit?.date ?? todayISO());
  const [note, setNote] = useState(edit?.note ?? '');
  const [showAllCats, setShowAllCats] = useState(false);

  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [ocr, setOcr] = useState<number | null>(null);
  const [problem, setProblem] = useState('');
  const stopRef = useRef<() => void>(() => {});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => stopRef.current(), []);

  const catPool = categories.filter((c) => c.type === type);
  const visibleCats = showAllCats ? catPool : catPool.slice(0, 7);
  if (category && !visibleCats.some((c) => c.name === category)) {
    const c = catPool.find((x) => x.name === category);
    if (c) visibleCats.unshift(c);
  }

  function applyText(text: string) {
    const d = parseSentence(text, categories, []);
    setType(d.type);
    if (d.amount) setAmount(d.amount);
    if (d.category) setCategory(d.category);
    if (d.note) setNote(d.note);
  }

  function startVoice() {
    if (listening) { stopRef.current(); return; }
    setProblem('');
    setHeard('');
    setListening(true);
    stopRef.current = listen({
      onText: (t, final) => { setHeard(t); if (final) applyText(t); },
      onEnd: () => setListening(false),
      onError: (m) => setProblem(m),
    });
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setProblem('');
    setOcr(0);
    try {
      const r = await readReceipt(file, setOcr);
      if (!r.amount) setProblem('Total di struk tidak terbaca. Silakan isi jumlahnya sendiri.');
      else setAmount(r.amount);
      setType('out');
      if (!category && catPool.some((c) => c.name === 'Belanja')) setCategory('Belanja');
      if (r.merchant && !note) setNote(r.merchant.charAt(0) + r.merchant.slice(1).toLowerCase());
    } catch {
      setProblem('Foto struk gagal dibaca. Coba foto ulang dengan cahaya yang cukup, atau isi sendiri.');
    } finally {
      setOcr(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const valid = amount > 0 && !!category;

  async function save() {
    if (!valid) return;
    const tx: Transaction = {
      type, amount, category, date, note: note.trim(),
      time: edit?.time ?? (date === todayISO() ? nowTime() : undefined), createdAt: edit?.createdAt ?? Date.now(),
    };
    if (edit?.id) await db.transactions.update(edit.id, tx);
    else await db.transactions.add(tx);
    toast(edit ? 'Perubahan disimpan' : 'Transaksi dicatat');
    onClose();
  }

  async function remove() {
    if (!edit?.id || !confirm('Hapus transaksi ini?')) return;
    await db.transactions.delete(edit.id);
    toast('Transaksi dihapus');
    onClose();
  }

  return (
    <Modal onClose={onClose} full label={edit ? 'Ubah transaksi' : 'Catat transaksi'}>
      <ModalHeader title={edit ? 'Ubah Transaksi' : 'Catat Transaksi'} onClose={onClose} />

      {!edit && (
        <div className="grid2">
          <button className="auto-btn" onClick={() => fileRef.current?.click()} disabled={ocr !== null}>
            <span className="ico"><Icon name="camera" /></span>
            <span><span style={{ display: 'block' }}>Foto struk</span><span className="small muted">{ocr !== null ? `Membaca… ${ocr}%` : 'Terisi otomatis'}</span></span>
          </button>
          <button className={`auto-btn${listening ? ' live' : ''}`} onClick={startVoice} aria-pressed={listening}>
            <span className="ico"><Icon name="mic" /></span>
            <span><span style={{ display: 'block' }}>{listening ? 'Berhenti' : 'Bicara'}</span><span className="small muted">{listening ? 'Sedang mendengar…' : voiceSupported() ? 'Ucapkan transaksi' : 'Tidak didukung'}</span></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        </div>
      )}

      {heard && (
        <div className="card pad" style={{ borderStyle: 'dashed' }}>
          <div className="small muted">Yang saya dengar</div>
          <div style={{ fontStyle: 'italic', margin: '4px 0' }}>“{heard}”</div>
          {!listening && <div className="small bold" style={{ color: 'var(--acc-text)' }}>Form sudah terisi, cek lalu simpan</div>}
        </div>
      )}
      {problem && <div className="notice warn" role="alert">{problem}</div>}

      <div className="seg type" role="group" aria-label="Jenis transaksi">
        {([['out', 'Pengeluaran'], ['in', 'Pemasukan']] as const).map(([v, l]) => (
          <button key={v} className={v} aria-pressed={type === v} onClick={() => { setType(v); setCategory(''); }}>{l}</button>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <label htmlFor="tx-amount" className="small muted">Jumlah</label>
        <div className="amount-input">
          <span>Rp</span>
          <input id="tx-amount" inputMode="numeric" placeholder="0" autoFocus={!!edit} value={amount ? amount.toLocaleString('id-ID') : ''}
            size={Math.max(1, amount ? amount.toLocaleString('id-ID').length : 1)}
            onChange={(e) => setAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
        </div>
      </div>

      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Kategori</div>
        <div className="chips" role="group" aria-label="Kategori">
          {visibleCats.map((c) => (
            <button key={c.id} aria-pressed={category === c.name} onClick={() => setCategory(c.name)}>{c.name}</button>
          ))}
          {catPool.length > 7 && <button onClick={() => setShowAllCats(!showAllCats)}>{showAllCats ? 'Lebih sedikit' : `+ ${catPool.length - 7} lainnya`}</button>}
        </div>
      </div>

      <div className="card fields">
        <div className="field">
          <label htmlFor="tx-date">Tanggal</label>
          <input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
        </div>
        <div className="field">
          <label htmlFor="tx-note">Keterangan</label>
          <input id="tx-note" placeholder="Opsional" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <div className="row">
        {edit && <button className="btn danger" onClick={remove} aria-label="Hapus transaksi"><Icon name="trash" /></button>}
        <button className="btn primary block" disabled={!valid} onClick={save}>Simpan</button>
      </div>
    </Modal>
  );
}
