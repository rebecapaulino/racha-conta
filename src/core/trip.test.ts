import { describe, expect, it } from 'vitest';
import {
  addExpense,
  addSettlement,
  canRemoveTraveler,
  directTransfers,
  groupByPayer,
  findDuplicate,
  mergeTraveler,
  newTrip,
  nextPayer,
  parseWeight,
  personStatement,
  removeTraveler,
  setExpenseDeleted,
  splitExpense,
  tripBalancesText,
  tripSettleText,
  tripSummary,
  updateExpense,
  type ExpenseInput,
  type Trip,
} from './trip';

const NOW = '2026-12-28T12:00:00.000Z';

function tripWith(names: string[], weights: number[] = []): Trip {
  return {
    ...newTrip('t1', 'Réveillon 2027'),
    people: names.map((name, i) => ({ id: name.toLowerCase(), name, color: i % 6, weight: weights[i] ?? 1 })),
  };
}

function input(trip: Trip, over: Partial<ExpenseInput> & Pick<ExpenseInput, 'cents' | 'payerId'>): ExpenseInput {
  return {
    description: 'Despesa',
    date: '2026-12-28',
    category: 'outros',
    split: 'equal',
    people: trip.people.map((p) => p.id),
    ...over,
  };
}

function add(trip: Trip, over: Partial<ExpenseInput> & Pick<ExpenseInput, 'cents' | 'payerId'>): Trip {
  const r = addExpense(trip, input(trip, over), `e${trip.nextSeq}`, NOW);
  if (!r.ok) throw new Error(r.error);
  return r.trip;
}

/** O exemplo do briefing: Ana pagou a hospedagem, Bia o mercado, cinco dividem tudo. */
function reveillon(): Trip {
  let t = tripWith(['Ana', 'Bia', 'Caio', 'Duda', 'Edu']);
  t = add(t, { description: 'Airbnb', cents: 475000, payerId: 'ana', category: 'hospedagem' });
  t = add(t, { description: 'Mercado', cents: 61240, payerId: 'bia', category: 'mercado', date: '2026-12-29' });
  return t;
}

const balances = (t: Trip) => Object.fromEntries(tripSummary(t).people.map((r) => [r.person.id, r.balance]));
const sumOf = (o: Record<string, number>) => Object.values(o).reduce((a, v) => a + v, 0);

describe('exemplo do briefing (Réveillon)', () => {
  it('cada parte e cada saldo batem ao centavo, e a soma dá zero', () => {
    const t = reveillon();
    expect(Object.values(t.expenses[0].shares)).toEqual([95000, 95000, 95000, 95000, 95000]);
    expect(Object.values(t.expenses[1].shares)).toEqual([12248, 12248, 12248, 12248, 12248]);
    const s = tripSummary(t);
    expect(s.ok).toBe(true);
    expect(s.total).toBe(536240);
    expect(s.people.map((r) => r.owes)).toEqual([107248, 107248, 107248, 107248, 107248]);
    expect(balances(t)).toEqual({ ana: 367752, bia: -46008, caio: -107248, duda: -107248, edu: -107248 });
    expect(sumOf(balances(t))).toBe(0);
  });

  it('acerto mínimo: 4 pagamentos, Ana recebe R$ 3.677,52', () => {
    const s = tripSummary(reveillon());
    expect(s.transfers).toEqual([
      { from: 'caio', to: 'ana', cents: 107248 },
      { from: 'duda', to: 'ana', cents: 107248 },
      { from: 'edu', to: 'ana', cents: 107248 },
      { from: 'bia', to: 'ana', cents: 46008 },
    ]);
    expect(s.transfers.reduce((a, x) => a + x.cents, 0)).toBe(367752);
  });

  it('textos do WhatsApp iguais aos do briefing', () => {
    const t = reveillon();
    const s = tripSummary(t);
    expect(tripBalancesText(t, s)).toBe(
      [
        '*Racha Conta* - Réveillon 2027',
        'Gasto total: R$ 5.362,40',
        '',
        'Saldos até agora:',
        '- Ana: recebe R$ 3.677,52',
        '- Bia: paga R$ 460,08',
        '- Caio: paga R$ 1.072,48',
        '- Duda: paga R$ 1.072,48',
        '- Edu: paga R$ 1.072,48',
      ].join('\n'),
    );
    expect(tripSettleText(t, s)).toBe(
      [
        '*Racha Conta* - Réveillon 2027',
        'Para ficar tudo quite:',
        '',
        '- Caio paga R$ 1.072,48 para Ana',
        '- Duda paga R$ 1.072,48 para Ana',
        '- Edu paga R$ 1.072,48 para Ana',
        '- Bia paga R$ 460,08 para Ana',
      ].join('\n'),
    );
  });

  it('totais por categoria e por dia', () => {
    const s = tripSummary(reveillon());
    expect(s.byCategory).toEqual([
      { category: 'hospedagem', cents: 475000 },
      { category: 'mercado', cents: 61240 },
    ]);
    expect(s.byDay).toEqual([
      { date: '2026-12-28', cents: 475000 },
      { date: '2026-12-29', cents: 61240 },
    ]);
  });

  it('quem paga a próxima é quem mais deve ao caixa (empate: ordem da viagem)', () => {
    expect(nextPayer(tripSummary(reveillon()))?.person.name).toBe('Caio');
    expect(nextPayer(tripSummary(tripWith(['Ana'])))).toBeNull();
  });

  it('com tudo acertado, o texto diz que está quite', () => {
    let t = reveillon();
    for (const x of tripSummary(t).transfers) {
      const r = addSettlement(t, x, `s${t.settlements.length}`, NOW);
      if (!r.ok) throw new Error(r.error);
      t = r.trip;
    }
    const s = tripSummary(t);
    expect(Object.values(balances(t)).every((v) => v === 0)).toBe(true);
    expect(tripSettleText(t, s)).toBe('*Racha Conta* - Réveillon 2027\nEstá tudo quite! ✅');
    expect(tripBalancesText(t, s)).toContain('- Ana: está quite');
  });
});

