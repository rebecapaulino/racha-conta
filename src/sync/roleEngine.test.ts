// Rolê compartilhado: quem entra no grupo vai para a mesa. Testes da regra (joinPerson) e de
// integração: vários "celulares" (reducer + motor de verdade) com um servidor de mentira que
// confere a versão como o save_group do Supabase.

import { describe, expect, it } from 'vitest';
import { computeSplit, joinPerson, removePerson, type Bill } from '../core/bill';
import { blankState, isValidBill, reducer, roleDoc, type Action, type AppState, type RoleDoc } from '../state/billState';
import type { Member } from './groups';
import { pullRole, pushRole, roleMemberActions, type RoleApi } from './roleEngine';

const bill = (names: string[], extra: Partial<Bill> = {}): Bill => ({
  title: 'Bar do Zé',
  servicePct: 10,
  payerId: null,
  people: names.map((name, i) => ({ id: name.toLowerCase(), name, color: i })),
  items: [],
  ...extra,
});

describe('joinPerson (regra)', () => {
  it('conta nova: entra com o primeiro nome, ligada à conta, e nas notas que eram de todos', () => {
    const b = bill(['Rebeca', 'Caio'], {
      notes: [
        { id: 'n1', category: '', servicePct: 10, payerId: null, people: ['rebeca', 'caio'], photoId: null },
        { id: 'n2', category: '', servicePct: 0, payerId: null, people: ['rebeca'], photoId: null },
      ],
    });
    const r = joinPerson(b, 'u-bia', 'Bia Souza', 'nova', 2);
    expect(r.added).toBe(true);
    expect(r.bill.people.at(-1)).toEqual({ id: 'nova', name: 'Bia', color: 2, userId: 'u-bia' });
    expect(r.bill.notes![0].people).toEqual(['rebeca', 'caio', 'nova']);
    expect(r.bill.notes![1].people).toEqual(['rebeca']);
    expect(r.bill.joined).toEqual(['u-bia']);
  });

  it('nome já na mesa: liga em vez de duplicar (sem acento/maiúscula)', () => {
    const r = joinPerson(bill(['Rebeca', 'Lúcia']), 'u-l', 'LUCIA Mendes', 'nova', 2);
    expect(r.added).toBe(false);
    expect(r.bill.people).toHaveLength(2);
    expect(r.bill.people[1].userId).toBe('u-l');
  });

  it('duas pessoas com o nome: entra nova, com o nome inteiro', () => {
    const b: Bill = { ...bill([]), people: [{ id: 'a1', name: 'Ana', color: 0 }, { id: 'a2', name: 'Ana', color: 1 }] };
    expect(joinPerson(b, 'u', 'Ana Paula', 'nova', 2).bill.people.at(-1)!.name).toBe('Ana Paula');
  });

  it('uma vez só; tirada da mesa não volta', () => {
    const once = joinPerson(bill(['Rebeca']), 'u-bia', 'Bia', 'b1', 1).bill;
    expect(joinPerson(once, 'u-bia', 'Bia', 'b2', 2).bill).toBe(once);
    const removed = removePerson(once, 'b1');
    expect(joinPerson(removed, 'u-bia', 'Bia', 'b3', 3).bill).toBe(removed);
  });

  it('dados novos são aceitos; estranhos, não', () => {
    const b = joinPerson(bill(['Rebeca']), 'u-bia', 'Bia', 'b1', 1).bill;
    expect(isValidBill(b)).toBe(true);
    expect(isValidBill({ ...b, joined: [1] })).toBe(false);
    expect(isValidBill({ ...b, people: [{ ...b.people[0], userId: 3 }] })).toBe(false);
  });
});

describe('ação joinPerson no estado', () => {
  it('entra na fila do grupo, avança a cor e anota no registro', () => {
    let s: AppState = [{ type: 'addPerson', name: 'Rebeca' } as Action, { type: 'setAuthor', name: 'Bia Souza' } as Action].reduce(reducer, blankState());
    s = reducer(s, { type: 'syncLink', groupId: 'g', code: 'c', version: 1 });
    const color = s.nextColor;
    s = reducer(s, { type: 'joinPerson', userId: 'u-bia', name: 'Bia Souza', id: 'b1' });
    expect(s.bill.people.at(-1)).toMatchObject({ id: 'b1', name: 'Bia', color, userId: 'u-bia' });
    expect(s.nextColor).toBe(color + 1);
    expect(s.shared!.pending).toHaveLength(1);
    expect(s.log.at(-1)).toMatchObject({ text: 'Bia entrou no rolê', by: 'Bia Souza' });
    const again = reducer(s, { type: 'joinPerson', userId: 'u-bia', name: 'Bia Souza', id: 'b2' });
    expect(again).toBe(s);
  });
});

// ---------- integração ----------

class Server {
  groups = new Map<string, { doc: RoleDoc; version: number; members: Member[] }>();
  api(userId: string): RoleApi {
    return {
      save: async (groupId, doc, base) => {
        const g = this.groups.get(groupId)!;
        if (!g.members.some((m) => m.userId === userId)) throw new Error('sem acesso');
        if (g.version !== base) return -1;
        g.doc = JSON.parse(JSON.stringify(doc));
        return ++g.version;
      },
      fetch: async (groupId) => {
        const g = this.groups.get(groupId);
        if (!g || !g.members.some((m) => m.userId === userId)) return null;
        return { content: JSON.parse(JSON.stringify(g.doc)), version: g.version, code: 'c' };
      },
    };
  }
}

