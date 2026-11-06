// A "peça trocável" da leitura da nota: a tela só conhece este contrato.
// O leitor padrão é o PaddleOCR no próprio celular (paddle.ts); se ele não carregar neste
// aparelho (pouca memória, navegador antigo), cai no Tesseract (tesseract.ts).

import type { ParsedReceipt } from './parse';

export interface ReadProgress {
  /** De 0 a 1. */
  fraction: number;
  /** Frase curta para mostrar enquanto lê. */
  label: string;
}

export interface ReceiptReader {
  read(image: Blob, onProgress: (p: ReadProgress) => void, signal: AbortSignal): Promise<ParsedReceipt>;
}

const smartReader: ReceiptReader = {
  async read(image, onProgress, signal) {
    try {
      const { paddleReader } = await import('./paddle');
      return await paddleReader.read(image, onProgress, signal);
    } catch (err) {
      if (signal.aborted) throw err;
      const { tesseractReader } = await import('./tesseract');
      return tesseractReader.read(image, onProgress, signal);
    }
  },
};

/** Leitor padrão. As partes pesadas são carregadas só quando a pessoa usa. */
export async function defaultReader(): Promise<ReceiptReader> {
  return smartReader;
}
