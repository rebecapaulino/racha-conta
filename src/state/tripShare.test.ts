import { beforeEach, describe, expect, it } from 'vitest';
import { blankTrips, isValidTrip, loadTrips, meOf, openTrip, saveTrips, tripsReducer, type TripAction, type TripsState } from './tripState';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
});
beforeEach(() => store.clear());

const run = (s: TripsState, ...actions: TripAction[]) => actions.reduce(tripsReducer, s);

/** Viagem A compartilhada (grupo gA, convite cA), aberta, com Rebeca e Caio. */
function sharedA(): TripsState {
  return run(
    blankTrips(),
    { type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca', meId: 'eu' },
    { type: 'addTraveler', id: 'caio', name: 'Caio' },
    { type: 'setAuthor', name: 'Rebeca Oliveira' },
    { type: 'syncLink', tripId: 'A', groupId: 'gA', code: 'cA', version: 1 },
  );
}

describe('criar e apagar viagem não solta as outras do grupo', () => {
  it('criar uma viagem nova mantém a outra ligada ao grupo (com o código dela) e o autor', () => {
    const s = run(sharedA(), { type: 'createTrip', id: 'B', name: 'Praia', meName: 'Rebeca' });
    expect(s.openId).toBe('B');
    expect(s.sync?.A).toMatchObject({ groupId: 'gA', code: 'cA' });
    expect(s.sync?.B).toBeUndefined();
    expect(s.author).toBe('Rebeca Oliveira');
  });

  it('cada viagem fica com o seu convite: compartilhar a nova não mexe no da outra', () => {
    const s = run(
      sharedA(),
      { type: 'createTrip', id: 'B', name: 'Praia', meName: 'Rebeca' },
      { type: 'syncLink', tripId: 'B', groupId: 'gB', code: 'cB', version: 1 },
    );
    expect(s.sync?.A.code).toBe('cA');
    expect(s.sync?.B.code).toBe('cB');
    // Fecha e abre o app: continua igual.
    saveTrips(s);
    const back = loadTrips();
    expect(back.sync?.A.code).toBe('cA');
    expect(back.sync?.B.code).toBe('cB');
  });

  it('mudança na viagem A continua indo para o grupo dela depois de criar a B', () => {
    let s = run(sharedA(), { type: 'createTrip', id: 'B', name: 'Praia', meName: 'Rebeca' }, { type: 'openTrip', id: 'A' });
    s = run(s, { type: 'addTraveler', id: 'lia', name: 'Lia' });
    expect(s.sync?.A.pending).toHaveLength(1);
  });

  it('apagar uma viagem tira só a ligação dela', () => {
    let s = run(
      sharedA(),
      { type: 'createTrip', id: 'B', name: 'Praia', meName: 'Rebeca' },
      { type: 'syncLink', tripId: 'B', groupId: 'gB', code: 'cB', version: 1 },
      { type: 'deleteTrip', id: 'B' },
    );
    expect(s.sync?.A.code).toBe('cA');
    expect(s.sync?.B).toBeUndefined();
    expect(s.author).toBe('Rebeca Oliveira');
    s = run(s, { type: 'deleteTrip', id: 'A' });
    expect(s.sync).toBeUndefined();
  });

  it('o código que veio do grupo (convite trocado) substitui o guardado', () => {
    const s = sharedA();
    const remote = { ...openTrip(s)!, name: 'Chácara 2' };
    const next = run(s, { type: 'syncRemote', tripId: 'A', trip: remote, version: 2, code: 'cA2' });
    expect(next.sync?.A.code).toBe('cA2');
    expect(openTrip(next)!.name).toBe('Chácara 2');
  });
});

describe('quem entra no grupo aparece em Pessoas', () => {
  it('a conta deste aparelho entra, vira "você", vai para o grupo e entra no registro', () => {
    const s = run(sharedA(), { type: 'joinTraveler', tripId: 'A', userId: 'u-bia', name: 'Beatriz Souza', id: 'b1', self: false });
    const t = openTrip(s)!;
    expect(t.people.map((p) => p.name)).toEqual(['Rebeca', 'Caio', 'Beatriz']);
    expect(s.sync?.A.pending).toHaveLength(1);
    expect(t.log?.at(-1)?.text).toBe('Beatriz entrou na viagem');
    expect(s.me.A).toBe('eu');

    const mine = run(sharedA(), { type: 'joinTraveler', tripId: 'A', userId: 'u-reb', name: 'Rebeca Oliveira', id: 'x', self: true, prefer: 'eu' });
    expect(openTrip(mine)!.people.find((p) => p.id === 'eu')!.userId).toBe('u-reb');
    expect(mine.me.A).toBe('eu');
    expect(openTrip(mine)!.log?.at(-1)?.text).toBe('Rebeca Oliveira entrou no grupo como Rebeca');
  });

  it('entrar pelo convite: "sou eu" é quem a pessoa escolheu, ou a pessoa nova', () => {
    const owner = openTrip(sharedA())!;
    let s = run(
      blankTrips(),
      { type: 'setAuthor', name: 'Caio Lima' },
      { type: 'syncJoin', groupId: 'gA', code: 'cA', version: 3, trip: owner },
      { type: 'joinTraveler', tripId: 'A', userId: 'u-caio', name: 'Caio Lima', id: 'novo', self: true, claim: true, prefer: 'caio' },
    );
    expect(s.me.A).toBe('caio');
    expect(openTrip(s)!.people).toHaveLength(2);
    // Sem escolher: mesmo com um Caio na lista, entra como pessoa nova ("Caio L.").
    const fresh = run(
      blankTrips(),
      { type: 'syncJoin', groupId: 'gA', code: 'cA', version: 3, trip: owner },
      { type: 'joinTraveler', tripId: 'A', userId: 'u-caio', name: 'Caio Lima', id: 'novo', self: true, claim: true },
    );
    expect(openTrip(fresh)!.people.at(-1)).toMatchObject({ id: 'novo', name: 'Caio L.' });
    expect(fresh.me.A).toBe('novo');
    s = run(
      blankTrips(),
      { type: 'syncJoin', groupId: 'gA', code: 'cA', version: 3, trip: owner },
      { type: 'joinTraveler', tripId: 'A', userId: 'u-dani', name: 'Dani', id: 'novo', self: true },
    );
    expect(s.me.A).toBe('novo');
    expect(openTrip(s)!.people.at(-1)).toMatchObject({ id: 'novo', name: 'Dani', userId: 'u-dani' });
    expect(s.sync?.A.pending).toHaveLength(1);
  });

  it('pedido de outra viagem (aberta trocou) é ignorado', () => {
    const s = sharedA();
    expect(run(s, { type: 'joinTraveler', tripId: 'B', userId: 'u', name: 'Zé', id: 'z' })).toBe(s);
  });

  it('repetir não muda nada nem entra na fila de novo', () => {
    const a: TripAction = { type: 'joinTraveler', tripId: 'A', userId: 'u-bia', name: 'Bia', id: 'b1' };
    const once = run(sharedA(), a);
    const twice = run(once, { ...a, id: 'b2' } as TripAction);
    expect(twice).toBe(once);
  });

  it('"você" segue a conta quando a pessoa guardada saiu (juntada a outra)', () => {
    let s = run(sharedA(), { type: 'joinTraveler', tripId: 'A', userId: 'u-reb', name: 'Rebeca', id: 'x', self: true, prefer: 'eu' });
    s = run(s, { type: 'addTraveler', id: 'beca', name: 'Beca' }, { type: 'removeTraveler', id: 'eu', to: 'beca' });
    const t = openTrip(s)!;
    expect(t.people.find((p) => p.id === 'beca')!.userId).toBe('u-reb');
    expect(meOf(s, t, 'u-reb')).toBe('beca');
    // Guardado aponta para quem não existe mais: cai na conta.
    const stale = { ...s, me: { A: 'sumiu' } };
    expect(meOf(stale, t, 'u-reb')).toBe('beca');
    expect(meOf(stale, t, null)).toBeNull();
  });
});

describe('assumir as despesas de outra pessoa (ação)', () => {
  it('passa tudo, mantém quem passou, vai para o grupo e entra no registro', () => {
    let s = run(
      sharedA(),
      { type: 'addTraveler', id: 'bia', name: 'Bia' },
      { type: 'addExpense', id: 'e1', input: { description: 'Mercado', cents: 30000, date: '2026-12-28', category: 'mercado', payerId: 'eu', split: 'equal', people: ['eu', 'caio', 'bia'] } },
      { type: 'joinTraveler', tripId: 'A', userId: 'u-bia', name: 'Beatriz', id: 'bea' },
    );
    s = run(s, { type: 'transferTraveler', from: 'bia', to: 'bea' });
    const t = openTrip(s)!;
    expect(t.expenses[0].shares).toEqual({ eu: 10000, caio: 10000, bea: 10000 });
    expect(t.people.some((p) => p.id === 'bia')).toBe(true);
    expect(t.log?.at(-1)?.text).toBe('Passou para Beatriz as despesas de Bia');
    expect(s.sync?.A.pending.at(-1)).toEqual({ type: 'transferTraveler', from: 'bia', to: 'bea' });
  });

  it('para a mesma pessoa: nada muda', () => {
    const s = sharedA();
    expect(run(s, { type: 'transferTraveler', from: 'caio', to: 'caio' })).toBe(s);
  });
});

describe('dados novos da viagem são aceitos (e os estranhos, não)', () => {
  it('conta ligada à pessoa e lista de quem já entrou', () => {
    const t = openTrip(run(sharedA(), { type: 'joinTraveler', tripId: 'A', userId: 'u-bia', name: 'Bia', id: 'b1' }))!;
    expect(isValidTrip(t)).toBe(true);
    expect(isValidTrip({ ...t, joined: [1] })).toBe(false);
    expect(isValidTrip({ ...t, joined: 'u-bia' })).toBe(false);
    expect(isValidTrip({ ...t, people: [{ ...t.people[0], userId: 5 }] })).toBe(false);
    expect(isValidTrip({ ...t, people: [{ ...t.people[0], auto: true }] })).toBe(true);
    expect(isValidTrip({ ...t, people: [{ ...t.people[0], auto: 'sim' }] })).toBe(false);
  });
});

describe('viagens da conta em qualquer aparelho (syncAdopt)', () => {
  const remote = (id: string, name: string) => openTrip(run(blankTrips(), { type: 'createTrip', id, name, meName: 'Bia', meId: 'bia' }))!;

  it('a viagem de um grupo da conta aparece na lista, ligada ao grupo, sem trocar a aberta', () => {
    const s = run(sharedA(), { type: 'syncAdopt', groups: [{ groupId: 'gB', code: 'cB', version: 4, trip: remote('B', 'Praia') }], hidden: [] });
    expect(s.openId).toBe('A');
    expect(s.trips.map((t) => t.name)).toEqual(['Chácara', 'Praia']);
    expect(s.sync?.B).toMatchObject({ groupId: 'gB', code: 'cB', version: 4, pending: [] });
    // De novo: nada muda.
    const again = run(s, { type: 'syncAdopt', groups: [{ groupId: 'gB', code: 'cB', version: 4, trip: remote('B', 'Praia') }], hidden: [] });
    expect(again.trips).toEqual(s.trips);
  });

  it('a que já está aqui fica em dia (versão mais nova), com a fila deste aparelho por cima', () => {
    let s = run(sharedA(), { type: 'addTraveler', id: 'lia', name: 'Lia' });
    const newer = { ...openTrip(sharedA())!, name: 'Chácara do Zé' };
    s = run(s, { type: 'openTrip', id: null }, { type: 'syncAdopt', groups: [{ groupId: 'gA', code: 'cA', version: 5, trip: newer }], hidden: [] });
    const t = s.trips.find((x) => x.id === 'A')!;
    expect(t.name).toBe('Chácara do Zé');
    expect(t.people.some((p) => p.id === 'lia')).toBe(true);
    expect(s.sync?.A.version).toBe(5);
  });

  it('viagem solta do grupo (com o mesmo id) volta a ficar ligada; ligada a outro grupo, fica como está', () => {
    const solta = run(blankTrips(), { type: 'createTrip', id: 'A', name: 'Chácara', meName: 'Rebeca' });
    const s = run(solta, { type: 'syncAdopt', groups: [{ groupId: 'gA', code: 'cA', version: 2, trip: remote('A', 'Chácara (grupo)') }], hidden: [] });
    expect(s.sync?.A.groupId).toBe('gA');
    expect(s.trips[0].name).toBe('Chácara (grupo)');
    const twice = run(s, { type: 'syncAdopt', groups: [{ groupId: 'gA2', code: 'x', version: 9, trip: remote('A', 'Outra') }], hidden: [] });
    expect(twice.sync?.A.groupId).toBe('gA');
    expect(twice.trips[0].name).toBe('Chácara (grupo)');
  });

  it('excluída pela pessoa (em qualquer aparelho): sai daqui e não volta', () => {
    const s = run(sharedA(), { type: 'syncAdopt', groups: [{ groupId: 'gA', code: 'cA', version: 3, trip: openTrip(sharedA())! }, { groupId: 'gB', code: 'cB', version: 1, trip: remote('B', 'Praia') }], hidden: ['gA', 'gB'] });
    expect(s.trips).toHaveLength(0);
    expect(s.openId).toBeNull();
    expect(s.sync).toBeUndefined();
  });

  it('viagem estragada vinda do grupo é ignorada', () => {
    const bad = { ...remote('B', 'Praia'), currency: 'USD' } as never;
    const s = sharedA();
    expect(run(s, { type: 'syncAdopt', groups: [{ groupId: 'gB', code: 'cB', version: 1, trip: bad }], hidden: [] }).trips).toEqual(s.trips);
  });
});
