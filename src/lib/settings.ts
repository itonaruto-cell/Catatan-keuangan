import { useEffect, useSyncExternalStore } from 'react';

export type Accent = 'biru' | 'hijau' | 'ungu' | 'merah' | 'jingga';
export type Mode = 'terang' | 'gelap' | 'sistem';

export interface Settings {
  accent: Accent;
  mode: Mode;
  autoBackup: boolean;
  lastBackupAt?: string;
}

const KEY = 'ck-settings';
const DEFAULTS: Settings = { accent: 'biru', mode: 'terang', autoBackup: true };

function read(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage unavailable: keep in memory
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
  );
}

/** Applies accent and light/dark mode to the document. */
export function useApplyTheme(): void {
  const { accent, mode } = useSettings();
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'gelap' || (mode === 'sistem' && mq.matches);
      document.documentElement.dataset.accent = accent;
      document.documentElement.dataset.mode = dark ? 'gelap' : 'terang';
      const meta = document.querySelector('meta[name="theme-color"]');
      meta?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--hero-1').trim() || '#cfdffb');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [accent, mode]);
}
