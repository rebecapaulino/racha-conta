// A "peça trocável" da leitura da nota: a tela só conhece este contrato.
// O leitor padrão tenta, do mais preciso para o menos: os itens da NFC-e pela Sefaz (QR code),
// a foto lida com IA (rota /api/ler-nota) e, sem internet ou se os dois falharem, o
// Tesseract no próprio celular (tesseract.ts).

import type { ParsedReceipt } from './parse';

export interface ReadProgress {
  /** De 0 a 1. */
  fraction: number;
  /** Frase curta para mostrar enquanto lê. */
  label: string;
}

/** De onde vieram os itens: muda o aviso na hora de conferir. */
export type ReceiptSource = 'sefaz' | 'ia' | 'celular';

export interface ReceiptReader {
  read(image: Blob, onProgress: (p: ReadProgress) => void, signal: AbortSignal): Promise<ParsedReceipt & { source?: ReceiptSource }>;
}

const aborted = () => new DOMException('cancelado', 'AbortError');

/** Barra andando sozinha enquanto espera o servidor (de `from` até perto de `to`). */
function ticking(onProgress: (p: ReadProgress) => void, label: string, from: number, to: number): () => void {
  const started = Date.now();
  const tick = () => onProgress({ fraction: from + (to - from) * (1 - Math.exp(-(Date.now() - started) / 6000)), label });
  tick();
  const timer = window.setInterval(tick, 250);
  return () => window.clearInterval(timer);
}

const smartReader: ReceiptReader = {
  async read(image, onProgress, signal) {
    const report = (p: ReadProgress) => !signal.aborted && onProgress(p);
    if (navigator.onLine) {
      const { readFromSefaz, readWithAi } = await import('./online');
      report({ fraction: 0.03, label: 'Procurando o QR code da nota…' });
      let stop = () => {};
      try {
        const sefaz = await readFromSefaz(image, signal, () => {
          stop = ticking(report, 'Buscando os itens na Sefaz…', 0.1, 0.9);
        });
        stop();
        if (signal.aborted) throw aborted();
        if (sefaz) {
          report({ fraction: 1, label: 'Pronto' });
          return { ...sefaz, source: 'sefaz' };
        }
        stop = ticking(report, 'Lendo os itens da nota…', 0.1, 0.92);
        const ai = await readWithAi(image, signal);
        stop();
        if (signal.aborted) throw aborted();
        if (ai) {
          report({ fraction: 1, label: 'Pronto' });
          return { ...ai, source: 'ia' };
        }
      } catch {
        stop();
        if (signal.aborted) throw aborted();
        // Rede caiu no meio: segue para o leitor do celular.
      }
    }
    const { tesseractReader } = await import('./tesseract');
    return { ...(await tesseractReader.read(image, onProgress, signal)), source: 'celular' };
  },
};

/** Leitor padrão. As partes pesadas são carregadas só quando a pessoa usa. */
export async function defaultReader(): Promise<ReceiptReader> {
  return smartReader;
}
