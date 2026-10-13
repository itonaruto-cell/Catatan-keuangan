// Browser speech recognition (Chrome on Android supports Indonesian).
// Without internet it uses the on-device recognizer when the browser offers one
// (Chrome's processLocally); otherwise voice entry needs a connection.

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  processLocally?: boolean;
  start(): void;
  stop(): void;
}

type LocalState = 'available' | 'downloadable' | 'downloading' | 'unavailable';
interface RecognitionCtor {
  new (): Recognition;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<LocalState>;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
}

function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const LOCAL = { langs: ['id-ID'], processLocally: true };

/** Whether Indonesian speech can be recognized on this device without internet. */
export async function offlineVoice(): Promise<LocalState | 'unsupported'> {
  const C = ctor();
  if (!C?.available) return 'unsupported';
  try { return await C.available(LOCAL); } catch { return 'unsupported'; }
}

/** Downloads the on-device Indonesian speech model. */
export async function installOfflineVoice(): Promise<boolean> {
  try { return (await ctor()?.install?.(LOCAL)) ?? false; } catch { return false; }
}

export function voiceSupported(): boolean {
  return !!ctor();
}

const NO_OFFLINE = 'Tanpa internet, input suara belum bisa di HP ini. Isi formnya secara manual.';

export function listen(handlers: {
  onText: (text: string, final: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}): () => void {
  const C = ctor();
  if (!C) {
    handlers.onError('Browser ini belum mendukung input suara. Coba pakai Chrome.');
    handlers.onEnd();
    return () => {};
  }
  let stopped = false;
  let r: Recognition | undefined;
  const start = (local: boolean) => {
    if (stopped) { handlers.onEnd(); return; }
    r = new C();
    if (local) r.processLocally = true;
    setup(r, handlers);
    r.start();
  };
  if (navigator.onLine) start(false);
  else offlineVoice().then((s) => {
    if (s === 'available') start(true);
    else { handlers.onError(s === 'downloadable' ? 'Suara offline belum diunduh. Unduh di Pengaturan saat online, atau isi formnya secara manual.' : NO_OFFLINE); handlers.onEnd(); }
  });
  return () => { stopped = true; r?.stop(); };
}

function setup(r: Recognition, handlers: Parameters<typeof listen>[0]) {
  r.lang = 'id-ID';
  r.interimResults = true;
  r.continuous = false;
  r.onresult = (e) => {
    let text = '';
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final = e.results[i].isFinal;
    }
    handlers.onText(text, final);
  };
  r.onerror = (e) => {
    const msg: Record<string, string> = {
      'not-allowed': 'Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser.',
      'no-speech': 'Tidak ada suara yang terdengar. Coba lagi.',
      network: NO_OFFLINE,
    };
    handlers.onError(msg[e.error] ?? `Input suara gagal (${e.error}).`);
  };
  r.onend = handlers.onEnd;
}
