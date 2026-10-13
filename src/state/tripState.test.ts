import { beforeEach, describe, expect, it } from 'vitest';
import { tripSummary, type ExpenseInput } from '../core/trip';
import { blankTrips, loadTrips, openTrip, saveTrips, todayISO, TRIPS_KEY, tripsReducer, type TripAction, type TripsState } from './tripState';

// localStorage de mentira (os testes rodam fora do navegador).
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

const run = (s: TripsState, ...actions: TripAction[]) => actions.reduce(tripsReducer, s);
const trip = (s: TripsState) => openTrip(s)!;

function expense(over: Partial<ExpenseInput> = {}): ExpenseInput {
  return { description: 'Mercado', cents: 30000, date: '2026-12-28', category: 'mercado', payerId: 'eu', split: 'equal', people: ['eu', 'bia', 'caio'], ...over };
}

/** Viagem com Rebeca (deste aparelho), Bia e Caio. */
function base(): TripsState {
  return run(
    blankTrips(),
    { type: 'createTrip', id: 't1', name: '  Réveillon   2027 ', start: '2026-12-28', end: 'amanhã', meName: 'Rebeca', meId: 'eu' },
    { type: 'addTraveler', id: 'bia', name: 'Bia' },
    { type: 'addTraveler', id: 'caio', name: ' Caio ', weight: 0.5 },
  );
}

beforeEach(() => store.clear());

