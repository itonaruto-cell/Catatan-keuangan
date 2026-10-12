import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { WalletKind } from '../lib/db';
import { Icon } from './Icon';

const PALETTE = [
  ['#e3ebff', '#1d4ed8'], ['#fdefd9', '#b45309'], ['#e4f5ea', '#15803d'], ['#fde7f3', '#be185d'],
  ['#ede5ff', '#6d28d9'], ['#dff5f3', '#0f766e'], ['#fde6e3', '#b91c1c'], ['#eef1f5', '#334155'],
];
const DARK_PALETTE = [
  ['#1a2a52', '#8db0ff'], ['#3a2a12', '#fbbf24'], ['#12301e', '#4ade80'], ['#3b1530', '#f472b6'],
  ['#2a1d4d', '#c4b5fd'], ['#0f2f2c', '#5eead4'], ['#3a1a1a', '#fca5a5'], ['#1e293b', '#cbd5e1'],
];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function useDark(): boolean {
  return useSyncExternalStore(
    (cb) => { const o = new MutationObserver(cb); o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] }); return () => o.disconnect(); },
    () => document.documentElement.dataset.mode === 'gelap',
  );
}

export function Badge({ label, round = false }: { label: string; round?: boolean }) {
  const dark = useDark();
  const [bg, fg] = (dark ? DARK_PALETTE : PALETTE)[hash(label) % PALETTE.length];
  const initials = label.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return <span className="ico" style={{ background: bg, color: fg, borderRadius: round ? 22 : 14 }} aria-hidden="true">{initials}</span>;
}

export function WalletIcon({ kind }: { kind: WalletKind }) {
  return <span className="ico" style={{ background: 'var(--acc-soft)', color: 'var(--acc-text)' }} aria-hidden="true"><Icon name={kind === 'bank' ? 'bank' : kind === 'cash' ? 'cash' : 'phone'} /></span>;
}

export function Modal({ children, onClose, full = false, label }: { children: ReactNode; onClose: () => void; full?: boolean; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${full ? ' full' : ''}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="row" style={{ marginLeft: -8 }}>
      <button className="round-btn" style={{ background: 'transparent' }} onClick={onClose} aria-label="Tutup"><Icon name="back" /></button>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
    </div>
  );
}

let toastMsg: string | null = null;
const toastListeners = new Set<() => void>();
let toastTimer: number | undefined;

export function toast(msg: string): void {
  toastMsg = msg;
  toastListeners.forEach((l) => l());
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastMsg = null; toastListeners.forEach((l) => l()); }, 2600);
}

export function Toaster() {
  const msg = useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l); }, () => toastMsg);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function MoneyField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value ? value.toLocaleString('id-ID') : '');
  useEffect(() => { setText(value ? value.toLocaleString('id-ID') : ''); }, [value]);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} inputMode="numeric" placeholder="0" value={text}
        onChange={(e) => { const v = Number(e.target.value.replace(/[^\d]/g, '')) || 0; setText(v ? v.toLocaleString('id-ID') : ''); onChange(v); }} />
    </div>
  );
}
