import { describe, expect, it } from 'vitest';
import { splitEven, splitWeighted } from './money';
import { EXACT_LIMIT, minTransfers, settleUp, type Balances, type Transfer } from './settle';

// Sorteio previsível: o mesmo teste sempre gera os mesmos números.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Saldos aleatórios que somam zero. */
function randomBalances(rand: () => number, n: number, max: number): { balance: Balances; order: string[] } {
  const order = Array.from({ length: n }, (_, i) => `p${i}`);
  const values = order.map(() => Math.round((rand() * 2 - 1) * max));
  values[n - 1] = -values.slice(0, -1).reduce((a, v) => a + v, 0);
  return { balance: Object.fromEntries(order.map((id, i) => [id, values[i]])), order };
}

/** Aplica os pagamentos: depois deles, todo mundo tem que ficar com saldo zero. */
function apply(balance: Balances, transfers: Transfer[]): Balances {
  const b = { ...balance };
  for (const t of transfers) {
    b[t.from] += t.cents;
    b[t.to] -= t.cents;
  }
  return b;
}

/** Mínimo exato por força bruta (lento, só para conferir com poucos participantes). */
function bruteMin(values: number[]): number {
  const d = values.filter((v) => v !== 0);
  const dfs = (i: number): number => {
    while (i < d.length && d[i] === 0) i++;
    if (i === d.length) return 0;
    let best = Infinity;
    for (let j = i + 1; j < d.length; j++) {
      if (d[j] * d[i] >= 0) continue;
      d[j] += d[i];
      best = Math.min(best, 1 + dfs(i + 1));
      d[j] -= d[i];
    }
    return best;
  };
  return dfs(0);
}

describe('divisão em partes (compartilhada pelo Rolê e pela Viagem)', () => {
  it('splitEven soma sempre o total e o centavo extra começa em `start`', () => {
    expect(splitEven(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitEven(10000, 3, 1)).toEqual([3333, 3334, 3333]);
    expect(splitEven(10001, 3, 2)).toEqual([3334, 3333, 3334]);
    const rand = rng(1);
    for (let i = 0; i < 500; i++) {
      const total = Math.floor(rand() * 1e7);
      const n = 1 + Math.floor(rand() * 12);
      const parts = splitEven(total, n, Math.floor(rand() * 50));
      expect(parts.reduce((a, c) => a + c, 0)).toBe(total);
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
    }
  });

  it('splitWeighted usa o maior resto e soma sempre o total', () => {
    expect(splitWeighted(600000, [100, 100, 100, 100, 100, 50, 50])).toEqual([100000, 100000, 100000, 100000, 100000, 50000, 50000]);
    expect(splitWeighted(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(splitWeighted(100, [1, 1, 1], 2)).toEqual([33, 33, 34]);
    expect(splitWeighted(100, [0, 0])).toBeNull();
    const rand = rng(2);
    for (let i = 0; i < 500; i++) {
      const total = Math.floor(rand() * 1e7);
      const w = Array.from({ length: 1 + Math.floor(rand() * 10) }, () => Math.floor(rand() * 400));
      if (!w.some((x) => x > 0)) w[0] = 1;
      const parts = splitWeighted(total, w, i)!;
      expect(parts.reduce((a, c) => a + c, 0)).toBe(total);
      // Ninguém fica mais de 1 centavo longe da conta exata.
      const sum = w.reduce((a, x) => a + x, 0);
      parts.forEach((p, k) => expect(Math.abs(p - (total * w[k]) / sum)).toBeLessThan(1));
    }
  });
});

describe('acerto mínimo', () => {
  it('acha 3 pagamentos onde o guloso faz 4', () => {
    const balance = { a: 400, b: 300, c: 300, d: -600, e: -400 };
    const order = Object.keys(balance);
    expect(settleUp(balance, order)).toHaveLength(4);
    const best = minTransfers(balance, order);
    expect(best).toEqual([
      { from: 'e', to: 'a', cents: 400 },
      { from: 'd', to: 'b', cents: 300 },
      { from: 'd', to: 'c', cents: 300 },
    ]);
    expect(Object.values(apply(balance, best)).every((v) => v === 0)).toBe(true);
  });

  it('com todo mundo quite, não tem pagamento', () => {
    expect(minTransfers({ a: 0, b: 0 }, ['a', 'b'])).toEqual([]);
  });

  it('sempre deixa todos quites, nunca faz mais que o guloso e bate com a força bruta', () => {
    const rand = rng(3);
    for (let i = 0; i < 400; i++) {
      const n = 2 + Math.floor(rand() * 7);
      // Valores pequenos para aparecerem grupos que somam zero.
      const { balance, order } = randomBalances(rand, n, i % 2 ? 6 : 100000);
      const best = minTransfers(balance, order);
      expect(Object.values(apply(balance, best)).every((v) => v === 0)).toBe(true);
      expect(best.every((t) => t.cents > 0 && balance[t.from] < 0 && balance[t.to] > 0)).toBe(true);
      expect(best.length).toBeLessThanOrEqual(settleUp(balance, order).length);
      expect(best.length).toBe(bruteMin(order.map((id) => balance[id])));
    }
  });

  it(`acima de ${EXACT_LIMIT} pessoas usa o guloso, e ainda fecha a conta`, () => {
    const { balance, order } = randomBalances(rng(4), 30, 500000);
    const t = minTransfers(balance, order);
    expect(t).toEqual(settleUp(balance, order));
    expect(Object.values(apply(balance, t)).every((v) => v === 0)).toBe(true);
  });

  it(`com ${EXACT_LIMIT} pessoas responde rápido`, () => {
    const { balance, order } = randomBalances(rng(5), EXACT_LIMIT, 9);
    const t0 = performance.now();
    const t = minTransfers(balance, order);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(Object.values(apply(balance, t)).every((v) => v === 0)).toBe(true);
  });
});
