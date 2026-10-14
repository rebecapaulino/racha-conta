// Teste de integração do motor da viagem compartilhada: vários "celulares" (o reducer de
// verdade + o motor de verdade) falando com um servidor de mentira que se comporta como as
// funções do Supabase (create_group, join_group, save_group com conferência de versão).

import { describe, expect, it } from 'vitest';
import { tripSummary, type Trip } from '../core/trip';
import { blankTrips, meOf, openTrip, tripsReducer, type TripAction, type TripsState } from '../state/tripState';
import type { Member, RemoteTrip } from './groups';
import { CHOOSE_MS, joinByInvite, memberActions, pullTrip, pushTrip, selfJoin, type TripApi } from './tripEngine';

/** O banco: grupos com a viagem, a versão, o convite e quem está nele. */
class Server {
  groups = new Map<string, { trip: Trip; version: number; code: string; members: Member[] }>();
  private n = 0;
  offline = false;
  /** Relógio do servidor (quando cada um entrou). */
  now = Date.parse('2026-12-28T12:00:00Z');
  /** Passam os 10 minutos para quem entrou dizer quem é. */
  later() {
    this.now += CHOOSE_MS + 1000;
  }

  create(trip: Trip, user: { id: string; name: string }) {
    const id = `g${++this.n}`;
    const code = `convite-${this.n}`;
    this.groups.set(id, { trip: clone(trip), version: 1, code, members: [{ userId: user.id, name: user.name, photo: null, role: 'owner', joinedAt: new Date(this.now).toISOString() }] });
    return { groupId: id, code, version: 1 };
  }

  preview(code: string) {
    for (const [id, g] of this.groups) if (g.code === code) return { groupId: id, title: g.trip.name };
    return null;
  }

  /** O que cada celular enxerga (só o grupo de que a conta faz parte). */
  api(userId: string): TripApi {
    const net = () => {
      if (this.offline) throw new Error('sem internet');
    };
    return {
      save: async (groupId, trip, base) => {
        net();
        const g = this.groups.get(groupId);
        if (!g || !g.members.some((m) => m.userId === userId)) throw new Error('sem acesso');
        if (g.version !== base) return -1;
        g.trip = clone(trip);
        g.version += 1;
        return g.version;
      },
      fetch: async (groupId): Promise<RemoteTrip | null> => {
        net();
        const g = this.groups.get(groupId);
        if (!g || !g.members.some((m) => m.userId === userId)) return null;
        return { trip: clone(g.trip), version: g.version, code: g.code };
      },
      join: async (code, name, photo) => {
        net();
        for (const [id, g] of this.groups) {
          if (g.code !== code) continue;
          if (!g.members.some((m) => m.userId === userId)) g.members.push({ userId, name, photo, role: 'editor', joinedAt: new Date(this.now).toISOString() });
          return id;
        }
        throw new Error('convite inválido');
      },
    };
  }

