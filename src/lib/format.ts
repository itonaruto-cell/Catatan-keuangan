const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function rp(n: number, sign = false): string {
  const s = 'Rp' + rupiah.format(Math.abs(Math.round(n)));
  if (n < 0) return '−' + s;
  if (sign && n > 0) return '+' + s;
  return s;
}

export function num(n: number): string {
  return rupiah.format(Math.round(n));
}

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowTime(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayLabel(iso: string, today = todayISO()): string {
  if (iso === today) return 'Hari ini';
  const t = parseISO(today);
  t.setDate(t.getDate() - 1);
  if (iso === todayISO(t)) return 'Kemarin';
  const d = parseISO(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function longDate(iso: string): string {
  const d = parseISO(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function shortJuta(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (a >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
  if (a >= 1_000) return `Rp${(n / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return rp(n);
}

export function shortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
