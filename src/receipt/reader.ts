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

/** O leitor principal não funcionou neste aparelho: o motivo aparece na hora de conferir. */
export type ReadResult = ParsedReceipt & { fallbackReason?: string };

export interface ReceiptReader {
  read(image: Blob, onProgress: (p: ReadProgress) => void, signal: AbortSignal): Promise<ReadResult>;
}

const smartReader: ReceiptReader = {
  async read(image, onProgress, signal) {
    try {
      const { paddleReader } = await import('./paddle');
      return await paddleReader.read(image, onProgress, signal);
    } catch (err) {
      if (signal.aborted) throw err;
      const { tesseractReader } = await import('./tesseract');
      const reason = err instanceof Error ? err.message : String(err);
      return { ...(await tesseractReader.read(image, onProgress, signal)), fallbackReason: reason.slice(0, 120) || 'erro desconhecido' };
    }
  },
};

/** Leitor padrão. As partes pesadas são carregadas só quando a pessoa usa. */
export async function defaultReader(): Promise<ReceiptReader> {
  return smartReader;
}
