import { describe, expect, it } from 'vitest';
import { splitPayment, type SettleTarget } from './SettleSheet';

describe('pagar de uma vez o acerto e a parcela para a mesma pessoa', () => {
  const both: SettleTarget = {
    from: 'deise',
    to: 'mauricio',
    cents: 21654,
    parts: [
      { from: 'deise', to: 'mauricio', cents: 5850 },
      { from: 'deise', to: 'mauricio', cents: 15804, expenseId: 'airbnb', label: 'Airbnb · parcela 1 de 5' },
    ],
  };
  const sum = (list: { cents: number }[]) => list.reduce((a, x) => a + x.cents, 0);

  it('o total vira um pagamento para cada linha', () => {
    const out = splitPayment(both, 21654);
    expect(out.map((o) => [o.target.expenseId ?? null, o.cents])).toEqual([[null, 5850], ['airbnb', 15804]]);
  });

  it('pagou menos: completa as linhas na ordem; pagou mais: a sobra fica no acerto comum', () => {
    expect(splitPayment(both, 10000).map((o) => [o.target.expenseId ?? null, o.cents])).toEqual([[null, 5850], ['airbnb', 4150]]);
    const over = splitPayment(both, 30000);
    expect(over.map((o) => [o.target.expenseId ?? null, o.cents])).toEqual([[null, 14196], ['airbnb', 15804]]);
    expect(sum(over)).toBe(30000);
  });

  it('uma linha só continua como antes', () => {
    const one: SettleTarget = { from: 'a', to: 'b', cents: 500 };
    expect(splitPayment(one, 300)).toEqual([{ target: one, cents: 300 }]);
  });
});
