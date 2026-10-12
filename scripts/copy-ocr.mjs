// Copia para public/ocr os arquivos da leitura de nota (Tesseract), para o site servir
// tudo do próprio endereço: sem depender de outro site e funcionando sem internet depois.
// Roda sozinho antes do build e do dev (ver package.json).

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
const nm = (p) => join(root, 'node_modules', p);

const files = [
  [nm('tesseract.js/dist/worker.min.js'), 'worker.min.js'],
  // O celular baixa só uma destas três, conforme o processador.
  [nm('tesseract.js-core/tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [nm('tesseract.js-core/tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [nm('tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  // Português, versão compacta e precisa (~1,3 MB).
  [nm('@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz'), 'por.traineddata.gz'],
];

mkdirSync(out, { recursive: true });
for (const [from, name] of files) {
  if (!existsSync(from)) throw new Error(`Arquivo da leitura de nota não encontrado: ${from}`);
  copyFileSync(from, join(out, name));
}
console.log(`OCR: ${files.length} arquivos em public/ocr`);
