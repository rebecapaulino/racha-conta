import { describe, expect, it } from 'vitest';
import { ctcDecode, findBoxes, joinLines, type TextBox } from './paddleCore';
import type { Quad } from './prepare';

const quad = (x: number, y: number, w: number, h: number, slope = 0): Quad => [
  { x, y },
  { x: x + w, y: y + w * slope },
  { x: x + w, y: y + h + w * slope },
  { x, y: y + h },
];

describe('caixas de texto no mapa do detector', () => {
  const W = 100;
  const H = 40;
  const map = () => new Float32Array(W * H);
  const fill = (m: Float32Array, x0: number, y0: number, x1: number, y1: number, v = 0.9) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = v;
  };

  it('uma caixa por região, um pouco maior que o miolo marcado', () => {
    const m = map();
    fill(m, 10, 5, 40, 10);
    fill(m, 60, 25, 90, 30);
    const boxes = findBoxes(m, W, H);
    expect(boxes).toHaveLength(2);
    const [tl, tr, br] = boxes[0];
    expect(tl.x).toBeLessThan(10);
    expect(tr.x).toBeGreaterThan(40);
    expect(tl.y).toBeLessThan(5);
    expect(br.y).toBeGreaterThan(10);
  });

  it('ignora ponto solto e região de baixa confiança', () => {
    const m = map();
    fill(m, 5, 5, 7, 7);
    fill(m, 20, 20, 50, 30, 0.4);
    expect(findBoxes(m, W, H)).toEqual([]);
  });

  it('caixa inclinada acompanha o texto', () => {
    const m = map();
    for (let x = 10; x < 90; x++) for (let d = 0; d < 4; d++) m[(10 + Math.round(x * 0.2) + d) * W + x] = 0.9;
    const [tl, tr] = findBoxes(m, W, H)[0];
    expect((tr.y - tl.y) / (tr.x - tl.x)).toBeCloseTo(0.2, 1);
  });
});

describe('saída do reconhecedor', () => {
  it('junta repetições, pula o vazio e mantém letra repetida separada pelo vazio', () => {
    const chars = ['a', 'b'];
    const seq = [1, 1, 0, 1, 2, 2, 0];
    const scores = new Float32Array(seq.length * 3);
    seq.forEach((c, t) => {
      scores[t * 3 + c] = 1;
    });
    expect(ctcDecode(scores, seq.length, 3, chars)).toBe('aab');
  });
});

describe('juntar caixas em linhas', () => {
  const box = (text: string, x: number, y: number, w = 200, slope = 0): TextBox => ({ text, corners: quad(x, y, w, 30, slope) });

  it('nome e preço na mesma linha, na ordem de leitura', () => {
    expect(joinLines([box('R$ 6,00', 400, 102), box('BOLO', 10, 100), box('TOTAL', 10, 200)])).toBe('BOLO  R$ 6,00\nTOTAL');
  });

  it('nota torta: a inclinação das caixas separa as linhas certas', () => {
    // Inclinação de 10%: o preço fica 40 px mais baixo que o nome, na altura da linha de baixo.
    const s = 0.1;
    const text = joinLines([box('SOPA', 0, 100, 200, s), box('R$ 37,50', 400, 140, 200, s), box('BOLO', 0, 140, 200, s), box('R$ 6,00', 400, 180, 200, s)]);
    expect(text).toBe('SOPA  R$ 37,50\nBOLO  R$ 6,00');
  });

  it('sem texto: vazio', () => {
    expect(joinLines([box('  ', 0, 0)])).toBe('');
  });
});