describe('formas de dividir', () => {
  it('R$ 100,00 entre 3: R$ 33,34 + R$ 33,33 + R$ 33,33', () => {
    const t = tripWith(['A', 'B', 'C']);
    const r = splitExpense(input(t, { cents: 10000, payerId: 'a' }), t.people, 0);
    expect(r).toEqual({ ok: true, shares: { a: 3334, b: 3333, c: 3333 } });
  });

  it('o centavo extra gira: 30 despesas de R$ 0,10 entre 3 dão R$ 1,00 para cada um', () => {
    let t = tripWith(['A', 'B', 'C']);
    for (let i = 0; i < 30; i++) t = add(t, { cents: 10, payerId: 'a' });
    expect(tripSummary(t).people.map((r) => r.owes)).toEqual([100, 100, 100]);
  });

  it('a ordem dos toques não muda quem leva o centavo', () => {
    const t = tripWith(['A', 'B', 'C']);
    const a = splitExpense(input(t, { cents: 10000, payerId: 'a', people: ['c', 'a', 'b'] }), t.people, 0);
    const b = splitExpense(input(t, { cents: 10000, payerId: 'a', people: ['a', 'b', 'c'] }), t.people, 0);
    expect(a).toEqual(b);
  });

  it('por peso: R$ 6.000,00 entre 5 adultos (peso 1) e 2 crianças (0,5)', () => {
    const t = tripWith(['A1', 'A2', 'A3', 'A4', 'A5', 'C1', 'C2'], [1, 1, 1, 1, 1, 0.5, 0.5]);
    const r = splitExpense(input(t, { cents: 600000, payerId: 'a1', split: 'weight' }), t.people, 0);
    expect(r).toEqual({ ok: true, shares: { a1: 100000, a2: 100000, a3: 100000, a4: 100000, a5: 100000, c1: 50000, c2: 50000 } });
  });

  it('família como um participante: peso 3,5 e peso 4', () => {
    const t = tripWith(['Família Ana', 'Família Bia'], [3.5, 4]);
    const r = splitExpense(input(t, { cents: 75000, payerId: 'família ana', split: 'weight' }), t.people, 0);
    expect(r).toEqual({ ok: true, shares: { 'família ana': 35000, 'família bia': 40000 } });
  });

  it('por peso, com todo mundo de peso 0, recusa', () => {
    const t = tripWith(['A', 'B'], [0, 0]);
    const r = splitExpense(input(t, { cents: 1000, payerId: 'a', split: 'weight' }), t.people, 0);
    expect(r.ok).toBe(false);
  });

  it('valores exatos: aceita quando bate e recusa com a diferença quando não bate', () => {
    const t = tripWith(['Ana', 'Bia']);
    const ok = splitExpense(input(t, { cents: 15000, payerId: 'ana', split: 'exact', exact: { ana: 10000, bia: 5000 } }), t.people, 0);
    expect(ok).toEqual({ ok: true, shares: { ana: 10000, bia: 5000 } });

    const short = addExpense(t, input(t, { cents: 15000, payerId: 'ana', split: 'exact', exact: { ana: 10000, bia: 4000 } }), 'x', NOW);
    expect(short).toEqual({ ok: false, error: 'A soma das partes dá R$ 140,00, mas a despesa é de R$ 150,00: faltam R$ 10,00.' });

    const over = splitExpense(input(t, { cents: 15000, payerId: 'ana', split: 'exact', exact: { ana: 10000, bia: 6000 } }), t.people, 0);
    expect(over).toEqual({ ok: false, error: 'A soma das partes dá R$ 160,00, mas a despesa é de R$ 150,00: passou R$ 10,00.' });
  });

  it('despesa sem ninguém marcado não é salva', () => {
    const t = tripWith(['Ana', 'Bia']);
    const r = addExpense(t, input(t, { cents: 1000, payerId: 'ana', people: [] }), 'x', NOW);
    expect(r).toEqual({ ok: false, error: 'Marque quem participa da despesa.' });
  });

  it('quem pagou não precisa participar (presente para outra pessoa)', () => {
    const t = add(tripWith(['Ana', 'Bia', 'Caio']), { cents: 5000, payerId: 'ana', people: ['bia'] });
    expect(balances(t)).toEqual({ ana: 5000, bia: -5000, caio: 0 });
    expect(tripSummary(t).transfers).toEqual([{ from: 'bia', to: 'ana', cents: 5000 }]);
  });

  it('recusa valor zero e pagador desconhecido', () => {
    const t = tripWith(['Ana']);
    expect(splitExpense(input(t, { cents: 0, payerId: 'ana' }), t.people, 0).ok).toBe(false);
    expect(splitExpense(input(t, { cents: 100, payerId: 'zé' }), t.people, 0).ok).toBe(false);
  });
});

