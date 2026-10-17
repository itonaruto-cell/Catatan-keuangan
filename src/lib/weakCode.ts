/** Too easy to guess: all one character, or a run like 12345678 / abcdefgh. */
export function weakCode(code: string): boolean {
  const c = code.trim().toLowerCase();
  if (c.length < 8 || new Set(c).size <= 2) return true;
  const seq = '0123456789abcdefghijklmnopqrstuvwxyz';
  return seq.includes(c) || [...seq].reverse().join('').includes(c) || ['password', 'katasandi', 'qwertyui', 'asdfghjk'].some((w) => c.startsWith(w));
}
