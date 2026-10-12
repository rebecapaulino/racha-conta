// Prepara a foto da nota para a leitura: gira conforme a câmera, ajusta o tamanho,
// tira a cor e estica o contraste (papel térmico costuma sair cinza e apagado).

/** Largura em que as letras da nota ficam com um tamanho bom para o leitor. */
const TARGET_WIDTH = 1600;
const MAX_HEIGHT = 5000;

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* navegador antigo: cai no <img> abaixo */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareReceipt(blob: Blob): Promise<HTMLCanvasElement> {
  const img = await decode(blob);
  const w0 = img.width;
  const h0 = img.height;
  if (!w0 || !h0) throw new Error('imagem vazia');

  let scale = Math.min(TARGET_WIDTH / w0, MAX_HEIGHT / h0);
  // Foto pequena demais: aumenta um pouco (até 2×) para as letras não ficarem miúdas.
  scale = Math.min(scale, 2);
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('sem canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  if ('close' in img) img.close();

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const gray = new Uint8ClampedArray(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    gray[j] = g;
    hist[gray[j]]++;
  }
  // Estica o contraste entre os 2% mais escuros e os 2% mais claros.
  const cut = (w * h) / 50;
  let lo = 0;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < cut; lo++);
  let hi = 255;
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < cut; hi--);
  const range = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = ((gray[j] - lo) * 255) / range;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}