describe('acertos e edições', () => {
  it('acerto registrado reduz o saldo dos dois e não mexe nas despesas', () => {
    const t0 = reveillon();
    const r = addSettlement(t0, { from: 'caio', to: 'ana', cents: 107248 }, 's1', NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.trip.expenses).toBe(t0.expenses);
    expect(balances(r.trip)).toMatchObject({ ana: 260504, caio: 0 });
    expect(sumOf(balances(r.trip))).toBe(0);
  });

  it('acerto parcial (ex.: parcela) também conta', () => {
    const r = addSettlement(reveillon(), { from: 'caio', to: 'ana', cents: 21450 }, 's1', NOW);
    if (!r.ok) throw new Error(r.error);
    expect(balances(r.trip).caio).toBe(-107248 + 21450);
  });

  it('acerto registrado e depois a despesa editada: o saldo muda para os dois lados', () => {
    const s = addSettlement(reveillon(), { from: 'caio', to: 'ana', cents: 107248 }, 's1', NOW);
    if (!s.ok) throw new Error(s.error);
    const base = input(s.trip, { description: 'Airbnb', cents: 500000, payerId: 'ana', category: 'hospedagem' });

    // A hospedagem ficou mais cara: Caio volta a dever R$ 50,00.
    const up = updateExpense(s.trip, 'e0', base, NOW);
    if (!up.ok) throw new Error(up.error);
    expect(balances(up.trip)).toMatchObject({ ana: 280504, caio: -5000 });
    expect(sumOf(balances(up.trip))).toBe(0);

    // Ficou mais barata: Caio pagou a mais e agora recebe R$ 150,00 de volta.
    const down = updateExpense(s.trip, 'e0', { ...base, cents: 400000 }, NOW);
    if (!down.ok) throw new Error(down.error);
    const sum = tripSummary(down.trip);
    expect(balances(down.trip).caio).toBe(15000);
    expect(sum.transfers.filter((x) => x.to === 'caio').reduce((a, x) => a + x.cents, 0)).toBe(15000);
    expect(down.trip.settlements).toEqual(s.trip.settlements);
  });

  it('editar mantém a ordem da despesa (o centavo extra não pula de pessoa)', () => {
    const t = add(add(tripWith(['A', 'B', 'C']), { cents: 100, payerId: 'a' }), { cents: 100, payerId: 'a' });
    const r = updateExpense(t, 'e1', input(t, { cents: 100, payerId: 'b' }), NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.trip.expenses[1].shares).toEqual(t.expenses[1].shares);
    expect(r.trip.expenses[1].updatedAt).toBe(NOW);
  });

  it('acerto inválido é recusado', () => {
    const t = reveillon();
    expect(addSettlement(t, { from: 'ana', to: 'ana', cents: 100 }, 's', NOW).ok).toBe(false);
    expect(addSettlement(t, { from: 'caio', to: 'ana', cents: 0 }, 's', NOW).ok).toBe(false);
    expect(addSettlement(t, { from: 'zé', to: 'ana', cents: 100 }, 's', NOW).ok).toBe(false);
  });

  it('excluir tira das contas, mas guarda a despesa; desfazer devolve', () => {
    const t = setExpenseDeleted(reveillon(), 'e1', true, NOW);
    expect(t.expenses).toHaveLength(2);
    expect(tripSummary(t).total).toBe(475000);
    expect(sumOf(balances(t))).toBe(0);
    expect(tripSummary(setExpenseDeleted(t, 'e1', false, NOW)).total).toBe(536240);
    // A próxima despesa continua a contagem (não reaproveita a ordem da excluída).
    expect(add(t, { cents: 100, payerId: 'ana' }).expenses[2].seq).toBe(2);
  });
});

