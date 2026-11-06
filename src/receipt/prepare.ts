// Transforma a foto da nota num "scan" antes da leitura: gira conforme a câmera, acha o papel,
// endireita, ajusta o tamanho, tira a cor e iguala o fundo (papel térmico sai cinza e com sombra).

/** Largura em que as letras da nota ficam com um tamanho bom para o leitor. */
const TARGET_WIDTH = 1600;
const MAX_HEIGHT = 5000;
/** Lado maior usado para endireitar: mais que isso só gasta memória no celular. */
const SOURCE_EDGE = 4000;

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
  const mean = localMean(gray, w, h, Math.max(8, w >> 4));
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < out.length; i++) out[i] = (gray[i] * 255) / Math.max(1, mean[i]);
  return out;
}

/** A média de cada pixel numa janela de raio `r`. Com a soma acumulada, sai em tempo constante por pixel. */
function localMean(gray: Uint8ClampedArray, w: number, h: number, r: number): Float32Array {
  const sums = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let line = 0;
    for (let x = 0; x < w; x++) {
      line += gray[y * w + x];
      sums[(y + 1) * (w + 1) + x + 1] = sums[y * (w + 1) + x + 1] + line;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      out[y * w + x] =
        (sums[y1 * (w + 1) + x1] - sums[y0 * (w + 1) + x1] - sums[y1 * (w + 1) + x0] + sums[y0 * (w + 1) + x0]) /
        ((y1 - y0) * (x1 - x0));
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

export interface Point {
  x: number;
  y: number;
}

/** Os cantos do papel na foto: em cima à esquerda, em cima à direita, embaixo à direita, embaixo à esquerda. */
export type Quad = [Point, Point, Point, Point];

/** Quanto do brilho do papel um pixel precisa ter para contar como papel (reflexo da mesa fica abaixo). */
const PAPER_SHARE = 0.82;

/** Reta x = a·y + b que passa pelos pontos, sem se deixar levar pelos que fogem dela (guardanapo, outro papel). */
function fitEdge(points: Point[]): { a: number; b: number; share: number } | null {
  let kept = points;
  let a = 0;
  let b = 0;
  for (let round = 0; round < 4; round++) {
    if (kept.length < 8) return null;
    const my = kept.reduce((t, p) => t + p.y, 0) / kept.length;
    const mx = kept.reduce((t, p) => t + p.x, 0) / kept.length;
    const den = kept.reduce((t, p) => t + (p.y - my) ** 2, 0);
    if (!den) return null;
    a = kept.reduce((t, p) => t + (p.y - my) * (p.x - mx), 0) / den;
    b = mx - a * my;
    const errors = kept.map((p) => Math.abs(a * p.y + b - p.x)).sort((m, n) => m - n);
    const limit = Math.max(2, errors[errors.length >> 1] * 2.5);
    kept = kept.filter((p) => Math.abs(a * p.y + b - p.x) <= limit);
  }
  return { a, b, share: kept.length / points.length };
}

/**
 * Os quatro cantos de uma nota comprida na foto (`rgba` de w×h), como o scan do celular:
 * cada linha da foto dá a borda esquerda e a direita do papel, e as duas retas que passam
 * por elas dizem a inclinação e o quanto a nota afina com a distância. Na dúvida, devolve null.
 */
export function paperQuad(rgba: Uint8ClampedArray, w: number, h: number): Quad | null {
  const box = paperBox(rgba, w, h);
  if (!box) return null;
  const hist = new Uint32Array(256);
  for (let i = 0; i < rgba.length; i += 4) hist[(rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3 | 0]++;
  const cut = otsu(hist, w * h);
  const cx = Math.round(box.x + box.w / 2);
  const reach = Math.max(2, Math.round(w * 0.06));
  // As letras escuras não podem partir o papel: buracos curtos na linha contam como papel.
  const gap = Math.max(3, Math.round(w * 0.03));
  const lum = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
  };
  const spans: { y: number; left: number; right: number }[] = [];
  for (let y = 0; y < h; y++) {
    // O brilho do papel nesta linha, medido no meio da nota (a sombra muda de uma linha para outra).
    const around: number[] = [];
    for (let x = Math.max(0, cx - reach); x < Math.min(w, cx + reach); x++) around.push(lum(x, y));
    around.sort((m, n) => m - n);
    const base = around[(around.length * 3) >> 2];
    if (base <= cut) continue;
    const walk = (step: number) => {
      let edge = cx;
      for (let x = cx; x >= 0 && x < w && Math.abs(x - edge) <= gap; x += step) {
        const i = (y * w + x) * 4;
        const on = lum(x, y) > base * PAPER_SHARE && Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) < 60;
        if (on) edge = x;
      }
      return edge;
    };
    const l = walk(-1);
    const r = walk(1) + 1;
    if (r - l >= w * 0.15) spans.push({ y, left: l, right: r });
  }
  if (spans.length < h * 0.25) return null;

  const left = fitEdge(spans.map((s) => ({ x: s.left, y: s.y })));
  const right = fitEdge(spans.map((s) => ({ x: s.right, y: s.y })));
  if (!left || !right || left.share < 0.5 || right.share < 0.5) return null;
  const widthAt = (y: number) => right.a * y + right.b - (left.a * y + left.b);

  // Em cima e embaixo: as primeiras e últimas linhas com boa parte da largura da nota.
  const full = spans.filter((s) => s.right - s.left >= widthAt(s.y) * 0.5 && s.right - s.left <= widthAt(s.y) * 1.25);
  if (full.length < 8) return null;
  const top = full[0].y;
  const bottom = full[full.length - 1].y + 1;
  if (widthAt(top) <= 0 || widthAt(bottom) <= 0) return null;
  const ratio = widthAt(top) / widthAt(bottom);
  const tilt = Math.abs((left.a + right.a) / 2);
  if (ratio < 0.5 || ratio > 2 || tilt > 0.6) return null;

  // Folga para fora, para não comer letra encostada na borda; as beiradas seguem a inclinação da nota.
  const pad = Math.max(2, widthAt((top + bottom) / 2) * 0.02);
  const slope = -(left.a + right.a) / 2;
  const corner = (edge: { a: number; b: number }, side: number, y0: number, x0: number): Point => {
    // Cruza a borda lateral com a reta y = y0 + slope·(x - x0), perpendicular à nota.
    const y = (y0 + slope * (edge.b - x0)) / (1 - slope * edge.a);
    return { x: edge.a * y + edge.b + side * pad, y };
  };
  const midX = (top: number) => (left.a * top + left.b + right.a * top + right.b) / 2;
  return [
    corner(left, -1, top, midX(top)),
    corner(right, 1, top, midX(top)),
    corner(right, 1, bottom, midX(bottom)),
    corner(left, -1, bottom, midX(bottom)),
  ];
}

/**
 * Endireita o papel: gera uma imagem cinza W×H em que cada pixel vem do ponto certo da foto
 * (`rgba` de sw×sh), como se tivesse sido tirada bem de cima.
 */
export function straighten(rgba: Uint8ClampedArray, sw: number, sh: number, q: Quad, W: number, H: number): Uint8ClampedArray {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const k = (dx1 * sy - sx * dy1) / den;
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + k * p3.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + k * p3.y;

  const lum = (x: number, y: number) => {
    const i = (Math.min(sh - 1, Math.max(0, y)) * sw + Math.min(sw - 1, Math.max(0, x))) * 4;
    return rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
  };
  const out = new Uint8ClampedArray(W * H);
  for (let row = 0; row < H; row++) {
    const v = (row + 0.5) / H;
    for (let col = 0; col < W; col++) {
      const u = (col + 0.5) / W;
      const z = g * u + k * v + 1;
      const x = (a * u + b * v + p0.x) / z - 0.5;
      const y = (d * u + e * v + p0.y) / z - 0.5;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      out[row * W + col] =
        (lum(x0, y0) * (1 - fx) + lum(x0 + 1, y0) * fx) * (1 - fy) + (lum(x0, y0 + 1) * (1 - fx) + lum(x0 + 1, y0 + 1) * fx) * fy;
    }
  }
  return out;
}

/** Copia a foto para um canvas de até `edge` px no lado maior. */
function pixels(img: ImageBitmap | HTMLImageElement, edge: number) {
  const scale = Math.min(1, edge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('sem canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Nota endireitada, ou null se não achou os cantos do papel com segurança. */
function scanned(img: ImageBitmap | HTMLImageElement): { gray: Uint8ClampedArray; w: number; h: number } | null {
  const small = pixels(img, 480);
  const quad = paperQuad(small.data, small.w, small.h);
  if (!quad) return null;
  const photo = pixels(img, SOURCE_EDGE);
  const k = photo.w / small.w;
  const q = quad.map((p) => ({ x: p.x * k, y: p.y * k })) as Quad;
  const qw = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  const qh = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  const scale = Math.min(TARGET_WIDTH / qw, MAX_HEIGHT / qh, 3);
  const w = Math.max(1, Math.round(qw * scale));
  const h = Math.max(1, Math.round(qh * scale));
  return { gray: straighten(photo.data, photo.w, photo.h, q, w, h), w, h };
}

export async function prepareReceipt(blob: Blob): Promise<HTMLCanvasElement> {
  const img = await decode(blob);
  if (!img.width || !img.height) throw new Error('imagem vazia');

  const canvas = document.createElement('canvas');
  let page = scanned(img);
  if (!page) {
    // Sem os cantos: fica só o recorte reto do papel (ou a foto inteira).
    const box = findPaper(img) ?? { x: 0, y: 0, w: img.width, h: img.height };
    const scale = Math.min(TARGET_WIDTH / box.w, MAX_HEIGHT / box.h, 3);
    const w = Math.max(1, Math.round(box.w * scale));
    const h = Math.max(1, Math.round(box.h * scale));
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    if (!c) throw new Error('sem canvas');
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, w, h);
    const px = c.getImageData(0, 0, w, h).data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) gray[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    page = { gray, w, h };
  }
  if ('close' in img) img.close();

  canvas.width = page.w;
  canvas.height = page.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sem canvas');
  const flat = flatten(page.gray, page.w, page.h);
  const out = ctx.createImageData(page.w, page.h);
  for (let i = 0, j = 0; j < flat.length; i += 4, j++) {
    out.data[i] = out.data[i + 1] = out.data[i + 2] = flat[j];
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}
