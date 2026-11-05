// A "peça trocável" da leitura da nota: a tela só conhece este contrato.
// O leitor padrão tenta primeiro os itens da NFC-e pela Sefaz (QR code do cupom) e, sem
// QR code, sem internet ou se a Sefaz falhar, lê a foto com o Tesseract no próprio celular
// (tesseract.ts). Uma IA no futuro seria mais um passo aqui (a chave fica numa função do Next).

import type { ParsedReceipt } from './parse';

export interface ReadProgress {
  /** De 0 a 1. */
  fraction: number;
  /** Frase curta para mostrar enquanto lê. */
  label: string;
}

/** De onde vieram os itens: muda o aviso na hora de conferir. */
export type ReceiptSource = 'sefaz' | 'celular';

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
      const { readFromSefaz } = await import('./online');
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