describe('remover participante', () => {
  it('quem tem despesa não sai sem decidir para quem vão as despesas dele', () => {
    const t = reveillon();
    expect(canRemoveTraveler(t, 'edu')).toBe(false);
    expect(removeTraveler(t, 'edu').ok).toBe(false);

    const fe = { ...t, people: [...t.people, { id: 'fe', name: 'Fê', color: 5, weight: 1 }] };
    const r = removeTraveler(fe, 'fe');
    expect(r.ok && r.trip.people.map((p) => p.id)).toEqual(['ana', 'bia', 'caio', 'duda', 'edu']);
  });

  it('passar as despesas para quem já participava soma as partes e não muda nenhum valor', () => {
    const r = mergeTraveler(reveillon(), 'edu', 'duda');
    if (!r.ok) throw new Error(r.error);
    const s = tripSummary(r.trip);
    expect(s.ok).toBe(true);
    expect(s.total).toBe(536240);
    expect(r.trip.people.map((p) => p.id)).not.toContain('edu');
    expect(r.trip.expenses[0]).toMatchObject({ split: 'exact', shares: { duda: 190000 }, exact: { duda: 190000 } });
    expect(balances(r.trip)).toEqual({ ana: 367752, bia: -46008, caio: -107248, duda: -214496 });
  });

  it('passar para quem não participava só troca o nome', () => {
    const t = reveillon();
    const withGabi = { ...t, people: [...t.people, { id: 'gabi', name: 'Gabi', color: 5, weight: 1 }] };
    const r = mergeTraveler(withGabi, 'bia', 'gabi');
    if (!r.ok) throw new Error(r.error);
    expect(r.trip.expenses[1]).toMatchObject({ payerId: 'gabi', split: 'equal' });
    expect(balances(r.trip).gabi).toBe(-46008);
  });

  it('acerto entre as duas pessoas some; os outros passam para quem ficou', () => {
    let t = reveillon();
    for (const x of [
      { from: 'edu', to: 'duda', cents: 1000 },
      { from: 'edu', to: 'ana', cents: 2000 },
    ]) {
      const r = addSettlement(t, x, `s${t.settlements.length}`, NOW);
      if (!r.ok) throw new Error(r.error);
      t = r.trip;
    }
    const r = mergeTraveler(t, 'edu', 'duda');
    if (!r.ok) throw new Error(r.error);
    expect(r.trip.settlements.map(({ from, to, cents }) => ({ from, to, cents }))).toEqual([{ from: 'duda', to: 'ana', cents: 2000 }]);
    expect(sumOf(balances(r.trip))).toBe(0);
  });
});

