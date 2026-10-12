// Reads a receipt photo on the device with Tesseract (Indonesian + English).

import { totalFromReceipt } from './parse';

export async function readReceipt(file: File, onProgress?: (pct: number) => void): Promise<{ amount: number; merchant: string; text: string }> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['ind', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return { ...totalFromReceipt(data.text), text: data.text };
  } finally {
    await worker.terminate();
  }
}
