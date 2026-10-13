// Build step for full offline use: bundles the receipt reader (Tesseract worker,
// core and Indonesian + English language data) into /ocr/ and writes sw.js with
// the list of every file the app needs, so it all gets saved on the device.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);
const pkgDir = (name: string) => dirname(require.resolve(`${name}/package.json`));

const OCR_FILES: [string, string][] = [
  ['ocr/worker.min.js', join(pkgDir('tesseract.js'), 'dist/worker.min.js')],
  ['ocr/tesseract-core-lstm.wasm.js', join(pkgDir('tesseract.js-core'), 'tesseract-core-lstm.wasm.js')],
  ['ocr/tesseract-core-simd-lstm.wasm.js', join(pkgDir('tesseract.js-core'), 'tesseract-core-simd-lstm.wasm.js')],
  ['ocr/lang/ind.traineddata.gz', join(pkgDir('@tesseract.js-data/ind'), '4.0.0_best_int/ind.traineddata.gz')],
  ['ocr/lang/eng.traineddata.gz', join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz')],
];

export function offline(): Plugin {
  let publicDir = '';
  return {
    name: 'offline',
    apply: 'build',
    configResolved(c) { publicDir = c.publicDir; },
    generateBundle(_, bundle) {
      const ocrHash = createHash('sha256');
      for (const [fileName, src] of OCR_FILES) {
        const source = readFileSync(src);
        ocrHash.update(source);
        this.emitFile({ type: 'asset', fileName, source });
      }
      const pub = publicDir ? readdirSync(publicDir) : [];
      const app = ['/', ...pub, ...Object.keys(bundle).filter((f) => !f.startsWith('ocr/') && !f.endsWith('.map') && f !== 'index.html')].map((f) => (f === '/' ? f : `/${f}`)).sort();
      const appHash = createHash('sha256').update(app.join('\n'));
      for (const f of pub) appHash.update(readFileSync(join(publicDir, f)));
      for (const f of Object.values(bundle)) if (!f.fileName.startsWith('ocr/')) appHash.update(f.type === 'chunk' ? f.code : f.source);
      const sw = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8')
        .replace('__APP_VERSION__', appHash.digest('hex').slice(0, 10))
        .replace('__OCR_VERSION__', ocrHash.digest('hex').slice(0, 10))
        .replace('__APP_FILES__', JSON.stringify(app));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}
