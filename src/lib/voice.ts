// Browser speech recognition (Chrome on Android supports Indonesian).

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function ctor(): (new () => Recognition) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function voiceSupported(): boolean {
  return !!ctor();
}

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
  const r = new C();
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
      network: 'Input suara butuh koneksi internet.',
    };
    handlers.onError(msg[e.error] ?? `Input suara gagal (${e.error}).`);
  };
  r.onend = handlers.onEnd;
  r.start();
  return () => r.stop();
}
