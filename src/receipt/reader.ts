// A "peça trocável" da leitura da nota: a tela só conhece este contrato.
// Hoje quem cumpre é o Tesseract, no próprio celular (tesseract.ts). Se um dia a leitura
// passar para uma IA, basta outro leitor com o mesmo formato (a chave fica numa função do Next).

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

/** Leitor padrão. Carregado só quando a pessoa usa (os arquivos são grandes). */
export async function defaultReader(): Promise<ReceiptReader> {
  const { tesseractReader } = await import('./tesseract');
  return tesseractReader;
}