describe('proteções', () => {
  it('se uma conta não fechar ao centavo, avisa em vez de mostrar o acerto', () => {
    const t = reveillon();
    const broken = { ...t, expenses: t.expenses.map((e, i) => (i === 0 ? { ...e, shares: { ...e.shares, ana: 1 } } : e)) };
    const s = tripSummary(broken);
    expect(s.ok).toBe(false);
    expect(s.transfers).toEqual([]);
  });

  it('acha despesa parecida (mesmo valor, mesmo dia)', () => {
    const t = reveillon();
    expect(findDuplicate(t, { cents: 61240, date: '2026-12-29' })?.description).toBe('Mercado');
    expect(findDuplicate(t, { cents: 61240, date: '2026-12-30' })).toBeNull();
    expect(findDuplicate(t, { cents: 61240, date: '2026-12-29' }, 'e1')).toBeNull();
  });

  it('lê o peso digitado', () => {
    expect(parseWeight('0,5')).toBe(0.5);
    expect(parseWeight('1')).toBe(1);
    expect(parseWeight('3.5')).toBe(3.5);
    expect(parseWeight('0')).toBe(0);
    expect(parseWeight('-1')).toBeNull();
    expect(parseWeight('21')).toBeNull();
    expect(parseWeight('0,555')).toBeNull();
    expect(parseWeight('abc')).toBeNull();
  });

  it('a soma dos saldos é zero com muitas despesas aleatórias', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let t = tripWith(['A', 'B', 'C', 'D', 'E', 'F', 'G'], [1, 1, 0.5, 2, 1.5, 1, 0]);
    for (let i = 0; i < 300; i++) {
      const payer = t.people[Math.floor(rand() * 7)].id;
      const people = t.people.filter(() => rand() > 0.4).map((p) => p.id);
      if (!people.length) continue;
      const split = rand() > 0.5 ? 'weight' : 'equal';
      const r = addExpense(t, input(t, { cents: 1 + Math.floor(rand() * 200000), payerId: payer, people, split }), `e${i}`, NOW);
      if (r.ok) t = r.trip;
      if (i % 10 === 0) {
        const s = tripSummary(t);
        const x = s.transfers[0];
        if (x) {
          const p = addSettlement(t, { ...x, cents: Math.ceil(x.cents / 2) }, `s${i}`, NOW);
          if (p.ok) t = p.trip;
        }
      }
    }
    const s = tripSummary(t);
    expect(s.ok).toBe(true);
    expect(sumOf(balances(t))).toBe(0);
    for (const e of t.expenses) expect(sumOf(e.shares)).toBe(e.cents);
    // Depois dos pagamentos do acerto, todo mundo fica zerado.
    const left = balances(t);
    for (const x of s.transfers) {
      left[x.from] += x.cents;
      left[x.to] -= x.cents;
    }
    expect(Object.values(left).every((v) => v === 0)).toBe(true);
  });
});

describe('conta detalhada de cada pessoa', () => {
  /** Mauricio pagou o mercado (3 pessoas), Natacha o jantar (só ela e Rebeca), Rebeca a gasolina. */
  function chacara(): Trip {
    let t = tripWith(['Rebeca', 'Mauricio', 'Natacha']);
    t = add(t, { description: 'Mercado', cents: 30000, payerId: 'mauricio' });
    t = add(t, { description: 'Jantar', cents: 12000, payerId: 'natacha', people: ['rebeca', 'natacha'] });
    t = add(t, { description: 'Gasolina', cents: 9000, payerId: 'rebeca' });
    return t;
  }

  it('mostra quanto deve a cada um, sem compensar, e o total', () => {
    const r = personStatement(chacara(), 'rebeca');
    expect(r.owesTo.map((d) => [d.other, d.cents])).toEqual([['mauricio', 10000], ['natacha', 6000]]);
    expect(r.owesTotal).toBe(16000);
    expect(r.owesTo[0].lines.map((l) => [l.expense.description, l.cents])).toEqual([['Mercado', 10000]]);
    expect(r.owedBy.map((d) => [d.other, d.cents])).toEqual([['mauricio', 3000], ['natacha', 3000]]);
    expect(r.owedTotal).toBe(6000);
    expect(r.ownShare).toBe(3000);
    expect(r.balance).toBe(-10000);
  });

  it('quem pagou vê só o que devem a ele pelas despesas dele', () => {
    const r = personStatement(chacara(), 'mauricio');
    expect(r.owedBy.map((d) => [d.other, d.cents])).toEqual([['rebeca', 10000], ['natacha', 10000]]);
    expect(r.owesTo.map((d) => [d.other, d.cents])).toEqual([['rebeca', 3000]]);
  });

  it('o saldo da conta detalhada é sempre o mesmo do resumo, com acertos e exclusões', () => {
    let t = chacara();
    t = setExpenseDeleted(t, t.expenses.find((e) => e.description === 'Jantar')!.id, true, NOW);
    t = add(t, { description: 'Pousada', cents: 100001, payerId: 'natacha', split: 'weight' });
    const r = addSettlement(t, { from: 'rebeca', to: 'mauricio', cents: 2500 }, 's1', NOW);
    if (!r.ok) throw new Error(r.error);
    t = r.trip;
    for (const row of tripSummary(t).people) {
      const st = personStatement(t, row.person.id);
      expect(st.balance).toBe(row.balance);
      expect(st.ownShare + st.owesTotal).toBe(row.owes);
    }
    expect(personStatement(t, 'rebeca').owesTo.find((d) => d.other === 'natacha')?.lines.map((l) => l.expense.description)).toEqual(['Pousada']);
  });
});

