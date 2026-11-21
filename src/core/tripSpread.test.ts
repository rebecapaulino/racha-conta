import { describe, expect, it } from 'vitest';
import { splitEven } from './money';
import {
  addExpense,
  addSettlement,
  installmentInfo,
  joinSchedule,
  newTrip,
  setPaidThrough,
  splitExpense,
  spreadSchedule,
  tripSummary,
  updateExpense,
  type ExpenseInput,
  type Trip,
} from './trip';

const NOW = '2026-11-21T12:00:00.000Z';
const sum = (list: number[]) => list.reduce((a, c) => a + c, 0);

function tripWith(names: string[]): Trip {
  return { ...newTrip('t1', 'Ano novo'), people: names.map((name, i) => ({ id: name.toLowerCase(), name, color: i % 6, weight: 1 })) };
}

function input(over: Partial<ExpenseInput> & Pick<ExpenseInput, 'cents' | 'payerId' | 'people'>): ExpenseInput {
  return { description: 'Airbnb', date: '2026-11-01', category: 'hospedagem', split: 'equal', ...over };
}

function add(t: Trip, id: string, over: Parameters<typeof input>[0]): Trip {
  const r = addExpense(t, input(over), id, NOW);
  if (!r.ok) throw new Error(r.error);
  return r.trip;
}

/** A despesa parcelada já lançada (antes de entrar alguém). */
const expenseOf = (t: Trip, id = 'air') => t.expenses.find((e) => e.id === id)!;

/** Soma de cada parcela do mês, entre todos. */
const months = (plan: Record<string, number[]>, n: number) => Array.from({ length: n }, (_, m) => sum(Object.values(plan).map((p) => p[m])));

