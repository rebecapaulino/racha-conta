import { describe, expect, it } from 'vitest';
import { computeSplit, groupSummary, groupSummaryText, payments, settleUp, summaryText, type GroupSummary } from '../core/bill';
import { activeBill, activeNote, blankState, isValidBill, reducer, type Action, type AppState } from './billState';

const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);

// Bar com Ana, Bruno e Carla (10% de serviço), pago pela Ana.
function bar(): AppState {
  let s = run(
    blankState(),
    { type: 'addPerson', name: 'Ana' },
    { type: 'addPerson', name: 'Bruno' },
    { type: 'addPerson', name: 'Carla' },
    { type: 'addItem', name: 'Chopp', cents: 3000 },
  );
  s = run(s, { type: 'payer', id: s.bill.people[0].id });
  return s;
}
const ids = (s: AppState) => s.bill.people.map((p) => p.id);

describe('várias notas na mesma conta', () => {
  it('nova nota: a conta de antes vira a primeira nota, com serviço e pagador dela', () => {
    const s0 = bar();
    const [ana, bruno] = ids(s0);
    const s = run(s0, { type: 'addNote', category: ' Doces ', payerId: bruno, people: [ana, bruno], photoId: null });
    const [first, doces] = s.bill.notes!;
    expect(first).toMatchObject({ category: '', servicePct: 10, payerId: ana, people: ids(s0) });
    expect(doces).toMatchObject({ category: 'Doces', servicePct: 0, payerId: bruno, people: [ana, bruno] });
    expect(s.noteId).toBe(doces.id);
    expect(s.bill.items.every((i) => i.noteId === first.id)).toBe(true);
    expect(isValidBill(s.bill)).toBe(true);
  });

  it('item lançado entra na nota aberta, só com quem divide ela', () => {
    const s0 = bar();
    const [ana, bruno] = ids(s0);
    const s = run(
      s0,
      { type: 'addNote', category: 'Doces', payerId: bruno, people: [ana, bruno], photoId: null },
      { type: 'addItem', name: 'Brigadeiro', cents: 1001 },
    );
    const item = s.bill.items.at(-1)!;
    expect(item).toMatchObject({ noteId: s.noteId, who: [ana, bruno] });
    expect(activeBill(s).items.map((i) => i.name)).toEqual(['Brigadeiro']);
    expect(activeBill(s).people.map((p) => p.name)).toEqual(['Ana', 'Bruno']);
  });

  it('o total da conta soma as notas, cada uma com o seu serviço', () => {
    const s0 = bar();
    const [ana, bruno] = ids(s0);
    const s = run(
      s0,
      { type: 'addNote', category: 'Doces', payerId: bruno, people: [ana, bruno], photoId: null },
      { type: 'addItem', name: 'Brigadeiro', cents: 1001 },
    );
    const r = computeSplit(s.bill);
    // Bar: 30,00 + 10% = 33,00 entre 3 (11,00 cada). Doces: 10,01 sem serviço entre Ana e Bruno.
    expect(r.total).toBe(3300 + 1001);
    expect(r.shares.map((x) => x.total)).toEqual([1100 + 501, 1100 + 500, 1100]);
    expect(r.shares.reduce((t, x) => t + x.total, 0)).toBe(r.total);
  });

  it('serviço, pagador e "já pagou" mudam só a nota aberta', () => {
    const s0 = bar();
    const [ana, bruno, carla] = ids(s0);
    let s = run(s0, { type: 'addNote', category: 'Doces', payerId: null, people: [ana, bruno, carla], photoId: null });
    s = run(s, { type: 'addItem', name: 'Bolo', cents: 3000 }, { type: 'service', pct: 12 }, { type: 'payer', id: carla }, { type: 'markPaid', personId: ana, paid: true });
    const [first, doces] = s.bill.notes!;
    expect(first).toMatchObject({ servicePct: 10, payerId: ana });
    expect(first.paid).toBeUndefined();
    expect(doces).toMatchObject({ servicePct: 12, payerId: carla, paid: { [ana]: 1120 } });
    expect(s.log.at(-1)!.text).toBe('Doces: Ana pagou R$ 11,20');
  });

  it('trocar de nota muda o que Pedidos e Divisão mostram, sem entrar no registro', () => {
    const s0 = bar();
    let s = run(s0, { type: 'addNote', category: 'Doces', payerId: null, people: ids(s0), photoId: null });
    const logged = s.log.length;
    s = run(s, { type: 'selectNote', id: s.bill.notes![0].id });
    expect(activeNote(s)!.category).toBe('');
    expect(activeBill(s).items.map((i) => i.name)).toEqual(['Chopp']);
    expect(s.log.length).toBe(logged);
  });

  it('tirar alguém da nota tira dos itens dela; pôr de volta marca nos itens de todos', () => {
    const s0 = bar();
    const [ana, bruno, carla] = ids(s0);
    let s = run(s0, { type: 'addNote', category: 'Doces', payerId: null, people: [ana, bruno, carla], photoId: null }, { type: 'addItem', name: 'Bolo', cents: 900 });
    const doces = s.noteId!;
    s = run(s, { type: 'editNote', id: doces, people: [ana, bruno] });
    expect(s.bill.items.at(-1)!.who).toEqual([ana, bruno]);
    expect(s.bill.items[0].who).toEqual([ana, bruno, carla]); // o chopp, da outra nota, não muda
    s = run(s, { type: 'editNote', id: doces, people: [ana, bruno, carla] });
    expect(s.bill.items.at(-1)!.who).toEqual([ana, bruno, carla]);
    expect(s.log.at(-1)!.text).toBe('Nota Doces: dividem 3');
  });

  it('pessoa nova entra nas notas de todo mundo, não nas de só alguns', () => {
    const s0 = bar();
    const [ana] = ids(s0);
    const s = run(s0, { type: 'addNote', category: 'Doces', payerId: null, people: [ana], photoId: null }, { type: 'addPerson', name: 'Diego' });
    const diego = s.bill.people.at(-1)!.id;
    expect(s.bill.notes![0].people).toContain(diego);
    expect(s.bill.notes![1].people).toEqual([ana]);
  });

  it('tirar alguém da mesa tira das notas e de quem pagou', () => {
    const s0 = bar();
    const [ana, bruno] = ids(s0);
    const s = run(s0, { type: 'addNote', category: 'Doces', payerId: bruno, people: [ana, bruno], photoId: null }, { type: 'removePerson', id: bruno });
    expect(s.bill.notes![1]).toMatchObject({ payerId: null, people: [ana] });
  });

  it('apagar a nota apaga os itens dela; a última nota não pode ser apagada', () => {
    const s0 = bar();
    let s = run(s0, { type: 'addNote', category: 'Doces', payerId: null, people: ids(s0), photoId: null }, { type: 'addItem', name: 'Bolo', cents: 900 });
    const doces = s.noteId!;
    s = run(s, { type: 'removeNote', id: doces });
    expect(s.bill.notes!.length).toBe(1);
    expect(s.bill.items.map((i) => i.name)).toEqual(['Chopp']);
    expect(activeBill(s).items.map((i) => i.name)).toEqual(['Chopp']);
    expect(run(s, { type: 'removeNote', id: s.bill.notes![0].id })).toBe(s);
  });

  it('ler a nota guardando a foto: a foto fica na nota; "trocar" troca só os itens dela', () => {
    const s0 = bar();
    let s = run(s0, { type: 'addItems', items: [{ name: 'Pastel', cents: 800, qty: 2 }], replace: true, photoId: 'foto-1' });
    expect(s.bill.notes!.length).toBe(1);
    expect(s.bill.notes![0].photoId).toBe('foto-1');
    expect(s.bill.items.map((i) => i.name)).toEqual(['Pastel']);
    s = run(s, { type: 'addNote', category: 'Mercado', payerId: null, people: ids(s0), photoId: null }, { type: 'addItem', name: 'Gelo', cents: 1000 });
    s = run(s, { type: 'addItems', items: [{ name: 'Carvão', cents: 2500, qty: 1 }], replace: true });
    expect(s.bill.items.map((i) => i.name)).toEqual(['Pastel', 'Carvão']);
  });

  it('editar a conta de uma nota só passa a ter notas (para guardar categoria e foto)', () => {
    const s0 = bar();
    const s = run(s0, { type: 'editNote', id: 'n1', category: 'Bar', photoId: 'foto-2' });
    expect(s.bill.notes).toEqual([expect.objectContaining({ id: 'n1', category: 'Bar', photoId: 'foto-2', servicePct: 10 })]);
    expect(computeSplit(s.bill).total).toBe(computeSplit(s0.bill).total);
  });

  it('dado salvo com nota quebrada é recusado', () => {
    const s = run(bar(), { type: 'addNote', category: 'Doces', payerId: null, people: [], photoId: null });
    expect(isValidBill({ ...s.bill, notes: [{ ...s.bill.notes![0], servicePct: 7 }] })).toBe(false);
    expect(isValidBill({ ...s.bill, notes: [] })).toBe(false);
  });
});

