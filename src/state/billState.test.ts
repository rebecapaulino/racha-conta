import { describe, expect, it } from 'vitest';
import { computeSplit, MAX_QTY } from '../core/bill';
import { blankState, exampleState, reducer, type Action, type AppState } from './billState';

const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);
const texts = (s: AppState) => s.log.map((e) => e.text);

describe('quantidade no item', () => {
  const base = run(blankState(), { type: 'addPerson', name: 'Ana' }, { type: 'addItem', name: 'Chopp', cents: 1450 });
  const id = base.bill.items[0].id;

  it('+ soma uma unidade e mantém as mesmas pessoas', () => {
    const s = run(base, { type: 'qty', id, delta: 1 }, { type: 'qty', id, delta: 1 });
    expect(s.bill.items[0]).toMatchObject({ qty: 3, cents: 1450, who: base.bill.items[0].who });
    expect(computeSplit({ ...s.bill, servicePct: 0 }).total).toBe(4350);
  });

  it('não desce de 1 nem passa do máximo', () => {
    expect(run(base, { type: 'qty', id, delta: -1 })).toBe(base);
    const many = run(base, ...Array.from({ length: MAX_QTY + 5 }, () => ({ type: 'qty', id, delta: 1 }) as Action));
    expect(many.bill.items[0].qty).toBe(MAX_QTY);
  });
});

describe('registro de alterações', () => {
  it('anota o que foi feito, em ordem, sem autor no modo solo', () => {
    let s = run(
      blankState(),
      { type: 'addPerson', name: 'Ana' },
      { type: 'addPerson', name: 'Bruno' },
      { type: 'addItem', name: 'Chopp', cents: 1450 },
    );
    const item = s.bill.items[0].id;
    const bruno = s.bill.people[1].id;
    s = run(
      s,
      { type: 'qty', id: item, delta: 1 },
      { type: 'toggle', itemId: item, personId: bruno },
      { type: 'service', pct: 12 },
      { type: 'payer', id: bruno },
      { type: 'removePerson', id: bruno },
      { type: 'removeItem', id: item },
    );
    expect(texts(s)).toEqual([
      'Adicionou Ana à mesa',
      'Adicionou Bruno à mesa',
      'Adicionou Chopp · R$ 14,50',
      'Mais um: Chopp (agora 2×)',
      'Desmarcou Bruno de Chopp',
      'Serviço em 12%',
      'Bruno pagou a conta',
      'Tirou Bruno da mesa',
      'Removeu 2× Chopp · R$ 29,00',
    ]);
    expect(s.log.every((e) => e.by === null && typeof e.at === 'number')).toBe(true);
  });

  it('digitar o nome do lugar vira uma linha só', () => {
    const s = run(blankState(), ...'Bar'.split('').map((_, i) => ({ type: 'title', title: 'Bar'.slice(0, i + 1) }) as Action));
    expect(texts(s)).toEqual(['Mudou o nome do lugar para "Bar"']);
  });

  it('ação que não muda nada não gera linha', () => {
    expect(run(blankState(), { type: 'addPerson', name: '   ' }).log).toEqual([]);
  });

  it('nova conta começa com registro vazio', () => {
    const s = run(exampleState(), { type: 'service', pct: 15 }, { type: 'reset' });
    expect(s.log).toEqual([]);
  });
});

describe('marcar quem já pagou', () => {
  const s0 = run(blankState(), { type: 'addPerson', name: 'Ana' }, { type: 'addItem', name: 'Pizza', cents: 5000 });
  const ana = s0.bill.people[0].id;

  it('guarda o valor da parte dela no momento e anota no registro', () => {
    const s = run(s0, { type: 'markPaid', personId: ana, paid: true });
    expect(s.bill.paid).toEqual({ [ana]: 5500 });
    expect(s.log.at(-1)!.text).toBe('Ana pagou R$ 55,00');
  });

  it('desmarcar apaga o pagamento; desmarcar quem não pagou não muda nada', () => {
    const s = run(s0, { type: 'markPaid', personId: ana, paid: true }, { type: 'markPaid', personId: ana, paid: false });
    expect(s.bill.paid).toEqual({});
    expect(s.log.at(-1)!.text).toBe('Desmarcou o pagamento de Ana');
    expect(run(s0, { type: 'markPaid', personId: ana, paid: false })).toBe(s0);
  });
});