describe('todos pagam o mesmo no fim (quem entra dilui a diferença nas parcelas que faltam)', () => {
  it('R$ 1.000 em 2x entre 4 (R$ 125 por parcela); na 2ª entra mais uma: ela paga R$ 200 e os outros R$ 75', () => {
    const t = add(tripWith(['Ana', 'Bia', 'Caio', 'Duda', 'Edu']), 'air', { cents: 100000, payerId: 'ana', people: ['ana', 'bia', 'caio', 'duda'], installments: 2 });
    const plan = spreadSchedule(expenseOf(t), input({ cents: 100000, payerId: 'ana', people: ['ana', 'bia', 'caio', 'duda', 'edu'], installments: 2 }), t.people, 1)!;
    expect(plan.back).toEqual({});
    expect(plan.schedule).toEqual({ ana: [12500, 7500], bia: [12500, 7500], caio: [12500, 7500], duda: [12500, 7500], edu: [0, 20000] });
    expect(months(plan.schedule, 2)).toEqual([50000, 50000]);
  });

  it('R$ 5.000 em 5x entre 4 (R$ 250 por parcela); na 2ª entra mais uma: ela paga os mesmos R$ 250 e os outros caem para R$ 187,50', () => {
    const t = add(tripWith(['Ana', 'Bia', 'Caio', 'Duda', 'Edu']), 'air', { cents: 500000, payerId: 'ana', people: ['ana', 'bia', 'caio', 'duda'], installments: 5 });
    const plan = spreadSchedule(expenseOf(t), input({ cents: 500000, payerId: 'ana', people: ['ana', 'bia', 'caio', 'duda', 'edu'], installments: 5 }), t.people, 1)!;
    expect(plan.schedule.bia).toEqual([25000, 18750, 18750, 18750, 18750]);
    expect(plan.schedule.edu).toEqual([0, 25000, 25000, 25000, 25000]);
    expect(Object.values(plan.schedule).map(sum)).toEqual([100000, 100000, 100000, 100000, 100000]);
  });

  it('Airbnb do Mauricio (R$ 8.692 em 5x, 10 pessoas): a Deise entra na 2ª e todos pagam R$ 790,18 no fim', () => {
    const names = ['Mauricio', 'Natacha', 'Clari', 'Joao', 'Angela', 'Marcelo', 'Leo', 'Rebeca', 'Robin', 'Leticia'];
    const ids = names.map((n) => n.toLowerCase());
    const t = add(tripWith([...names, 'Deise']), 'air', { cents: 869200, payerId: 'mauricio', people: ids, installments: 5 });
    const plan = spreadSchedule(expenseOf(t), input({ cents: 869200, payerId: 'mauricio', people: [...ids, 'deise'], installments: 5 }), t.people, 1)!;
    // R$ 8.692,00 ÷ 11 = R$ 790,18 e 2 centavos que sobram (dois pagam R$ 790,19).
    const totals = Object.values(plan.schedule).map(sum);
    expect(totals.filter((c) => c === 79018)).toHaveLength(9);
    expect(totals.filter((c) => c === 79019)).toHaveLength(2);
    // A 1ª continua R$ 173,84 para os 10; da 2ª em diante, R$ 154,08 ou R$ 154,09 para eles e
    // R$ 197,54 ou R$ 197,55 para a Deise (o centavo que sobra nas primeiras, como sempre).
    for (const id of ids) {
      expect(plan.schedule[id][0]).toBe(17384);
      expect(plan.schedule[id].slice(1)).toEqual(sum(plan.schedule[id]) === 79018 ? [15409, 15409, 15408, 15408] : [15409, 15409, 15409, 15408]);
    }
    expect(plan.schedule.deise).toEqual(sum(plan.schedule.deise) === 79018 ? [0, 19755, 19755, 19754, 19754] : [0, 19755, 19755, 19755, 19754]);
    // Cada parcela do mês fica a poucos centavos da do cartão, e o total fecha.
    for (const c of months(plan.schedule, 5)) expect(Math.abs(c - 173840)).toBeLessThanOrEqual(11);
    expect(sum(months(plan.schedule, 5))).toBe(869200);
  });

  it('centavos: em qualquer caso, fecha o total, cada um fica com a parte inteira, quem deve o mesmo paga o mesmo em cada parcela', () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const names = ['Ana', 'Bia', 'Caio', 'Duda', 'Edu', 'Fabi', 'Gui', 'Hana'];
    for (let round = 0; round < 400; round++) {
      const t0 = tripWith(names);
      const ids = t0.people.map((p) => p.id);
      const n = 2 + Math.floor(rnd() * 11);
      const cents = 1000 + Math.floor(rnd() * 2000000);
      const m = 1 + Math.floor(rnd() * 5);
      const j = 1 + Math.floor(rnd() * (ids.length - m));
      const k = 1 + Math.floor(rnd() * (n - 1));
      const before = ids.slice(0, m);
      const after = ids.slice(0, m + j);
      const t = add(t0, 'air', { cents, payerId: ids[0], people: before, installments: n });
      const now = input({ cents, payerId: ids[0], people: after, installments: n });
      const plan = spreadSchedule(expenseOf(t), now, t.people, k)!;
      const full = splitExpense(now, t.people, expenseOf(t).seq);
      if (!full.ok) throw new Error(full.error);
      const all = Object.values(plan.schedule).flat();
      expect(all.every((c) => Number.isSafeInteger(c) && c >= 0)).toBe(true);
      expect(sum(all)).toBe(cents);
      for (const id of after) {
        expect(sum(plan.schedule[id])).toBe(full.shares[id]);
        if (plan.back[id]) continue;
        // As parcelas que passaram ficam como estavam.
        const old = splitEven(expenseOf(t).shares[id] ?? 0, n).slice(0, k);
        expect(plan.schedule[id].slice(0, k)).toEqual(old);
        // O que falta em parcelas iguais, o centavo que sobra nas primeiras.
        const ahead = plan.schedule[id].slice(k);
        expect(ahead).toEqual(splitEven(sum(ahead), n - k));
      }
      // Quem pagou o mesmo até aqui e deve o mesmo no total paga o mesmo em cada parcela.
      const same = (a: string, b: string) => sum(plan.schedule[a]) === sum(plan.schedule[b]) && plan.schedule[a].slice(0, k).join() === plan.schedule[b].slice(0, k).join();
      for (const a of after) for (const b of after) if (same(a, b)) expect(plan.schedule[a]).toEqual(plan.schedule[b]);
      // Quem pagou a mais nas que passaram: só quando a parte inteira é menor do que já tinha pagado.
      for (const [id, c] of Object.entries(plan.back)) {
        expect(c).toBe(sum(splitEven(expenseOf(t).shares[id], n).slice(0, k)) - full.shares[id]);
        expect(plan.schedule[id].slice(k).every((x) => x === 0)).toBe(true);
      }
      // As parcelas do mês que faltam ficam iguais entre si (menos de 1 centavo por pessoa de diferença).
      const ahead = months(plan.schedule, n).slice(k);
      for (const c of ahead) expect(Math.abs(c - sum(ahead) / (n - k))).toBeLessThan(after.length);
    }
  });

  it('quem sai fica só com as parcelas que passaram; quem fica divide o resto e paga o mesmo no fim', () => {
    // Cachorros: R$ 1.000 em 5x, Rebeca e Bia. Na 2ª, a Bia sai e a Deise entra.
    const t = add(tripWith(['Rebeca', 'Bia', 'Deise']), 'air', { cents: 100000, payerId: 'rebeca', people: ['rebeca', 'bia'], installments: 5 });
    const plan = spreadSchedule(expenseOf(t), input({ cents: 100000, payerId: 'rebeca', people: ['rebeca', 'deise'], installments: 5 }), t.people, 1)!;
    expect(plan.schedule.bia).toEqual([10000, 0, 0, 0, 0]);
    // Sem a 1ª da Bia, R$ 900 entre Rebeca e Deise: R$ 450 cada no fim.
    expect(sum(plan.schedule.rebeca)).toBe(45000);
    expect(sum(plan.schedule.deise)).toBe(45000);
    expect(plan.schedule.rebeca).toEqual([10000, 8750, 8750, 8750, 8750]);
    expect(plan.schedule.deise).toEqual([0, 11250, 11250, 11250, 11250]);
  });

  it('sem parcela passada, ou com o número de parcelas mudado: não precisa (null)', () => {
    const t = add(tripWith(['Ana', 'Bia', 'Caio']), 'air', { cents: 90000, payerId: 'ana', people: ['ana', 'bia'], installments: 3 });
    const now = input({ cents: 90000, payerId: 'ana', people: ['ana', 'bia', 'caio'], installments: 3 });
    expect(spreadSchedule(expenseOf(t), now, t.people, 0)).toBeNull();
    expect(spreadSchedule(expenseOf(t), { ...now, installments: 4 }, t.people, 1)).toBeNull();
    expect(joinSchedule(expenseOf(t), now, t.people, 1, 'spread')).toEqual(spreadSchedule(expenseOf(t), now, t.people, 1)!.schedule);
  });
});