describe('acerto direto para quem pagou', () => {
  function chacara(): Trip {
    let t = tripWith(['Rebeca', 'Mauricio', 'Natacha']);
    t = add(t, { description: 'Mercado', cents: 30000, payerId: 'mauricio' });
    t = add(t, { description: 'Alimentação', cents: 12000, payerId: 'rebeca', people: ['rebeca', 'mauricio'] });
    t = add(t, { description: 'Gasolina', cents: 9000, payerId: 'natacha' });
    return t;
  }
  const net = (list: { from: string; to: string; cents: number }[], id: string) =>
    list.reduce((a, x) => a + (x.to === id ? x.cents : 0) - (x.from === id ? x.cents : 0), 0);

  it('quem deve para quem pagou paga direto, só a diferença entre os dois', () => {
    const t = chacara();
    // Rebeca deve 100 ao Mauricio e ele deve 60 a ela: só 40. Ninguém paga a Rebeca por outro.
    // Mauricio deve 30 da gasolina à Natacha e ela deve 100 do mercado a ele: ela paga 70.
    expect(directTransfers(t)).toEqual([
      { from: 'rebeca', to: 'mauricio', cents: 4000 },
      { from: 'rebeca', to: 'natacha', cents: 3000 },
      { from: 'natacha', to: 'mauricio', cents: 7000 },
    ]);
  });

  it('cada pessoa paga ou recebe o mesmo total do acerto com menos Pix', () => {
    let t = chacara();
    t = add(t, { description: 'Pousada', cents: 100001, payerId: 'natacha', split: 'weight' });
    const r = addSettlement(t, { from: 'mauricio', to: 'rebeca', cents: 1234 }, 's1', NOW);
    if (!r.ok) throw new Error(r.error);
    t = r.trip;
    const s = tripSummary(t);
    for (const row of s.people) {
      expect(net(s.direct, row.person.id)).toBe(row.balance);
      expect(net(s.transfers, row.person.id)).toBe(row.balance);
    }
    expect(s.direct.every((x) => x.cents > 0 && x.from !== x.to)).toBe(true);
  });

  it('pagando tudo o que o acerto direto diz, fica tudo quite', () => {
    let t = chacara();
    for (const x of tripSummary(t).direct) {
      const r = addSettlement(t, x, `s${t.settlements.length}`, NOW);
      if (!r.ok) throw new Error(r.error);
      t = r.trip;
    }
    expect(tripSummary(t).direct).toEqual([]);
    expect(tripSettleText(t, tripSummary(t), 'direct')).toBe('*Racha Conta* - Réveillon 2027\nEstá tudo quite! ✅');
  });

  it('texto agrupado por quem paga', () => {
    const t = chacara();
    const s = tripSummary(t);
    expect(groupByPayer(s.direct, t).map((g) => [g.from, g.cents])).toEqual([['rebeca', 7000], ['natacha', 7000]]);
    expect(tripSettleText(t, s, 'direct')).toBe(
      [
        '*Racha Conta* - Réveillon 2027',
        'Para ficar tudo quite (cada um paga para quem pagou):',
        '',
        '*Rebeca* paga R$ 70,00 no total:',
        '- R$ 40,00 para Mauricio',
        '- R$ 30,00 para Natacha',
        '',
        '*Natacha* paga:',
        '- R$ 70,00 para Mauricio',
      ].join('\n'),
    );
  });
});
