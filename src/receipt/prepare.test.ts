import { describe, expect, it } from 'vitest';
import { flatten, paperBox } from './prepare';

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
