// Leitor da nota com o Tesseract, rodando no próprio celular (sem servidor).
// Os arquivos vêm do próprio site (/ocr, ver scripts/copy-ocr.mjs) e ficam guardados no
// aparelho depois do primeiro uso, então a leitura funciona até sem internet.

import { parseReceipt } from './parse';
import { prepareReceipt } from './prepare';
import type { ReadProgress, ReceiptReader } from './reader';

const LABELS: Record<string, string> = {
  'loading tesseract core': 'Preparando o leitor…',
  'initializing tesseract': 'Preparando o leitor…',
  'loading language traineddata': 'Carregando o português…',
  'initializing api': 'Preparando o leitor…',
  'recognizing text': 'Lendo os itens da nota…',
};

export const tesseractReader: ReceiptReader = {
  async read(image, onProgress, signal) {
    const report = (p: ReadProgress) => !signal.aborted && onProgress(p);
    report({ fraction: 0.02, label: 'Ajustando a foto…' });
    const canvas = await prepareReceipt(image);
    if (signal.aborted) throw new DOMException('cancelado', 'AbortError');

    const { createWorker, OEM, PSM } = await import('tesseract.js');
    const base = `${window.location.origin}/ocr`;
    const worker = await createWorker('por', OEM.LSTM_ONLY, {
      workerPath: `${base}/worker.min.js`,
      // Carrega o leitor direto do endereço do site (e não de uma cópia temporária):
      // assim o service worker também atende os arquivos dele e a leitura funciona offline.
      workerBlobURL: false,
      corePath: base,
      langPath: base,
      logger: (m: { status: string; progress: number }) => {
        // Preparar ocupa os primeiros 30% da barra; ler a nota, o resto.
        const reading = m.status === 'recognizing text';
        report({
          fraction: reading ? 0.3 + m.progress * 0.68 : 0.05 + Math.min(1, m.progress) * 0.25,
          label: LABELS[m.status] ?? 'Preparando o leitor…',
        });
      },
    });
    const stop = () => void worker.terminate();
    signal.addEventListener('abort', stop, { once: true });
    try {
      // Lê a nota como um bloco só: assim o preço fica na mesma linha do nome mesmo com a foto
      // um pouco torta (o modo "coluna" separava os dois). Manter os espaços ajuda a achar o preço.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
      const { data } = await worker.recognize(canvas);
      if (signal.aborted) throw new DOMException('cancelado', 'AbortError');
      report({ fraction: 1, label: 'Pronto' });
      return parseReceipt(data.text);
    } finally {
      signal.removeEventListener('abort', stop);
      // Libera a memória: o leitor é pesado para ficar aberto no celular.
      await worker.terminate().catch(() => {});
    }
  },
};