describe('quem bancou a nota sem consumir', () => {
  it('aparece na nota com R$ 0 e recebe o total dos outros', () => {
    const s0 = bar();
    const [ana, bruno, carla] = ids(s0);
    const s = run(s0, { type: 'addNote', category: 'Doces', payerId: carla, people: [ana, bruno], photoId: null }, { type: 'addItem', name: 'Bolo', cents: 4000 });
    const view = activeBill(s);
    expect(view.people.map((p) => p.name)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(s.bill.items.at(-1)!.who).toEqual([ana, bruno]);
    expect(computeSplit(view).shares.map((x) => x.total)).toEqual([2000, 2000, 0]);
  });
});

describe('resumo do grupo: quem paga para quem', () => {
  // Bar R$ 33,00 (com 10%) pago pela Ana entre os 3; Doces R$ 40,00 pagos pela Carla entre Ana e Bruno.
  function festa() {
    const s0 = bar();
    const [ana, bruno, carla] = ids(s0);
    const s = run(s0, { type: 'addNote', category: 'Doces', payerId: carla, people: [ana, bruno], photoId: null }, { type: 'addItem', name: 'Bolo', cents: 4000 });
    return { s, ana, bruno, carla };
  }

  it('soma por pessoa e por nota', () => {
    const { s } = festa();
    const g = groupSummary(s.bill);
    expect(g.notes.map((n) => [n.label, n.result.total, n.payer?.name])).toEqual([['Nota 1', 3300, 'Ana'], ['Doces', 4000, 'Carla']]);
    expect(g.people.map((p) => [p.person.name, p.byNote, p.total])).toEqual([
      ['Ana', [1100, 2000], 3100],
      ['Bruno', [1100, 2000], 3100],
      ['Carla', [1100, 0], 1100],
    ]);
    expect(g.total).toBe(7300);
  });

  it('compensa as dívidas entre as notas', () => {
    const { s, ana, bruno, carla } = festa();
    const g = groupSummary(s.bill);
    // Ana: recebe 22 do bar, deve 20 dos doces = +2. Bruno: deve 11 + 20 = -31. Carla: deve 11, recebe 40 = +29.
    expect(g.balance).toEqual({ [ana]: 200, [bruno]: -3100, [carla]: 2900 });
    // Direto (padrão): cada um paga para quem pagou a nota; Ana e Carla se compensam.
    expect(g.transfers).toEqual([
      { from: ana, to: carla, cents: 900 },
      { from: bruno, to: carla, cents: 2000 },
      { from: bruno, to: ana, cents: 1100 },
    ]);
    // "Menos Pix" saiu: mesmo uma conta antiga com ele guardado fica direto para quem pagou.
    expect(groupSummary(run(s, { type: 'settleMode', mode: 'min' }).bill).transfers).toEqual(g.transfers);
  });

  it('acerto marcado sai do que falta, mas fica no plano marcado; desfazer volta', () => {
    const { s: s0, ana, bruno, carla } = festa();
    const paid = run(s0, { type: 'settle', from: bruno, to: carla, cents: 2000 });
    expect(groupSummary(paid.bill).transfers).toEqual([
      { from: ana, to: carla, cents: 900 },
      { from: bruno, to: ana, cents: 1100 },
    ]);
    expect(groupSummary(paid.bill).plan.direct[1]).toEqual({ from: bruno, to: carla, cents: 2000, paid: 2000, remaining: 0 });
    expect(paid.log.at(-1)!.text).toBe('Bruno pagou R$ 20,00 a Carla');
    const undone = run(paid, { type: 'unsettle', index: 0 });
    expect(groupSummary(undone.bill).transfers.length).toBe(3);
    expect(undone.log.at(-1)!.text).toBe('Desfez: Bruno pagou R$ 20,00 a Carla');
    expect(isValidBill(paid.bill)).toBe(true);
  });

  it('"já pagou" marcado na nota também conta', () => {
    const { s, ana, bruno } = festa();
    const opened = run(s, { type: 'selectNote', id: s.bill.notes![0].id }, { type: 'markPaid', personId: bruno, paid: true });
    expect(groupSummary(opened.bill).balance[bruno]).toBe(-2000);
    expect(groupSummary(opened.bill).balance[ana]).toBe(-900);
  });

  it('nota sem pagador não gera dívida e aparece como "cada um paga no caixa"', () => {
    const s0 = bar();
    const s = run(s0, { type: 'payer', id: null });
    const g = groupSummary(s.bill);
    expect(g.transfers).toEqual([]);
    expect(g.withoutPayer.map((n) => n.label)).toEqual(['Nota 1']);
  });

  it('a soma das transferências zera os saldos', () => {
    const balance = { a: 1234, b: -500, c: -734, d: 0 };
    const t = settleUp(balance, ['a', 'b', 'c', 'd']);
    const after = { ...balance } as Record<string, number>;
    t.forEach((x) => { after[x.from] += x.cents; after[x.to] -= x.cents; });
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(3);
  });

  it('tirar alguém da mesa tira os acertos dele', () => {
    const { s, bruno, carla } = festa();
    const t = run(s, { type: 'settle', from: bruno, to: carla, cents: 100 }, { type: 'removePerson', id: bruno });
    expect(t.bill.settled).toEqual([]);
  });
});

describe('texto do resumo do grupo', () => {
  it('lista notas, quanto cada um gastou e quem paga para quem', () => {
    const s0 = run(bar(), { type: 'title', title: 'Festa' });
    const [ana, bruno, carla] = ids(s0);
    let s = run(s0, { type: 'addNote', category: 'Doces', payerId: carla, people: [ana, bruno], photoId: null }, { type: 'addItem', name: 'Bolo', cents: 4000 });
    s = run(s, { type: 'settle', from: bruno, to: ana, cents: 1100 });
    expect(groupSummaryText(s.bill)).toBe(
      [
        '*Racha Conta* - Festa',
        'Total: R$ 73,00 (2 notas)',
        '',
        '*Notas*',
        '🧾 Nota 1: R$ 33,00 · pago por Ana',
        '🍬 Doces: R$ 40,00 · pago por Carla',
        '',
        '*Quanto cada um gastou*',
        '- Ana: R$ 31,00 (Nota 1 R$ 11,00 · Doces R$ 20,00)',
        '- Bruno: R$ 31,00 (Nota 1 R$ 11,00 · Doces R$ 20,00)',
        '- Carla: R$ 11,00',
        '',
        '*Quem paga para quem*',
        '- Ana paga R$ 9,00 para Carla',
        '- Bruno paga R$ 20,00 para Carla',
        '- Bruno pagou R$ 11,00 a Ana ✅',
      ].join('\n'),
    );
  });
});

describe('ler nota em nota nova', () => {
  it('cria uma nota separada só com os itens da foto, e ela fica aberta', () => {
    const s0 = bar();
    const s = run(s0, { type: 'addItems', items: [{ name: 'Pimenta', cents: 1320, qty: 1 }], replace: true, newNote: true, photoId: 'f' });
    expect(s.bill.notes!.length).toBe(2);
    expect(activeNote(s)).toMatchObject({ photoId: 'f', payerId: null, people: ids(s0) });
    expect(activeBill(s).items.map((i) => i.name)).toEqual(['Pimenta']);
    expect(s.bill.items.map((i) => i.name)).toEqual(['Chopp', 'Pimenta']);
    expect(s.bill.notes![0].photoId).toBeNull();
    expect(s.log.at(-1)!.text).toContain('em nota nova');
  });
});

/** O que falta pagar fecha ao centavo com o saldo de agora de cada conta. */
function closes(g: GroupSummary, mode: 'direct' | 'min', accounts: Record<string, string>) {
  const left: Record<string, number> = {};
  for (const [id, b] of Object.entries(g.balance)) left[accounts[id] ?? id] = (left[accounts[id] ?? id] ?? 0) + b;
  for (const r of g.plan[mode]) {
    left[r.to] -= r.remaining;
    left[r.from] += r.remaining;
  }
  return Object.values(left).every((v) => v === 0);
}

describe('Rolê: quem paga a parte de quem', () => {
  it('numa nota só: a parte da Carla entra na do Bruno, que paga tudo de uma vez', () => {
    const s0 = bar();
    const [, bruno, carla] = ids(s0);
    const s = run(s0, { type: 'cover', id: carla, by: bruno });
    expect(s.log.at(-1)!.text).toBe('Bruno paga a parte de Carla');
    const rows = payments(s.bill).rows;
    expect(rows[2]).toMatchObject({ state: 'covered', by: bruno, owed: 0 });
    expect(rows[1]).toMatchObject({ state: 'open', due: 2200, owed: 2200, covers: [carla], coversCents: 1100 });
    expect(payments(s.bill).remaining).toBe(2200);
    expect(summaryText(s.bill)).toContain('- Bruno (com a parte de Carla) deve R$ 22,00');
    expect(summaryText(s.bill)).toContain('- Carla: R$ 11,00, Bruno paga');

    const paid = run(s, { type: 'markPaid', personId: bruno, paid: true });
    expect(paid.bill.paid).toEqual({ [bruno]: 2200 });
    expect(payments(paid.bill)).toMatchObject({ remaining: 0, paidCount: 3 });
    // A parte coberta não se marca sozinha.
    expect(run(s, { type: 'markPaid', personId: carla, paid: true })).toBe(s);
  });

  it('quem tem a parte paga por quem pagou a conta não deve nada', () => {
    const s0 = bar();
    const [ana, , carla] = ids(s0);
    const s = run(s0, { type: 'cover', id: carla, by: ana });
    expect(payments(s.bill).rows[2]).toMatchObject({ state: 'covered', by: ana });
    expect(payments(s.bill).remaining).toBe(1100);
  });

  it('várias notas: a conta do Bruno leva a da Carla, nos dois modos', () => {
    const s0 = bar();
    const [ana, bruno, carla] = ids(s0);
    let s = run(s0, { type: 'addNote', category: 'Doces', payerId: carla, people: [ana, bruno], photoId: null }, { type: 'addItem', name: 'Bolo', cents: 4000 });
    s = run(s, { type: 'cover', id: carla, by: bruno });
    const acc = { [carla]: bruno };
    const g = groupSummary(s.bill);
    // Bruno e Carla devem 22 à Ana pelo bar; Ana deve 20 à Carla (conta do Bruno) pelos doces.
    expect(g.plan.direct).toEqual([{ from: bruno, to: ana, cents: 200, paid: 0, remaining: 200 }]);
    expect(g.plan.min).toEqual([{ from: bruno, to: ana, cents: 200, paid: 0, remaining: 200 }]);
    expect(closes(g, 'direct', acc) && closes(g, 'min', acc)).toBe(true);
    expect(groupSummaryText(s.bill)).toContain('- Bruno (com Carla) paga R$ 2,00 para Ana');
  });

  it('pagamento fica na lista marcado; desmarcar volta; pagar a mais vira ajuste que fecha', () => {
    const { ana, bruno, carla, s } = (() => {
      const s0 = bar();
      const [a, b, c] = ids(s0);
      return { ana: a, bruno: b, carla: c, s: run(s0, { type: 'addNote', category: 'Doces', payerId: c, people: [a, b], photoId: null }, { type: 'addItem', name: 'Bolo', cents: 4000 }) };
    })();
    const paid = run(s, { type: 'settle', from: bruno, to: carla, cents: 2000 });
    const g = groupSummary(paid.bill);
    expect(g.plan.direct.find((r) => r.from === bruno && r.to === carla)).toEqual({ from: bruno, to: carla, cents: 2000, paid: 2000, remaining: 0 });
    expect(g.transfers.some((t) => t.from === bruno && t.to === carla)).toBe(false);

    const undone = run(paid, { type: 'unsettlePair', from: bruno, to: carla });
    expect(undone.bill.settled).toEqual([]);
    expect(undone.log.at(-1)!.text).toBe('Desmarcou o pagamento de Bruno para Carla');

    const over = run(s, { type: 'settle', from: bruno, to: ana, cents: 5000 });
    for (const mode of ['direct', 'min'] as const) expect(closes(groupSummary(over.bill), mode, {})).toBe(true);
  });

  it('não deixa fechar círculo; quem sai leva junto quem ela cobria; dados válidos', () => {
    const s0 = bar();
    const [ana, bruno, carla] = ids(s0);
    let s = run(s0, { type: 'cover', id: carla, by: bruno });
    expect(run(s, { type: 'cover', id: bruno, by: carla })).toBe(s);
    expect(run(s, { type: 'cover', id: ana, by: ana })).toBe(s);
    expect(isValidBill(s.bill)).toBe(true);
    s = run(s, { type: 'cover', id: carla, by: null });
    expect(s.bill.people[2].coveredBy).toBeUndefined();
    expect(s.log.at(-1)!.text).toBe('Carla volta a pagar a própria parte');
    s = run(s, { type: 'cover', id: carla, by: bruno }, { type: 'removePerson', id: bruno });
    expect(s.bill.people.map((p) => p.coveredBy)).toEqual([undefined, undefined]);
    expect(isValidBill({ ...s.bill, people: [{ id: 'x', name: 'X', color: 0, coveredBy: 3 }] })).toBe(false);
  });

  it('modo do acerto: guarda "menos Pix"; o direto é o padrão e não é guardado', () => {
    let s = run(bar(), { type: 'settleMode', mode: 'min' });
    expect(s.bill.settleMode).toBe('min');
    expect(isValidBill(s.bill)).toBe(true);
    s = run(s, { type: 'settleMode', mode: 'direct' });
    expect(s.bill.settleMode).toBeUndefined();
    expect(isValidBill({ ...s.bill, settleMode: 'x' })).toBe(false);
  });
});