describe('quando não dá para todos pagarem o mesmo só com as parcelas que faltam', () => {
  // R$ 1.000 em 2x, pago pela Rebeca e dividido com a Bia (R$ 250 cada por parcela). A Bia já
  // pagou a 1ª. Na 2ª (a última), entram mais três: a parte de cada um cai para R$ 200.
  const names = ['Rebeca', 'Bia', 'Caio', 'Duda', 'Edu'];
  const everyone = names.map((n) => n.toLowerCase());
  const now = input({ cents: 100000, payerId: 'rebeca', people: everyone, installments: 2 });
  function start(): Trip {
    const t = add(tripWith(names), 'air', { cents: 100000, payerId: 'rebeca', people: ['rebeca', 'bia'], installments: 2 });
    const s = addSettlement(t, { from: 'bia', to: 'rebeca', cents: 25000, expenseId: 'air' }, 's1', NOW);
    if (!s.ok) throw new Error(s.error);
    return s.trip;
  }

  it('avisa quanto já foi pago a mais; quem entrou paga a parte inteira e a diferença volta', () => {
    const t = start();
    const plan = spreadSchedule(expenseOf(t), now, t.people, 1)!;
    expect(plan.back).toEqual({ rebeca: 5000, bia: 5000 });
    expect(plan.schedule).toEqual({ rebeca: [20000, 0], bia: [20000, 0], caio: [0, 20000], duda: [0, 20000], edu: [0, 20000] });
    // Na última parcela, "desde a 1ª, de uma vez" dá no mesmo (a tela mostra uma opção só).
    expect(joinSchedule(expenseOf(t), now, t.people, 1, 'all')).toEqual(plan.schedule);
  });

  it('no acerto: a Bia recebe de volta os R$ 50 (da Rebeca, com o que os três pagarem) e todos ficam com R$ 200', () => {
    let t = start();
    const r = updateExpense(t, 'air', { ...now, schedule: spreadSchedule(expenseOf(t), now, t.people, 1)!.schedule }, NOW);
    if (!r.ok) throw new Error(r.error);
    t = r.trip;
    expect(expenseOf(t).shares).toEqual({ rebeca: 20000, bia: 20000, caio: 20000, duda: 20000, edu: 20000 });
    const s = tripSummary(t);
    expect(s.ok).toBe(true);
    const bal = Object.fromEntries(s.people.map((p) => [p.person.id, p.balance]));
    expect(bal).toEqual({ rebeca: 55000, bia: 5000, caio: -20000, duda: -20000, edu: -20000 });
    expect(s.plan.direct.filter((x) => x.remaining > 0).map((x) => [x.from, x.to, x.remaining])).toEqual(
      expect.arrayContaining([['rebeca', 'bia', 5000], ['caio', 'rebeca', 20000], ['duda', 'rebeca', 20000], ['edu', 'rebeca', 20000]]),
    );
    // Marcar "Já pagas por todos: a 1ª" não come o que volta para a Bia.
    const marked = tripSummary(setPaidThrough(t, 'air', 1, NOW));
    expect(marked.people.find((p) => p.person.id === 'bia')!.balance).toBe(5000);
  });
});