let ids = 0;
const newId = () => `r${++ids}`;

class Phone {
  state: AppState = blankState();
  api: RoleApi;
  constructor(public server: Server, public userId: string, public name: string) {
    this.api = server.api(userId);
    this.do({ type: 'setAuthor', name });
  }
  do(...as: Action[]) {
    for (const a of as) this.state = reducer(this.state, a);
  }
  /** "Criar link de convite". */
  share() {
    this.server.groups.set('g1', { doc: JSON.parse(JSON.stringify(roleDoc(this.state))), version: 1, members: [{ userId: this.userId, name: this.name, photo: null, role: 'owner' }] });
    this.do({ type: 'syncLink', groupId: 'g1', code: 'c', version: 1 });
  }
  /** "Entrar no grupo" (o que o SoloApp faz). */
  async join(newApp = true) {
    const g = this.server.groups.get('g1')!;
    if (!g.members.some((m) => m.userId === this.userId)) g.members.push({ userId: this.userId, name: this.name, photo: null, role: 'editor' });
    const remote = (await this.api.fetch('g1'))!;
    const doc = remote.content as RoleDoc;
    this.do({ type: 'open', state: { ...blankState(), ...doc, photoId: doc.photoId ?? null, id: 'grupo-g1', shared: { groupId: 'g1', code: 'c', version: remote.version, base: doc, pending: [] }, author: this.name } });
    if (newApp) this.do({ type: 'joinPerson', userId: this.userId, name: this.name, id: newId() });
  }
  async push() {
    for (let i = 0; i < 20 && this.state.shared?.pending.length; i++) {
      const { action } = await pushRole(this.api, this.state);
      if (action) this.do(action);
    }
  }
  async pull() {
    const { action } = await pullRole(this.api, 'g1');
    if (action) this.do(action);
    this.do(...roleMemberActions(this.state.bill, this.server.groups.get('g1')!.members, newId));
  }
  async sync() {
    await this.pull();
    await this.push();
    await this.pull();
  }
  names() {
    return this.state.bill.people.map((p) => p.name);
  }
}

function table() {
  const server = new Server();
  const reb = new Phone(server, 'u-reb', 'Rebeca Oliveira');
  reb.do({ type: 'addPerson', name: 'Rebeca' }, { type: 'addPerson', name: 'Caio' }, { type: 'addItem', name: 'Fritas', cents: 3000 });
  reb.share();
  return { server, reb, bia: new Phone(server, 'u-bia', 'Bia Souza'), dani: new Phone(server, 'u-dani', 'Dani Reis') };
}

describe('rolê compartilhado: quem entra vai para a mesa', () => {
  it('Bia entra: aparece na mesa nos dois celulares e pode entrar nos itens de antes', async () => {
    const { reb, bia } = table();
    await bia.join();
    expect(bia.names()).toEqual(['Rebeca', 'Caio', 'Bia']);
    await bia.push();
    await reb.sync();
    expect(reb.names()).toEqual(['Rebeca', 'Caio', 'Bia']);
    // As fritas eram de antes: a Bia não está nelas até alguém marcar.
    const fritas = reb.state.bill.items[0];
    const biaId = reb.state.bill.people[2].id;
    expect(fritas.who).not.toContain(biaId);
    reb.do({ type: 'toggle', itemId: fritas.id, personId: biaId });
    await reb.push();
    await bia.pull();
    const split = computeSplit(bia.state.bill);
    expect(split.shares.find((x) => x.person.id === biaId)!.consumption).toBe(1000);
    expect(bia.state.bill).toEqual(reb.state.bill);
  });

  it('a dona (que já está na mesa) não é adicionada de novo', async () => {
    const { reb, bia } = table();
    await bia.join();
    await bia.push();
    await reb.sync();
    await bia.sync();
    expect(reb.names().filter((n) => n === 'Rebeca')).toHaveLength(1);
    expect(reb.names()).toHaveLength(3);
  });

  it('entrou com o app antigo: é adicionada na próxima conferência, uma vez só, mesmo com dois celulares', async () => {
    const { reb, bia, dani } = table();
    await dani.join();
    await dani.push();
    await bia.join(false); // app antigo: entrou no grupo, mas não foi para a mesa
    await reb.pull();
    await dani.pull();
    await reb.push();
    await dani.push(); // conflito: refaz por cima, sem duplicar
    for (const p of [reb, dani, bia, reb, dani, bia]) await p.sync();
    expect(reb.names()).toEqual(['Rebeca', 'Caio', 'Dani', 'Bia']);
    expect(dani.state.bill).toEqual(reb.state.bill);
    expect(bia.state.bill).toEqual(reb.state.bill);
  });

  it('tirada da mesa não volta sozinha', async () => {
    const { reb, bia } = table();
    await bia.join();
    await bia.push();
    await reb.sync();
    reb.do({ type: 'removePerson', id: reb.state.bill.people[2].id });
    await reb.sync();
    await reb.sync();
    expect(reb.names()).toEqual(['Rebeca', 'Caio']);
  });
});
