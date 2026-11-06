// As partes puras do leitor PaddleOCR (paddle.ts): achar as caixas de texto no mapa do detector,
// decodificar a saída do reconhecedor e juntar as caixas em linhas. Sem nada do navegador.

import type { Point, Quad } from './prepare';

/** Pixel do mapa com mais que isto conta como texto. */
const PIXEL_MIN = 0.3;
/** Caixa com média abaixo disto é descartada (ruído). */
const BOX_MIN = 0.5;
/** Quanto a caixa cresce: o detector marca só o miolo das letras. */
const UNCLIP = 1.6;
const MAX_ANGLE = Math.PI / 6;

/** As caixas de texto no mapa de probabilidade (w×h) do detector, nas coordenadas do mapa. */
export function findBoxes(prob: Float32Array, w: number, h: number): Quad[] {
  const seen = new Uint8Array(w * h);
  const boxes: Quad[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || prob[start] <= PIXEL_MIN) continue;
    const members: number[] = [];
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const at = stack.pop()!;
      members.push(at);
      const x = at % w;
      const y = (at - x) / w;
      if (x > 0) visit(at - 1);
      if (x < w - 1) visit(at + 1);
      if (y > 0) visit(at - w);
      if (y < h - 1) visit(at + w);
    }
    const box = boxOf(members, prob, w);
    if (box) boxes.push(box);
  }
  return boxes;

  function visit(i: number) {
    if (!seen[i] && prob[i] > PIXEL_MIN) {
      seen[i] = 1;
      stack.push(i);
    }
  }
}

/** Retângulo (inclinado junto com o texto) que cobre os pixels de uma região. */
function boxOf(members: number[], prob: Float32Array, w: number): Quad | null {
  if (members.length < 9) return null;
  let sum = 0;
  let mx = 0;
  let my = 0;
  for (const i of members) {
    sum += prob[i];
    mx += i % w;
    my += Math.floor(i / w);
  }
  const n = members.length;
  if (sum / n < BOX_MIN) return null;
  mx /= n;
  my /= n;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const i of members) {
    const dx = (i % w) - mx;
    const dy = Math.floor(i / w) - my;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  // Direção principal da região; em região quase redonda ou muito inclinada, fica na horizontal.
  let angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  if (Math.abs(angle) > MAX_ANGLE || xx < yy * 4) angle = 0;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const i of members) {
    const dx = (i % w) - mx;
    const dy = Math.floor(i / w) - my;
    const u = dx * ux + dy * uy;
    const v = -dx * uy + dy * ux;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const len = maxU - minU + 1;
  const tall = maxV - minV + 1;
  if (tall < 3) return null;
  const grow = (len * tall * UNCLIP) / (2 * (len + tall));
  const at = (u: number, v: number): Point => ({ x: mx + u * ux - v * uy, y: my + u * uy + v * ux });
  return [
    at(minU - grow, minV - grow),
    at(maxU + 1 + grow, minV - grow),
    at(maxU + 1 + grow, maxV + 1 + grow),
    at(minU - grow, maxV + 1 + grow),
  ];
}

/** Lê a saída do reconhecedor (`steps`×`classes`): a classe 0 é o "vazio" e repetições seguidas valem uma letra. */
export function ctcDecode(scores: Float32Array, steps: number, classes: number, chars: string[]): string {
  let out = '';
  let last = 0;
  for (let t = 0; t < steps; t++) {
    let best = 0;
    let top = -Infinity;
    for (let c = 0; c < classes; c++) {
      const v = scores[t * classes + c];
      if (v > top) {
        top = v;
        best = c;
      }
    }
    if (best !== 0 && best !== last) out += chars[best - 1] ?? '';
    last = best;
  }
  return out;
}

export interface TextBox {
  corners: Quad;
  text: string;
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0;
const mid = (q: Quad, k: 'x' | 'y') => (q[0][k] + q[1][k] + q[2][k] + q[3][k]) / 4;

/**
 * Junta as caixas em linhas de texto, na ordem de leitura. O nome e o preço costumam vir em
 * caixas separadas; a inclinação das próprias caixas diz o que está na mesma linha, mesmo com a nota torta.
 */
export function joinLines(boxes: TextBox[]): string {
  const filled = boxes.filter((b) => b.text.trim());
  if (!filled.length) return '';
  const heights = filled.map((b) => Math.hypot(b.corners[3].x - b.corners[0].x, b.corners[3].y - b.corners[0].y));
  const tall = median(heights);
  // Só caixas compridas dão uma inclinação confiável.
  const slopes = filled
    .filter((b) => b.corners[1].x - b.corners[0].x > tall * 3)
    .map((b) => (b.corners[1].y - b.corners[0].y) / (b.corners[1].x - b.corners[0].x));
  const slope = median(slopes);
  const placed = filled
    .map((b) => ({ text: b.text.trim(), x: mid(b.corners, 'x'), y: mid(b.corners, 'y') - slope * mid(b.corners, 'x') }))
    .sort((a, b) => a.y - b.y);
  const lines: (typeof placed)[] = [];
  for (const box of placed) {
    const line = lines.at(-1);
    if (line && Math.abs(box.y - line.reduce((t, b) => t + b.y, 0) / line.length) < tall * 0.5) line.push(box);
    else lines.push([box]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x).map((b) => b.text).join('  ')).join('\n');
}
