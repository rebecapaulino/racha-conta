import { describe, expect, it } from 'vitest';
import { flatten, paperBox, paperQuad, straighten, type Quad } from './prepare';

/** Foto sintética w×h: fundo marrom com um retângulo de papel claro. */
function photo(w: number, h: number, paper: { x: number; y: number; w: number; h: number } | null) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const on = paper && x >= paper.x && x < paper.x + paper.w && y >= paper.y && y < paper.y + paper.h;
      px.set(on ? [235, 235, 230, 255] : [120, 90, 60, 255], i);
    }
  }
  return px;
}

describe('achar o papel na foto', () => {
  it('recorta o papel, com uma folga', () => {
    const b = paperBox(photo(200, 300, { x: 60, y: 30, w: 80, h: 240 }), 200, 300)!;
    expect(b.x).toBeLessThanOrEqual(60);
    expect(b.x).toBeGreaterThanOrEqual(50);
    expect(b.x + b.w).toBeGreaterThanOrEqual(140);
    expect(b.x + b.w).toBeLessThanOrEqual(150);
    expect(b.y).toBeLessThanOrEqual(30);
    expect(b.y + b.h).toBeGreaterThanOrEqual(270);
  });

  it('papel ocupando a foto quase toda, ou foto sem papel: não recorta', () => {
    expect(paperBox(photo(200, 300, { x: 2, y: 2, w: 196, h: 296 }), 200, 300)).toBeNull();
    expect(paperBox(photo(200, 300, null), 200, 300)).toBeNull();
  });
});

describe('igualar o fundo', () => {
  it('sombra de um lado some, e a letra continua escura', () => {
    const w = 200;
    const h = 40;
    const gray = new Uint8ClampedArray(w * h);
    // Papel que escurece da direita (230) para a esquerda (110), com um traço escuro em cada ponta.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) gray[y * w + x] = 110 + (120 * x) / w;
    for (const x of [30, 170]) for (let y = 10; y < 30; y++) gray[y * w + x] = gray[y * w + x] * 0.3;
    const out = flatten(gray, w, h);
    const at = (x: number, y: number) => out[y * w + x];
    expect(Math.abs(at(10, 5) - at(190, 5))).toBeLessThan(25);
    expect(at(30, 20)).toBeLessThan(120);
    expect(at(170, 20)).toBeLessThan(120);
  });
});

/** Foto sintética: fundo escuro e um papel de lados dados por `left(y)` e `right(y)`, de `top` a `bottom`. */
function tilted(w: number, h: number, left: (y: number) => number, right: (y: number) => number, top = 0, bottom = h) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const on = y >= top && y < bottom && x >= left(y) && x < right(y);
      px.set(on ? [230, 225, 215, 255] : [110, 85, 60, 255], i);
    }
  }
  return px;
}

describe('endireitar a nota', () => {
  it('nota afinando com a distância: acha os quatro cantos', () => {
    const left = (y: number) => 100 - y * 0.05;
    const right = (y: number) => 240 + y * 0.05;
    const q = paperQuad(tilted(360, 480, left, right, 10, 470), 360, 480)!;
    const [tl, tr, br, bl] = q;
    expect(tl.x).toBeCloseTo(left(10), -1);
    expect(tr.x).toBeCloseTo(right(10), -1);
    expect(bl.x).toBeCloseTo(left(470), -1);
    expect(br.x).toBeCloseTo(right(470), -1);
    expect(tl.y).toBeLessThan(25);
    expect(bl.y).toBeGreaterThan(455);
  });

  it('um reflexo mais escuro encostado no papel não conta como papel', () => {
    const w = 360;
    const h = 480;
    const px = tilted(w, h, () => 100, () => 250);
    // Reflexo na mesa, à direita do papel: claro, mas bem menos que o papel.
    for (let y = 0; y < h; y++) for (let x = 250; x < 330; x++) px.set([165, 160, 150, 255], (y * w + x) * 4);
    const q = paperQuad(px, w, h);
    expect(q).not.toBeNull();
    expect(q![1].x).toBeLessThan(265);
  });

  it('foto sem papel: não inventa cantos', () => {
    expect(paperQuad(photo(200, 300, null), 200, 300)).toBeNull();
  });

  it('leva cada canto da foto para o canto da imagem final', () => {
    const w = 100;
    const h = 100;
    const px = new Uint8ClampedArray(w * h * 4);
    // Fundo preto, com um ponto branco perto de cada canto do quadrilátero.
    const q: Quad = [{ x: 20, y: 10 }, { x: 80, y: 20 }, { x: 90, y: 90 }, { x: 10, y: 80 }];
    for (const p of q) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) px.set([255, 255, 255, 255], ((p.y + dy) * w + p.x + dx) * 4);
    const out = straighten(px, w, h, q, 60, 80);
    expect(out[0]).toBeGreaterThan(200);
    expect(out[59]).toBeGreaterThan(200);
    expect(out[79 * 60 + 59]).toBeGreaterThan(200);
    expect(out[79 * 60]).toBeGreaterThan(200);
    expect(out[40 * 60 + 30]).toBeLessThan(30);
  });
});
