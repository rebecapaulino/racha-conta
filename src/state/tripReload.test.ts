import { describe, expect, it } from 'vitest';
import { blankTrips, isValidTrip, loadTrips, saveTrips, tripsReducer, type TripAction, type TripsState } from './tripState';

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

// Sorteio repetível (a mesma "pessoa" faz sempre as mesmas coisas).
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

/** Uma ação qualquer que alguém poderia fazer na tela. */
function randomAction(s: TripsState, r: () => number, n: number): TripAction {
  const t = s.trips.find((x) => x.id === s.openId)!;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const ids = t.people.map((p) => p.id);
  const live = t.expenses.filter((e) => !e.deleted);
  const someone = () => pick(ids);
  const group = () => ids.filter(() => r() > 0.3).concat(ids[0]).filter((v, i, a) => a.indexOf(v) === i);
  const input = () => {
    const people = group();
    const cents = 100 + Math.floor(r() * 50000);
    const split = r() > 0.7 ? 'exact' : 'equal';
    const exact = split === 'exact' ? Object.fromEntries(people.map((p, i) => [p, i === 0 ? cents - (people.length - 1) * 50 : 50])) : undefined;
    const cover = r() > 0.7 && people.length > 1 ? { [people[1]]: people[0] } : undefined;
    return {
      description: pick(['Mercado', 'Almoço', '  Posto ', '']), cents, date: '2026-10-1' + Math.floor(r() * 9),
      category: pick(['mercado', 'passeios', 'outros', 'hospedagem', 'transporte', 'alimentacao'] as const),
      payerId: someone(), split, people, ...(exact ? { exact } : {}),
      ...(r() > 0.8 ? { installments: 2 + Math.floor(r() * 5) } : {}),
      ...(cover ? { coveredBy: cover } : {}),
      ...(r() > 0.8 ? { receipt: 'nota' + n + 'abc' } : {}),
    } as never;
  };
  const kind = Math.floor(r() * 12);
  switch (kind) {
    case 0: return { type: 'addTraveler', id: 'p' + n, name: pick(['Ana', 'Bia', 'Caio', 'Ana']) };
    case 1: return { type: 'editTraveler', id: someone(), name: pick(['Zé', 'Lia']), ...(r() > 0.5 ? { coveredBy: r() > 0.5 ? someone() : null } : {}) };
    case 2: return ids.length > 2 ? { type: 'removeTraveler', id: ids[ids.length - 1], ...(r() > 0.5 ? { to: ids[0] } : {}) } : { type: 'addTraveler', id: 'q' + n, name: 'Dani' };
    case 3: case 4: return { type: 'addExpense', id: 'e' + n, input: input() };
    case 5: return live.length ? { type: 'editExpense', id: pick(live).id, input: input() } : { type: 'addExpense', id: 'e' + n, input: input() };
    case 6: return live.length ? { type: 'deleteExpense', id: pick(live).id, deleted: true } : { type: 'editTrip', name: 'Praia' };
    case 7: return live.length ? { type: 'settleExpense', id: pick(live).id, settled: r() > 0.3 } : { type: 'editTrip', name: 'Serra' };
    case 8: { const e = live.length ? pick(live) : null; return { type: 'settle', id: 's' + n, from: someone(), to: someone(), cents: 1 + Math.floor(r() * 9000), ...(e && r() > 0.5 ? { expenseId: e.id } : {}) }; }
    case 9: return t.settlements.length ? { type: 'unsettle', id: pick(t.settlements).id } : { type: 'editTrip', settleMode: 'min' };
    case 10: return { type: 'editTrip', ...(r() > 0.5 ? { photoId: r() > 0.3 ? 'foto' + n + 'abcd' : null } : { start: '2026-10-10', end: r() > 0.5 ? '2026-10-20' : null, categoryNames: { passeios: 'Praia' } }) };
    default: return { type: 'deleteExpense', id: live.length ? pick(live).id : 'nada', deleted: false };
  }
}

describe('viagem compartilhada sobrevive a fechar e abrir o app', () => {
  it('qualquer sequência de ações: a viagem continua válida e ligada ao grupo', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      let s = [
        { type: 'createTrip', id: 't1', name: 'Chácara', meName: 'Rebeca', meId: 'eu' },
        { type: 'addTraveler', id: 'bia', name: 'Bia' },
        { type: 'addTraveler', id: 'caio', name: 'Caio' },
        { type: 'setAuthor', name: 'Rebeca' },
        { type: 'syncLink', tripId: 't1', groupId: 'g1', code: 'c1', version: 1 },
      ].reduce((acc, a) => tripsReducer(acc, a as TripAction), blankTrips());
      for (let n = 0; n < 40; n++) {
        const a = randomAction(s, r, n);
        s = tripsReducer(s, a);
        const t = s.trips[0];
        if (!isValidTrip(t)) throw new Error(`semente ${seed}, passo ${n}: ${JSON.stringify(a)} deixou a viagem inválida`);
        // Às vezes o grupo confirma o que foi enviado (vira a base).
        if (r() > 0.6) s = tripsReducer(s, { type: 'syncSaved', tripId: 't1', version: s.sync!.t1.version + 1, count: s.sync!.t1.pending.length, sent: t });
      }
      saveTrips(s);
      const back = loadTrips();
      expect(back.trips).toHaveLength(1);
      expect(back.sync?.t1?.groupId, `semente ${seed}`).toBe('g1');
    }
  });
});
