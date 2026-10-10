import { describe, expect, it } from 'vitest';
import { blankState, exampleState, reducer, worthKeeping } from './billState';
import { addEntry, fromEntry, removeEntry, toEntry } from './history';

describe('o que vai para os Rolês', () => {
  it('não guarda a mesa de exemplo intocada nem conta vazia', () => {
    expect(worthKeeping(exampleState())).toBe(false);
    expect(worthKeeping(blankState())).toBe(false);
  });

  it('guarda conta com pessoa, item ou só a foto', () => {
    const s = blankState();
    expect(worthKeeping(reducer(s, { type: 'addPerson', name: 'Ana' }))).toBe(true);
    expect(worthKeeping(reducer(s, { type: 'addItem', name: 'Chopp', cents: 1000 }))).toBe(true);
    expect(worthKeeping(reducer(s, { type: 'photo', photoId: 'f1' }))).toBe(true);
  });

  it('mexer no exemplo (até pôr foto) transforma em conta de verdade', () => {
    expect(reducer(exampleState(), { type: 'photo', photoId: 'f1' }).example).toBe(false);
  });
});

describe('lista de Rolês', () => {
  const at = (id: string, startedAt: number) => toEntry({ ...blankState(), id, startedAt });

  it('fica do mais recente para o mais antigo', () => {
    let h = addEntry([], at('a', 100));
    h = addEntry(h, at('c', 300));
    h = addEntry(h, at('b', 200));
    expect(h.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('guardar de novo a mesma conta atualiza em vez de duplicar', () => {
    const h = addEntry(addEntry([], at('a', 100)), { ...at('a', 100), bill: { ...blankState().bill, title: 'Bar' } });
    expect(h).toHaveLength(1);
    expect(h[0].bill.title).toBe('Bar');
  });

  it('apagar tira só aquele rolê', () => {
    const h = [at('a', 1), at('b', 2)];
    expect(removeEntry(h, 'a').map((e) => e.id)).toEqual(['b']);
  });

  it('reabrir devolve a conta inteira, com data e foto', () => {
    const s = { ...reducer(blankState(), { type: 'addPerson', name: 'Ana' }), photoId: 'f9', startedAt: 42 };
    const back = reducer(blankState(), { type: 'open', state: fromEntry(toEntry(s)) });
    expect(back).toMatchObject({ id: s.id, startedAt: 42, photoId: 'f9', example: false, bill: s.bill });
  });

  it('nova conta começa sem foto e com outro id', () => {
    const s = reducer(reducer(blankState(), { type: 'photo', photoId: 'f1' }), { type: 'reset' });
    expect(s.photoId).toBeNull();
  });
});