  members(groupId: string) {
    return clone(this.groups.get(groupId)!.members);
  }
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

let ids = 0;
const newId = () => `id${++ids}`;

/** Um celular: o estado do app, a conta logada e o que o useTripSync faria. */
class Phone {
  state: TripsState = blankTrips();
  api: TripApi;
  constructor(public server: Server, public account: { id: string; name: string; photo: null }) {
    this.api = server.api(account.id);
    this.do({ type: 'setAuthor', name: account.name });
  }
  do(...actions: TripAction[]) {
    for (const a of actions) this.state = tripsReducer(this.state, a);
    return this;
  }
  get trip() {
    return openTrip(this.state)!;
  }
  get me() {
    return meOf(this.state, this.trip, this.account.id);
  }
  entry(tripId = this.trip.id) {
    return this.state.sync?.[tripId];
  }
  /** "Criar link de convite". */
  share() {
    const g = this.server.create(this.trip, this.account);
    this.do({ type: 'syncLink', tripId: this.trip.id, groupId: g.groupId, code: g.code, version: g.version });
    return g.code;
  }
  /**
   * Resposta a "Quem é você nesta viagem?": o nome de uma pessoa da lista, null para "Sou uma
   * pessoa nova", ou undefined (ainda não respondeu).
   */
  answer: string | null | undefined = undefined;
  /** "Entrar no grupo" no convite, e a resposta à pergunta que vem em seguida. */
  async join(code: string, answer: string | null | 'sem resposta' = null) {
    const { actions } = await joinByInvite(this.api, code, this.account);
    this.do(...actions);
    this.answer = answer === 'sem resposta' ? undefined : answer;
    this.self();
  }
  /** O que a tela faz com selfJoin: resolve sozinho, ou responde a pergunta (se já respondeu). */
  asked = false;
  self() {
    const e = this.entry();
    if (!e) return;
    const r = selfJoin(this.trip, this.server.members(e.groupId), this.account, this.me, newId);
    this.asked = r.kind === 'ask';
    if (r.kind === 'auto') this.do(r.action);
    if (r.kind === 'ask' && this.answer !== undefined) {
      const prefer = this.answer === null ? undefined : r.free.find((p) => p.name === this.answer)?.id;
      if (this.answer !== null && !prefer) throw new Error(`${this.answer} não está na lista`);
      this.do({ type: 'joinTraveler', tripId: this.trip.id, userId: this.account.id, name: this.account.name, id: newId(), self: true, claim: true, ...(prefer ? { prefer } : {}) });
      this.asked = false;
    }
  }
  /** Envia a fila de todas as viagens até esvaziar (como o efeito de envio). */
  async push() {
    for (let guard = 0; guard < 20; guard++) {
      let any = false;
      for (const [tripId, e] of Object.entries(this.state.sync ?? {})) {
        if (!e.pending.length) continue;
        any = true;
        const { action } = await pushTrip(this.api, this.state, tripId);
        if (action) this.do(action);
      }
      if (!any) return;
    }
    throw new Error('a fila não esvaziou');
  }
  /** Confere o grupo da viagem aberta (como o polling de 20 s), e põe quem entrou em Pessoas. */
  async pull() {
    const e = this.entry();
    if (!e) return;
    const { action } = await pullTrip(this.api, e.groupId, this.trip.id);
    if (action) this.do(action);
    this.self();
    this.do(...memberActions(this.trip, this.server.members(e.groupId), this.account.id, newId, this.server.now));
  }
  async sync() {
    await this.pull();
    await this.push();
    await this.pull();
  }
  names() {
    return this.trip.people.map((p) => p.name);
  }
}

function setup() {
  const server = new Server();
  const rebeca = new Phone(server, { id: 'u-reb', name: 'Rebeca Oliveira', photo: null });
  const bia = new Phone(server, { id: 'u-bia', name: 'Bia Souza', photo: null });
  const caio = new Phone(server, { id: 'u-caio', name: 'Caio Lima', photo: null });
  return { server, rebeca, bia, caio };
}

const expense = (payerId: string, people: string[], cents: number, description = 'Mercado') => ({
  description,
  cents,
  date: '2026-12-28',
  category: 'mercado' as const,
  payerId,
  split: 'equal' as const,
  people,
});

describe('convite: cada viagem com o seu link', () => {
  it('criar outra viagem e convidar: o link é o da viagem nova, e a primeira continua no grupo dela', async () => {
    const { server, rebeca, bia, caio } = setup();
    rebeca.do({ type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca' });
    const codeA = rebeca.share();
    await bia.join(codeA);

    rebeca.do({ type: 'createTrip', id: 'B', name: 'Praia', meName: 'Rebeca' });
    expect(rebeca.entry('B')).toBeUndefined(); // ainda não compartilhou: pede "Criar link"
    const codeB = rebeca.share();
    expect(codeB).not.toBe(codeA);
    expect(server.preview(codeB)?.title).toBe('Praia');
    expect(rebeca.entry('A')?.code).toBe(codeA);

    await caio.join(codeB);
    expect(caio.trip.name).toBe('Praia');

    // A Chácara continua sincronizando com a Bia.
    rebeca.do({ type: 'openTrip', id: 'A' }, { type: 'editTrip', name: 'Chácara do Zé' });
    await rebeca.push();
    await bia.pull();
    expect(bia.trip.name).toBe('Chácara do Zé');
  });
});

describe('quem entrou participa da viagem', () => {
  it('Bia entra: aparece em Pessoas nos dois celulares e é "você" no dela', async () => {
    const { rebeca, bia } = setup();
    rebeca.do({ type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca' }, { type: 'addTraveler', id: 'caio', name: 'Caio' });
    const code = rebeca.share();
    await bia.join(code);
    expect(bia.names()).toEqual(['Rebeca', 'Caio', 'Bia']);
    const biaId = bia.trip.people[2].id;
    expect(bia.me).toBe(biaId);
    await bia.push();
    await rebeca.sync();
    expect(rebeca.names()).toEqual(['Rebeca', 'Caio', 'Bia']);
    expect(rebeca.me).toBe(rebeca.trip.people[0].id);
    // A Rebeca (dona) foi ligada à conta dela pelo próprio celular, sem criar outra "Rebeca".
    expect(rebeca.trip.people[0].userId).toBe('u-reb');
    expect(rebeca.trip.log?.some((l) => l.text === 'Bia entrou na viagem' && l.by === 'Bia Souza')).toBe(true);
  });

  it('pode lançar para ela despesas de antes de ela chegar, e as novas já a incluem', async () => {
    const { rebeca, bia } = setup();
    rebeca.do(
      { type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca', meId: 'reb' },
      { type: 'addTraveler', id: 'caio', name: 'Caio' },
      { type: 'addExpense', id: 'e1', input: expense('reb', ['reb', 'caio'], 30000, 'Aluguel') },
    );
    await bia.join(rebeca.share());
    await bia.push();
    await rebeca.sync();
    const biaId = rebeca.trip.people.find((p) => p.userId === 'u-bia')!.id;
    // A Rebeca edita o aluguel (de antes da Bia chegar) para incluir a Bia.
    rebeca.do({ type: 'editExpense', id: 'e1', input: expense('reb', ['reb', 'caio', biaId], 30000, 'Aluguel') });
    await rebeca.push();
    // A Bia lança uma despesa nova, com todo mundo.
    await bia.pull();
    bia.do({ type: 'addExpense', id: 'e2', input: expense(biaId, bia.trip.people.map((p) => p.id), 9000) });
    await bia.push();
    await rebeca.sync();
    const s = tripSummary(rebeca.trip);
    expect(s.ok).toBe(true);
    const row = s.people.find((p) => p.person.id === biaId)!;
    expect(row.owes).toBe(10000 + 3000);
    expect(row.paid).toBe(9000);
    expect(row.balance).toBe(-4000);
    expect(bia.trip).toEqual(rebeca.trip);
  });

  it('"Bia" anotada antes: ao entrar ela escolhe ser essa pessoa (sem duplicar), com as despesas dela', async () => {
    const { rebeca, bia } = setup();
    rebeca.do(
      { type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca', meId: 'reb' },
      { type: 'addTraveler', id: 'bia', name: 'Bia' },
      { type: 'addExpense', id: 'e1', input: expense('reb', ['reb', 'bia'], 20000) },
    );
    await bia.join(rebeca.share(), 'sem resposta');
    expect(bia.asked).toBe(true); // "Quem é você nesta viagem?"
    expect(bia.names()).toEqual(['Rebeca', 'Bia']);
    bia.answer = 'Bia';
    bia.self();
    expect(bia.me).toBe('bia');
    expect(bia.names()).toEqual(['Rebeca', 'Bia']);
    await bia.push();
    await rebeca.sync();
    expect(rebeca.trip.people.find((p) => p.id === 'bia')!.userId).toBe('u-bia');
  });

  it('duas Rebecas diferentes: a que entra pelo link é pessoa nova ("Rebeca O."), e a anotada fica com as despesas dela', async () => {
    const { server } = setup();
    const caio = new Phone(server, { id: 'u-caio', name: 'Caio Lima', photo: null });
    const reb = new Phone(server, { id: 'u-reb2', name: 'Rebeca Oliveira', photo: null });
    caio.do(
      { type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Caio', meId: 'caio' },
      { type: 'addTraveler', id: 'rebeca', name: 'Rebeca' },
      { type: 'addExpense', id: 'e1', input: expense('caio', ['caio', 'rebeca'], 20000) },
    );
    await reb.join(caio.share(), null); // "Sou uma pessoa nova"
    await reb.push();
    await caio.sync();
    expect(caio.names()).toEqual(['Caio', 'Rebeca', 'Rebeca O.']);
    const anotada = caio.trip.people.find((p) => p.id === 'rebeca')!;
    expect(anotada.userId).toBeUndefined();
    expect(tripSummary(caio.trip).people.find((p) => p.person.id === 'rebeca')!.balance).toBe(-10000);
    expect(reb.me).toBe(reb.trip.people.find((p) => p.name === 'Rebeca O.')!.id);
  });

  it('sem responder, os outros esperam 10 minutos; depois a põem como pessoa nova, e ela ainda pode escolher', async () => {
    const { server, rebeca, bia } = setup();
    rebeca.do(
      { type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca', meId: 'reb' },
      { type: 'addTraveler', id: 'bia', name: 'Bia' },
    );
    const code = rebeca.share();
    await bia.join(code, 'sem resposta'); // abriu a pergunta e não respondeu
    await rebeca.sync();
    expect(rebeca.names()).toEqual(['Rebeca', 'Bia']); // ainda esperando
    server.later();
    await rebeca.sync();
    expect(rebeca.names()).toEqual(['Rebeca', 'Bia', 'Bia S.']);
    expect(rebeca.trip.people[2].auto).toBe(true);
    // A Bia volta ao app: a pergunta continua, e ela diz que é a "Bia" anotada.
    await bia.pull();
    expect(bia.asked).toBe(true);
    bia.answer = 'Bia';
    bia.self();
    await bia.push();
    await rebeca.sync();
    expect(rebeca.names()).toEqual(['Rebeca', 'Bia']);
    expect(rebeca.trip.people[1].userId).toBe('u-bia');
    expect(rebeca.trip).toEqual(bia.trip);
  });

  it('entrou com o app antigo (só no grupo): depois de 10 minutos entra como pessoa nova, uma vez só', async () => {
    const { server, rebeca, bia } = setup();
    rebeca.do({ type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca' });
    const code = rebeca.share();
    await bia.api.join(code, 'Bia Souza', null);
    server.later();
    await rebeca.sync();
    expect(rebeca.names()).toEqual(['Rebeca', 'Bia']);
    // A Bia abre a versão nova: ninguém livre para escolher, então confirma a pessoa nova.
    await bia.join(code, 'sem resposta');
    expect(bia.asked).toBe(false);
    await bia.sync();
    await rebeca.sync();
    expect(bia.names()).toEqual(['Rebeca', 'Bia']);
    expect(rebeca.trip.people[1].auto).toBeUndefined();
    expect(rebeca.trip).toEqual(bia.trip);
    expect(bia.me).toBe(bia.trip.people[1].id);
  });

  it('dois celulares põem a mesma pessoa ao mesmo tempo: ela entra uma vez só', async () => {
    const { server, rebeca, caio, bia } = setup();
    rebeca.do({ type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca' });
    const code = rebeca.share();
    await caio.join(code);
    await caio.push();
    await bia.api.join(code, 'Bia Souza', null); // app antigo
    server.later();
    await rebeca.pull();
    await caio.pull();
    expect(rebeca.names()).toContain('Bia');
    expect(caio.names()).toContain('Bia');
    await rebeca.push();
    await caio.push(); // conflito: busca a da Rebeca e refaz por cima (não duplica)
    await rebeca.sync();
    expect(caio.names().filter((n) => n === 'Bia')).toHaveLength(1);
    expect(rebeca.trip).toEqual(caio.trip);
    expect(server.groups.get('g1')!.trip).toEqual(rebeca.trip);
  });

  it('quem foi tirado da viagem não volta sozinho na próxima conferência', async () => {
    const { server, rebeca, bia } = setup();
    rebeca.do({ type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca' });
    await bia.join(rebeca.share());
    await bia.push();
    await rebeca.sync();
    const biaId = rebeca.trip.people.find((p) => p.userId === 'u-bia')!.id;
    rebeca.do({ type: 'removeTraveler', id: biaId });
    server.later();
    await rebeca.sync();
    await bia.sync();
    await rebeca.sync();
    expect(rebeca.names()).toEqual(['Rebeca']);
  });
});

describe('assumir as despesas de outra pessoa (no grupo)', () => {
  it('"Bia" anotada à mão e a conta "Beatriz" entrou separada: Beatriz assume tudo e a "Bia" sai', async () => {
    const { rebeca, server } = setup();
    const beatriz = new Phone(server, { id: 'u-bea', name: 'Beatriz Souza', photo: null });
    rebeca.do(
      { type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca', meId: 'reb' },
      { type: 'addTraveler', id: 'bia', name: 'Bia' },
      { type: 'addExpense', id: 'e1', input: expense('reb', ['reb', 'bia'], 20000) },
      { type: 'addExpense', id: 'e2', input: expense('bia', ['reb', 'bia'], 6000) },
    );
    await beatriz.join(rebeca.share());
    expect(beatriz.names()).toEqual(['Rebeca', 'Bia', 'Beatriz']);
    await beatriz.push();
    await rebeca.sync();
    const before = tripSummary(rebeca.trip).people.find((p) => p.person.id === 'bia')!.balance;
    const beaId = rebeca.trip.people.find((p) => p.userId === 'u-bea')!.id;
    // Na tela: toca na Beatriz → "Assumir despesas de outra pessoa" → Bia, "Tirar Bia da viagem".
    rebeca.do({ type: 'removeTraveler', id: 'bia', to: beaId });
    await rebeca.push();
    await beatriz.pull();
    expect(beatriz.names()).toEqual(['Rebeca', 'Beatriz']);
    const s = tripSummary(beatriz.trip);
    expect(s.ok).toBe(true);
    expect(s.people.find((p) => p.person.id === beaId)!.balance).toBe(before);
    expect(beatriz.me).toBe(beaId);
    // E ninguém é adicionado de novo nas próximas conferências.
    await beatriz.sync();
    await rebeca.sync();
    expect(rebeca.names()).toEqual(['Rebeca', 'Beatriz']);
  });

  it('passar sem tirar: quem passou fica na viagem sem despesas', async () => {
    const { rebeca, bia } = setup();
    rebeca.do(
      { type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca', meId: 'reb' },
      { type: 'addTraveler', id: 'caio', name: 'Caio' },
      { type: 'addExpense', id: 'e1', input: expense('reb', ['reb', 'caio'], 20000) },
    );
    await bia.join(rebeca.share());
    await bia.push();
    await rebeca.sync();
    const biaId = rebeca.trip.people.find((p) => p.userId === 'u-bia')!.id;
    rebeca.do({ type: 'transferTraveler', from: 'caio', to: biaId });
    await rebeca.push();
    await bia.pull();
    expect(bia.names()).toEqual(['Rebeca', 'Caio', 'Bia']);
    expect(bia.trip.expenses[0].shares).toEqual({ reb: 10000, [biaId]: 10000 });
    expect(tripSummary(bia.trip).people.find((p) => p.person.id === 'caio')!.balance).toBe(0);
  });
});

describe('sem internet e brigas de versão', () => {
  it('sem internet a fila espera; quando volta, tudo chega e os dois ficam iguais', async () => {
    const { server, rebeca, bia } = setup();
    rebeca.do({ type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca', meId: 'reb' });
    await bia.join(rebeca.share());
    await bia.push();
    await rebeca.sync();
    server.offline = true;
    const biaId = bia.me!;
    bia.do({ type: 'addExpense', id: 'x1', input: expense(biaId, ['reb', biaId], 5000) });
    rebeca.do({ type: 'addExpense', id: 'x2', input: expense('reb', ['reb', biaId], 7000) });
    await expect(bia.push()).rejects.toThrow('sem internet');
    expect(bia.entry()!.pending).toHaveLength(1);
    server.offline = false;
    await bia.push();
    await rebeca.push(); // conflito com a da Bia: refaz por cima
    await bia.sync();
    await rebeca.sync();
    expect(rebeca.trip.expenses.map((e) => e.id).sort()).toEqual(['x1', 'x2']);
    expect(rebeca.trip).toEqual(bia.trip);
  });

  it('sorteio: três celulares mexendo ao mesmo tempo terminam iguais ao grupo, com as contas fechando', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      let x = seed;
      const r = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
      const { server, rebeca, bia, caio } = setup();
      rebeca.do({ type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca', meId: 'reb' }, { type: 'addTraveler', id: 'lia', name: 'Lia' });
      const code = rebeca.share();
      await bia.join(code);
      await caio.join(code);
      const phones = [rebeca, bia, caio];
      for (let step = 0; step < 25; step++) {
        const p = phones[Math.floor(r() * 3)];
        const people = p.trip.people.map((q) => q.id);
        const pick = () => people[Math.floor(r() * people.length)];
        const k = r();
        if (k < 0.45) {
          const who = people.filter(() => r() > 0.3);
          p.do({ type: 'addExpense', id: `s${seed}e${step}`, input: expense(pick(), who.length ? who : [people[0]], 100 + Math.floor(r() * 50000)) });
        } else if (k < 0.55 && p.trip.expenses.length) {
          p.do({ type: 'deleteExpense', id: p.trip.expenses[Math.floor(r() * p.trip.expenses.length)].id, deleted: true });
        } else if (k < 0.65) {
          const [a, b] = [pick(), pick()];
          if (a !== b) p.do({ type: 'transferTraveler', from: a, to: b });
        } else if (k < 0.75) {
          const [a, b] = [pick(), pick()];
          if (a !== b) p.do({ type: 'settle', id: `s${seed}p${step}`, from: a, to: b, cents: 1 + Math.floor(r() * 5000) });
        } else if (k < 0.85) {
          await p.pull();
        } else {
          await p.push();
        }
      }
      for (const p of phones) await p.sync();
      for (const p of phones) await p.sync();
      const final = server.groups.get('g1')!.trip;
      for (const p of phones) {
        expect(p.trip, `semente ${seed}`).toEqual(final);
        expect(p.entry()!.pending, `semente ${seed}`).toHaveLength(0);
      }
      const s = tripSummary(final);
      expect(s.ok, `semente ${seed}`).toBe(true);
      // Todo mundo do grupo está em Pessoas (ninguém duplicado).
      for (const u of ['u-reb', 'u-bia', 'u-caio']) expect(final.people.filter((q) => q.userId === u), `semente ${seed}`).toHaveLength(1);
    }
  });
});
