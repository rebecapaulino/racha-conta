// Prepara a foto da nota para a leitura: gira conforme a câmera, recorta o papel, ajusta o
// tamanho, tira a cor e iguala o fundo (papel térmico costuma sair cinza, apagado e com sombra).

/** Largura em que as letras da nota ficam com um tamanho bom para o leitor. */
const TARGET_WIDTH = 1600;
const MAX_HEIGHT = 5000;

export async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
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

/** Limiar de Otsu: o tom que melhor separa os pixels em claros e escuros. */
function otsu(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let at = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB || wB === total) continue;
    sumB += i * hist[i];
    const between = wB * (total - wB) * (sumB / wB - (sum - sumB) / (total - wB)) ** 2;
    if (between > best) {
      best = between;
      at = i;
    }
  }
  return at;
}

/** A maior sequência de posições com valor acima de `min`. */
function longestRun(values: number[], min: number): [number, number] | null {
  let found: [number, number] | null = null;
  let start = -1;
  for (let i = 0; i <= values.length; i++) {
    if (i < values.length && values[i] > min) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (!found || i - start > found[1] - found[0]) found = [start, i];
      start = -1;
    }
  }
  return found;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Onde está o papel na foto (`rgba` de w×h), para ler só ele: claro e sem cor, em colunas e
 * linhas seguidas. Na dúvida (quase a foto toda, ou pequeno demais) devolve null e lê tudo.
 */
export function paperBox(rgba: Uint8ClampedArray, w: number, h: number): Box | null {
  const hist = new Uint32Array(256);
  for (let i = 0; i < rgba.length; i += 4) hist[(rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3 | 0]++;
  const cut = otsu(hist, w * h);
  const cols = new Array<number>(w).fill(0);
  const rows = new Array<number>(h).fill(0);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const hi = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]);
      const lo = Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
      if ((rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3 > cut && hi - lo < 50) {
        cols[x]++;
        rows[y]++;
      }
    }
  }
  const across = longestRun(cols.map((c) => c / h), 0.3);
  const down = longestRun(rows.map((r) => r / w), 0.1);
  if (!across || !down) return null;
  const padX = Math.round(w * 0.02);
  const padY = Math.round(h * 0.02);
  const x = Math.max(0, across[0] - padX);
  const y = Math.max(0, down[0] - padY);
  const box = { x, y, w: Math.min(w, across[1] + padX) - x, h: Math.min(h, down[1] + padY) - y };
  const share = (box.w * box.h) / (w * h);
  return share < 0.1 || share > 0.9 || box.w < w * 0.2 ? null : box;
}

/**
 * Tira sombra e fundo: divide cada pixel pela média em volta dele. O papel fica branco por
 * igual e as letras continuam com os tons de cinza nas bordas (o leitor erra menos assim do
 * que em preto e branco puro).
 */
export function flatten(gray: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const r = Math.max(8, w >> 4);
  // Soma acumulada: a média de cada janela sai em tempo constante.
  const sums = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let line = 0;
    for (let x = 0; x < w; x++) {
      line += gray[y * w + x];
      sums[(y + 1) * (w + 1) + x + 1] = sums[y * (w + 1) + x + 1] + line;
    }
  }
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const mean =
        (sums[y1 * (w + 1) + x1] - sums[y0 * (w + 1) + x1] - sums[y1 * (w + 1) + x0] + sums[y0 * (w + 1) + x0]) /
        ((y1 - y0) * (x1 - x0));
      out[y * w + x] = (gray[y * w + x] * 255) / Math.max(1, mean);
    }
  }
  return out;
}

/** Procura o papel numa cópia pequena da foto (é só para achar o contorno). */
function findPaper(img: ImageBitmap | HTMLImageElement): Box | null {
  const scale = Math.min(1, 480 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const box = paperBox(ctx.getImageData(0, 0, w, h).data, w, h);
  return box && { x: box.x / scale, y: box.y / scale, w: box.w / scale, h: box.h / scale };
}

export async function prepareReceipt(blob: Blob): Promise<HTMLCanvasElement> {
  const img = await decode(blob);
  if (!img.width || !img.height) throw new Error('imagem vazia');
  const box = findPaper(img) ?? { x: 0, y: 0, w: img.width, h: img.height };

  // Foto pequena: amplia (até 3×) para as letras não ficarem miúdas.
  const scale = Math.min(TARGET_WIDTH / box.w, MAX_HEIGHT / box.h, 3);
  const w = Math.max(1, Math.round(box.w * scale));
  const h = Math.max(1, Math.round(box.h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('sem canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, w, h);
  if ('close' in img) img.close();

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) gray[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
  const flat = flatten(gray, w, h);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) px[i] = px[i + 1] = px[i + 2] = flat[j];
  ctx.putImageData(data, 0, 0);
  return canvas;
}