describe('a regra do cartão continua valendo nas parcelas da pessoa', () => {
  it('quem entrou vê a parcela da vez certinha, e quem já estava paga menos', () => {
    let t = add(tripWith(['Ana', 'Bia', 'Caio', 'Duda', 'Edu']), 'air', { cents: 100000, payerId: 'ana', people: ['ana', 'bia', 'caio', 'duda'], installments: 2 });
    const s = addSettlement(t, { from: 'bia', to: 'ana', cents: 12500, expenseId: 'air' }, 's1', NOW);
    if (!s.ok) throw new Error(s.error);
    t = s.trip;
    const now = input({ cents: 100000, payerId: 'ana', people: ['ana', 'bia', 'caio', 'duda', 'edu'], installments: 2 });
    const r = updateExpense(t, 'air', { ...now, schedule: joinSchedule(expenseOf(t), now, t.people, 1, 'spread')! }, NOW);
    if (!r.ok) throw new Error(r.error);
    const row = (from: string) => tripSummary(r.trip).plan.direct.find((x) => x.from === from && x.expenseId === 'air')!;
    const info = (from: string) => installmentInfo(row(from).cents, row(from).paid, 2, row(from).parts);
    expect(info('bia')).toMatchObject({ paidCount: 1, next: 7500 });
    expect(info('caio')).toMatchObject({ paidCount: 0, next: 12500 });
    expect(info('edu')).toMatchObject({ paidCount: 1, next: 20000 });
  });
});

