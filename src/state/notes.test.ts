import { describe, expect, it } from 'vitest';
import { computeSplit } from '../core/bill';
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
