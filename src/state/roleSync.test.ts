import { describe, expect, it } from 'vitest';
import { computeSplit } from '../core/bill';
import { blankState, reducer, roleDoc, type Action, type AppState } from './billState';
import { fromEntry, toEntry } from './history';

const run = (s: AppState, ...a: Action[]) => a.reduce(reducer, s);
const ids = (s: AppState) => s.bill.people.map((p) => p.id);

function shared() {
  let s = run(blankState(), { type: 'addPerson', name: 'Rebeca' }, { type: 'addPerson', name: 'Mauricio' });
  s = run(s, { type: 'setAuthor', name: 'Rebeca' }, { type: 'syncLink', groupId: 'g1', code: 'c1', version: 1 });
  return s;
}

describe('rolê compartilhado (fila e versões)', () => {
  it('mudança entra na fila com o nome de quem fez; nota aberta e foto ficam só no aparelho', () => {
    let s = run(shared(), { type: 'addItem', name: 'Picanha', cents: 8000 });
    expect(s.shared!.pending.map((a) => a.type)).toEqual(['addItem']);
    expect(s.log.at(-1)).toMatchObject({ by: 'Rebeca' });
    s = run(s, { type: 'photo', photoId: 'foto-local' });
    expect(s.shared!.pending).toHaveLength(1);
  });

  it('rolê só neste aparelho não usa fila nem autor', () => {
    const s = run(blankState(), { type: 'setAuthor', name: 'Rebeca' }, { type: 'addPerson', name: 'Ana' });
    expect(s.shared).toBeUndefined();
    expect(s.log.at(-1)!.by).toBeNull();
  });

  it('outra pessoa salvou antes: a versão dela chega e a minha mudança é refeita por cima', () => {
    const start = shared();
    const [r, m] = ids(start);
    let mine = run(start, { type: 'addItem', name: 'Picanha', cents: 8000 });
    // Mauricio lançou a cerveja (versão 2) enquanto a picanha esperava na fila.
    const theirs = run({ ...start, shared: undefined }, { type: 'addItem', name: 'Cerveja', cents: 2000 });
    mine = run(mine, { type: 'syncRemote', doc: roleDoc(theirs), version: 2 });
    expect(mine.bill.items.map((i) => i.name)).toEqual(['Cerveja', 'Picanha']);
    expect(mine.shared).toMatchObject({ version: 2, pending: [{ type: 'addItem', name: 'Picanha' }] });
    // A conta fecha: 100 + 10% = 110, metade para cada um.
    const split = computeSplit(mine.bill);
    expect(split.total).toBe(11000);
    expect(Object.fromEntries(split.shares.map((x) => [x.person.id, x.total]))).toEqual({ [r]: 5500, [m]: 5500 });
    // Salvou: a fila esvazia.
    const saved = run(mine, { type: 'syncSaved', version: 3, count: 1, sent: roleDoc(mine) });
    expect(saved.shared).toMatchObject({ version: 3, pending: [] });
    // Versão velha não volta atrás.
    expect(run(saved, { type: 'syncRemote', doc: roleDoc(theirs), version: 2 })).toBe(saved);
  });

  it('ir para Rolês e reabrir mantém o vínculo com o grupo', () => {
    const s = run(shared(), { type: 'addItem', name: 'Picanha', cents: 8000 });
    const back = fromEntry(JSON.parse(JSON.stringify(toEntry(s))));
    expect(back.shared).toMatchObject({ groupId: 'g1', pending: [{ type: 'addItem' }] });
  });

  it('perdeu o acesso: a conta fica só neste aparelho', () => {
    const s = run(shared(), { type: 'syncUnlink' });
    expect(s.shared).toBeUndefined();
    expect(s.bill.people).toHaveLength(2);
  });
});