describe('viagens no aparelho', () => {
  it('cria a viagem já aberta, com a pessoa do aparelho e cores diferentes', () => {
    const s = base();
    expect(s.openId).toBe('t1');
    expect(s.me).toEqual({ t1: 'eu' });
    const t = trip(s);
    expect(t.name).toBe('Réveillon 2027');
    expect(t.start).toBe('2026-12-28');
    expect(t.end).toBeUndefined();
    expect(t.people.map((p) => [p.name, p.color, p.weight])).toEqual([['Rebeca', 0, 1], ['Bia', 1, 1], ['Caio', 2, 0.5]]);
  });

  it('nome vazio vira "Viagem"; pessoa sem nome não entra', () => {
    const s = run(blankTrips(), { type: 'createTrip', id: 't', name: '   ' }, { type: 'addTraveler', id: 'x', name: '  ' });
    expect(trip(s).name).toBe('Viagem');
    expect(trip(s).people).toHaveLength(0);
    expect(s.me).toEqual({});
  });

  it('peso inválido é ignorado', () => {
    const s = run(base(), { type: 'editTraveler', id: 'bia', weight: -1 }, { type: 'editTraveler', id: 'bia', weight: 0.333 }, { type: 'editTraveler', id: 'bia', weight: 3.5, name: 'Família Bia' });
    expect(trip(s).people[1]).toMatchObject({ name: 'Família Bia', weight: 3.5 });
  });

  it('lança, edita, exclui e desfaz despesa', () => {
    let s = run(base(), { type: 'addExpense', id: 'e1', input: expense({ description: '  Mercado   do dia ' }) });
    expect(trip(s).expenses[0]).toMatchObject({ description: 'Mercado do dia', shares: { eu: 10000, bia: 10000, caio: 10000 } });
    s = run(s, { type: 'editExpense', id: 'e1', input: expense({ cents: 60000, split: 'weight' }) });
    expect(trip(s).expenses[0].shares).toEqual({ eu: 24000, bia: 24000, caio: 12000 });
    s = run(s, { type: 'deleteExpense', id: 'e1', deleted: true });
    expect(tripSummary(trip(s)).total).toBe(0);
    s = run(s, { type: 'deleteExpense', id: 'e1', deleted: false });
    expect(tripSummary(trip(s)).total).toBe(60000);
  });

  it('despesa inválida não muda nada', () => {
    const s = base();
    expect(run(s, { type: 'addExpense', id: 'e1', input: expense({ people: [] }) })).toBe(s);
    expect(run(s, { type: 'addExpense', id: 'e1', input: expense({ split: 'exact', exact: { eu: 1 } }) })).toBe(s);
  });

  it('valores exatos só ficam guardados na divisão exata', () => {
    const s = run(base(), { type: 'addExpense', id: 'e1', input: expense({ split: 'equal', exact: { eu: 30000 } }) });
    expect(trip(s).expenses[0].exact).toBeUndefined();
  });

  it('remover quem tem despesa: bloqueia sem destino, passa as despesas com destino', () => {
    let s = run(base(), { type: 'addExpense', id: 'e1', input: expense() });
    expect(run(s, { type: 'removeTraveler', id: 'caio' })).toBe(s);
    s = run(s, { type: 'removeTraveler', id: 'caio', to: 'bia' });
    expect(trip(s).people.map((p) => p.id)).toEqual(['eu', 'bia']);
    expect(trip(s).expenses[0].shares).toEqual({ eu: 10000, bia: 20000 });
  });

  it('a pessoa do aparelho que sai passa a ser quem recebeu as despesas', () => {
    const s = run(base(), { type: 'addExpense', id: 'e1', input: expense() }, { type: 'removeTraveler', id: 'eu', to: 'bia' });
    expect(s.me).toEqual({ t1: 'bia' });
    const s2 = run(base(), { type: 'removeTraveler', id: 'eu' });
    expect(s2.me).toEqual({});
  });

  it('registra e desfaz acerto', () => {
    let s = run(base(), { type: 'addExpense', id: 'e1', input: expense() }, { type: 'settle', id: 's1', from: 'bia', to: 'eu', cents: 4000 });
    expect(tripSummary(trip(s)).people.find((r) => r.person.id === 'bia')!.balance).toBe(-6000);
    s = run(s, { type: 'unsettle', id: 's1' });
    expect(trip(s).settlements).toEqual([]);
  });

  it('nomes de categoria: guarda só os trocados', () => {
    let s = run(base(), { type: 'editTrip', categoryNames: { passeios: ' Praia ', mercado: 'Mercado', outros: '' } });
    expect(trip(s).categoryNames).toEqual({ passeios: 'Praia' });
    s = run(s, { type: 'editTrip', categoryNames: {}, start: null, name: 'Natal' });
    expect(trip(s).categoryNames).toBeUndefined();
    expect(trip(s).start).toBeUndefined();
    expect(trip(s).name).toBe('Natal');
  });

  it('modo do acerto: guarda "menos Pix"; o padrão (direto) não precisa ser guardado', () => {
    let s = run(base(), { type: 'editTrip', settleMode: 'min' });
    expect(trip(s).settleMode).toBe('min');
    s = run(s, { type: 'editTrip', name: 'Natal' });
    expect(trip(s).settleMode).toBe('min');
    s = run(s, { type: 'editTrip', settleMode: 'direct' });
    expect(trip(s).settleMode).toBeUndefined();
  });

  it('quem paga a parte de outra pessoa: guarda, tira e não deixa fechar círculo', () => {
    let s = run(base(), { type: 'addTraveler', id: 'p1', name: 'Mauricio' });
    s = run(s, { type: 'addTraveler', id: 'p2', name: 'Lara' });
    s = run(s, { type: 'editTraveler', id: 'p2', coveredBy: 'p1' });
    expect(trip(s).people.find((p) => p.id === 'p2')?.coveredBy).toBe('p1');
    s = run(s, { type: 'editTraveler', id: 'p1', coveredBy: 'p2' });
    expect(trip(s).people.find((p) => p.id === 'p1')?.coveredBy).toBeUndefined();
    s = run(s, { type: 'editTraveler', id: 'p2', coveredBy: null });
    expect(trip(s).people.find((p) => p.id === 'p2')?.coveredBy).toBeUndefined();
  });

  it('apagar a viagem aberta volta para a lista', () => {
    const s = run(base(), { type: 'deleteTrip', id: 't1' });
    expect(s).toEqual({ trips: [], openId: null, me: {} });
  });

  it('guarda e lê de volta; viagem estragada fica de fora sem levar as outras', () => {
    const s = run(base(), { type: 'addExpense', id: 'e1', input: expense() }, { type: 'createTrip', id: 't2', name: 'Praia' });
    saveTrips(s);
    expect(loadTrips()).toEqual(s);

    const raw = JSON.parse(store.get(TRIPS_KEY)!);
    raw.trips[1].expenses = [{ id: 'x', cents: -5 }];
    raw.openId = 't1';
    store.set(TRIPS_KEY, JSON.stringify(raw));
    const back = loadTrips();
    expect(back.trips.map((t) => t.id)).toEqual(['t2']);
    expect(back.openId).toBeNull();
    expect(back.me).toEqual({});
  });

  it('dado ilegível começa vazio', () => {
    store.set(TRIPS_KEY, '{oops');
    expect(loadTrips()).toEqual(blankTrips());
  });

  it('hoje no formato da despesa', () => {
    expect(todayISO(new Date(2026, 11, 3))).toBe('2026-12-03');
  });
});
