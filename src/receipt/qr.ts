// Acha o QR code do cupom na foto. Usa o leitor do próprio navegador quando existe (Android)
// e, senão, o jsQR (iPhone). O QR fica embaixo do cupom e é pequeno na foto inteira, então
// também procura em recortes da parte de baixo, ampliados.

import { decode } from './prepare';

type Source = ImageBitmap | HTMLImageElement;

interface Detector {
  detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } | undefined;

async function native(img: Source): Promise<string | null> {
  if (typeof BarcodeDetector === 'undefined') return null;
  try {
    if (!(await BarcodeDetector.getSupportedFormats()).includes('qr_code')) return null;
    const found = await new BarcodeDetector({ formats: ['qr_code'] }).detect(img);
    return found[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

/** Um pedaço da foto (de `top` a `bottom`, em frações da altura), redimensionado para `width` px (até 3×). */
function crop(img: Source, top: number, bottom: number, width: number): ImageData | null {
  const sy = Math.round(img.height * top);
  const sh = Math.round(img.height * (bottom - top));
  const scale = Math.min(3, width / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** O texto do QR code da foto, ou null se não achou nenhum. */
export async function findQr(blob: Blob): Promise<string | null> {
  const img = await decode(blob);
  try {
    const fromBrowser = await native(img);
    if (fromBrowser) return fromBrowser;
    const { default: jsQR } = await import('jsqr');
    // Da foto inteira para os recortes de baixo, cada vez mais de perto.
    // O QR da NFC-e é denso: em foto pequena, só é lido ampliado.
    const tries: [number, number, number][] = [[0, 1, 1920], [0.45, 1, 1920], [0.65, 1, 1920], [0.65, 1, 1400], [0.25, 0.75, 1920]];
    for (const [top, bottom, width] of tries) {
      const data = crop(img, top, bottom, width);
      const code = data && jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) return code.data;
    }
    return null;
  } finally {
    if ('close' in img) img.close();
  }
}
