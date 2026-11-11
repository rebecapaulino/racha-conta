import { beforeEach, describe, expect, it } from 'vitest';
import { expensePhotos, installmentInfo, joinSchedule, personStart, photoFields, splitLike, startOf, startSchedule, tripSettleText, tripSummary, type ExpenseInput } from '../core/trip';
import { blankTrips, isValidTrip, loadTrips, openTrip, reduceAs, saveTrips, todayISO, TRIPS_KEY, tripsReducer, type TripAction, type TripsState } from './tripState';

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

  it('foto da viagem: guarda, troca, tira e recusa nome de arquivo estranho', () => {
    let s = run(base(), { type: 'editTrip', photoId: 'abc123def' });
    expect(trip(s).photoId).toBe('abc123def');
    expect(isValidTrip(trip(s))).toBe(true);
    s = run(s, { type: 'editTrip', name: 'Natal' });
    expect(trip(s).photoId).toBe('abc123def');
    s = run(s, { type: 'editTrip', photoId: '../outro-grupo/x' });
    expect(trip(s).photoId).toBeUndefined();
    expect(isValidTrip({ ...trip(s), photoId: '../x' })).toBe(false);
    s = run(s, { type: 'editTrip', photoId: 'zzz999zzz' });
    s = run(s, { type: 'editTrip', photoId: null });
    expect(trip(s).photoId).toBeUndefined();
    expect(trip(s).log?.slice(-3).map((e) => e.text)).toEqual(['Tirou a foto da viagem', 'Adicionou a foto da viagem', 'Tirou a foto da viagem']);
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

describe('registro de alterações da viagem', () => {
  it('anota o que mudou, com o valor e quem pagou', () => {
    const s0 = run(blankTrips(), { type: 'createTrip', id: 'v', name: 'Praia', meName: 'Rebeca', meId: 'r' }, { type: 'addTraveler', id: 'm', name: 'Mauricio' });
    const input = { description: 'Almoço', cents: 20000, date: '2026-10-14', category: 'alimentacao' as const, payerId: 'm', split: 'equal' as const, people: ['r', 'm'] };
    let s = run(s0, { type: 'addExpense', id: 'e1', input });
    s = run(s, { type: 'editExpense', id: 'e1', input: { ...input, cents: 24000 } });
    s = run(s, { type: 'settle', id: 's1', from: 'r', to: 'm', cents: 12000 });
    s = run(s, { type: 'settleExpense', id: 'e1', settled: true });
    s = run(s, { type: 'deleteExpense', id: 'e1', deleted: true });
    s = run(s, { type: 'editTraveler', id: 'm', name: 'Maurício' });
    s = run(s, { type: 'setMe', id: 'r' });
    expect(openTrip(s)!.log!.map((e) => e.text)).toEqual([
      'Adicionou Mauricio',
      'Lançou Almoço · R$ 200,00, pago por Mauricio',
      'Editou Almoço: R$ 200,00 → R$ 240,00',
      'Rebeca pagou R$ 120,00 para Mauricio',
      'Marcou Almoço: todos pagos',
      'Excluiu Almoço',
      'Renomeou Mauricio para Maurício',
    ]);
    expect(openTrip(s)!.log!.every((e) => e.by === null)).toBe(true);
    expect(isValidTrip(openTrip(s))).toBe(true);
  });

  it('no compartilhado, guarda quem fez', () => {
    const s0 = run(blankTrips(), { type: 'createTrip', id: 'v', name: 'Praia', meName: 'Rebeca', meId: 'r' });
    const s = reduceAs(s0, { type: 'addTraveler', id: 'm', name: 'Mauricio' }, 'Rebeca');
    expect(openTrip(s)!.log!.at(-1)).toMatchObject({ by: 'Rebeca', text: 'Adicionou Mauricio' });
  });
});

describe('viagem compartilhada (fila e versões)', () => {
  const input = (cents: number, over: Partial<ExpenseInput> = {}): ExpenseInput => ({
    description: 'Almoço', cents, date: '2026-10-14', category: 'alimentacao', payerId: 'r', split: 'equal', people: ['r', 'm'], ...over,
  });
  function shared() {
    let s = run(blankTrips(), { type: 'createTrip', id: 'v', name: 'Praia', meName: 'Rebeca', meId: 'r' }, { type: 'addTraveler', id: 'm', name: 'Mauricio' });
    s = run(s, { type: 'setAuthor', name: 'Rebeca' }, { type: 'syncLink', tripId: 'v', groupId: 'g1', code: 'c1', version: 1 });
    return s;
  }

  it('mudança na viagem compartilhada entra na fila, com o nome de quem fez no registro', () => {
    const s = run(shared(), { type: 'addExpense', id: 'e1', input: input(10000) }, { type: 'openTrip', id: null });
    expect(s.sync!.v.pending.map((a) => a.type)).toEqual(['addExpense']);
    expect(s.trips[0].log!.at(-1)).toMatchObject({ by: 'Rebeca', text: 'Lançou Almoço · R$ 100,00, pago por Rebeca' });
  });

  it('viagem só neste aparelho não usa fila nem autor', () => {
    let s = run(blankTrips(), { type: 'setAuthor', name: 'Rebeca' }, { type: 'createTrip', id: 'v', name: 'Praia', meName: 'Rebeca', meId: 'r' });
    s = run(s, { type: 'addTraveler', id: 'm', name: 'Mauricio' });
    expect(s.sync).toBeUndefined();
    expect(trip(s).log!.at(-1)!.by).toBeNull();
  });

  it('salvou: a fila esvazia e a versão sobe', () => {
    let s = run(shared(), { type: 'addExpense', id: 'e1', input: input(10000) });
    const sent = trip(s);
    s = run(s, { type: 'syncSaved', tripId: 'v', version: 2, count: 1, sent });
    expect(s.sync!.v).toMatchObject({ version: 2, pending: [] });
    expect(s.sync!.v.base).toBe(sent);
  });

  it('outra pessoa salvou antes: a versão dela chega e a minha mudança é refeita por cima', () => {
    let s = run(shared(), { type: 'addExpense', id: 'e1', input: input(10000) });
    // Mauricio lançou um mercado (versão 2) enquanto o almoço da Rebeca esperava na fila.
    const theirs = run(
      { trips: [shared().sync!.v.base], openId: 'v', me: {} },
      { type: 'addExpense', id: 'e2', input: input(6000, { description: 'Mercado', payerId: 'm' }) },
    ).trips[0];
    s = run(s, { type: 'syncRemote', tripId: 'v', trip: theirs, version: 2 });
    expect(trip(s).expenses.map((e) => e.description)).toEqual(['Mercado', 'Almoço']);
    expect(s.sync!.v).toMatchObject({ version: 2, pending: [{ type: 'addExpense', id: 'e1' }] });
    // Versão velha (ou repetida) não volta atrás.
    expect(run(s, { type: 'syncRemote', tripId: 'v', trip: shared().sync!.v.base, version: 2 })).toEqual(s);
    // E a conta fecha com as duas despesas: Rebeca pagou 100, Mauricio 60, cada um consumiu 80.
    const bal = Object.fromEntries(tripSummary(trip(s)).people.map((r) => [r.person.id, r.balance]));
    expect(bal).toEqual({ r: 2000, m: -2000 });
  });

  it('entrar pelo convite: a viagem chega, abre e fica ligada ao grupo', () => {
    const t = shared().sync!.v.base;
    const s = run(blankTrips(), { type: 'syncJoin', groupId: 'g1', code: 'c1', version: 5, trip: t, meId: 'm' });
    expect(s.openId).toBe('v');
    expect(s.me).toEqual({ v: 'm' });
    expect(s.sync!.v).toMatchObject({ groupId: 'g1', version: 5, pending: [] });
  });

  it('guarda a fila no aparelho (sem internet, ela espera)', () => {
    const s = run(shared(), { type: 'addExpense', id: 'e1', input: input(10000) });
    saveTrips(s);
    expect(loadTrips().sync!.v.pending).toEqual(s.sync!.v.pending);
    expect(loadTrips().author).toBe('Rebeca');
  });

  it('perdeu o acesso: a viagem fica só neste aparelho', () => {
    const s = run(shared(), { type: 'syncUnlink', tripId: 'v' });
    expect(s.sync).toEqual({});
    expect(trip(s).name).toBe('Praia');
  });
});

describe('nota fiscal na despesa', () => {
  it('guarda a foto da nota na despesa, anota no registro e tira quando a pessoa remove', () => {
    const s0 = run(blankTrips(), { type: 'createTrip', id: 'v', name: 'Praia', meName: 'Rebeca', meId: 'r' });
    const input = { description: 'Mercado', cents: 6000, date: '2026-10-14', category: 'mercado' as const, payerId: 'r', split: 'equal' as const, people: ['r'] };
    let s = run(s0, { type: 'addExpense', id: 'e1', input });
    s = run(s, { type: 'editExpense', id: 'e1', input: { ...input, receipt: 'foto123abc' } });
    expect(trip(s).expenses[0].receipt).toBe('foto123abc');
    expect(trip(s).log!.at(-1)!.text).toBe('Adicionou uma foto em Mercado');
    expect(isValidTrip(trip(s))).toBe(true);
    s = run(s, { type: 'editExpense', id: 'e1', input });
    expect(trip(s).expenses[0].receipt).toBeUndefined();
    expect(trip(s).log!.at(-1)!.text).toBe('Tirou uma foto de Mercado');
    // Id estranho (vindo de outro aparelho) não passa.
    expect(isValidTrip({ ...trip(s), expenses: [{ ...trip(s).expenses[0], receipt: '../x' }] })).toBe(false);
    expect(isValidTrip({ ...trip(s), expenses: [{ ...trip(s).expenses[0], photos: ['../x'] }] })).toBe(false);
  });

  it('várias fotos: anexar não apaga as que já estão; cada uma sai só quando a pessoa tira', () => {
    const s0 = run(blankTrips(), { type: 'createTrip', id: 'v', name: 'Praia', meName: 'Rebeca', meId: 'r' });
    const input = { description: 'Amazon', cents: 15990, date: '2026-10-14', category: 'compras' as const, payerId: 'r', split: 'equal' as const, people: ['r'] };
    let s = run(s0, { type: 'addExpense', id: 'e1', input: { ...input, receipt: 'nota111aaa' } });
    s = run(s, { type: 'addExpensePhoto', id: 'e1', photo: 'print222bbb' });
    s = run(s, { type: 'addExpensePhoto', id: 'e1', photo: 'extrato333c' });
    expect(expensePhotos(trip(s).expenses[0])).toEqual(['nota111aaa', 'print222bbb', 'extrato333c']);
    expect(trip(s).expenses[0].cents).toBe(15990);
    expect(trip(s).log!.at(-1)!.text).toBe('Adicionou uma foto em Amazon');
    expect(isValidTrip(trip(s))).toBe(true);
    // A mesma foto de novo não duplica; id estranho não entra.
    expect(run(s, { type: 'addExpensePhoto', id: 'e1', photo: 'print222bbb' })).toBe(s);
    expect(run(s, { type: 'addExpensePhoto', id: 'e1', photo: '../x' })).toBe(s);
    // Tirar a primeira: a segunda vira a principal (a que versões antigas mostram).
    s = run(s, { type: 'removeExpensePhoto', id: 'e1', photo: 'nota111aaa' });
    expect(trip(s).expenses[0].receipt).toBe('print222bbb');
    expect(trip(s).expenses[0].photos).toEqual(['extrato333c']);
    expect(trip(s).log!.at(-1)!.text).toBe('Tirou uma foto de Amazon');
    // Editar a despesa (valor) mantém as fotos.
    s = run(s, { type: 'editExpense', id: 'e1', input: { ...input, cents: 16990, ...photoFields(expensePhotos(trip(s).expenses[0])) } });
    expect(expensePhotos(trip(s).expenses[0])).toEqual(['print222bbb', 'extrato333c']);
    // Editar só com `photos` (sem `receipt`) arruma: a primeira vira a principal.
    s = run(s, { type: 'editExpense', id: 'e1', input: { ...input, photos: ['print222bbb'] } });
    expect(trip(s).expenses[0].receipt).toBe('print222bbb');
    expect(trip(s).expenses[0].photos).toBeUndefined();
  });
});

describe('Pix na viagem', () => {
  it('editar a pessoa guarda, troca e tira a chave; chave inválida é ignorada', () => {
    let s = run(base(), { type: 'editTraveler', id: 'bia', pix: '52998224725' });
    expect(trip(s).people.find((p) => p.id === 'bia')!.pix).toBe('52998224725');
    s = run(s, { type: 'editTraveler', id: 'bia', pix: 'não é chave' });
    expect(trip(s).people.find((p) => p.id === 'bia')!.pix).toBe('52998224725');
    s = run(s, { type: 'editTraveler', id: 'bia', pix: null });
    expect('pix' in trip(s).people.find((p) => p.id === 'bia')!).toBe(false);
    expect(trip(s).log!.map((e) => e.text)).toEqual(expect.arrayContaining(['Adicionou o Pix de Bia', 'Tirou o Pix de Bia']));
    expect(isValidTrip(trip(run(base(), { type: 'editTraveler', id: 'bia', pix: '52998224725' })))).toBe(true);
  });

  it('o acerto no WhatsApp traz o Pix de quem recebe', async () => {
    const { tripSettleText } = await import('../core/trip');
    const s = run(
      base(),
      { type: 'addExpense', id: 'e1', input: expense() },
      { type: 'editTraveler', id: 'eu', pix: 'rebeca@x.com' },
    );
    const text = tripSettleText(trip(s), tripSummary(trip(s)), 'direct');
    expect(text).toContain('*Pix de quem recebe*\n- Rebeca (e-mail): rebeca@x.com');
  });
});

describe('alguém entra numa despesa parcelada já em andamento', () => {
  // Airbnb de R$ 1.200 em 4x, pago pela Rebeca, dividido com a Bia (R$ 150 por mês cada).
  // Passaram 2 parcelas (a Bia pagou as duas) e o Caio entra.
  const start = () =>
    run(
      base(),
      { type: 'addExpense', id: 'air', input: expense({ cents: 120000, people: ['eu', 'bia'], installments: 4 }) },
      { type: 'settle', id: 's1', from: 'bia', to: 'eu', cents: 15000, expenseId: 'air' },
      { type: 'settle', id: 's2', from: 'bia', to: 'eu', cents: 15000, expenseId: 'air' },
    );
  const old = () => trip(start()).expenses[0];
  const withCaio = expense({ cents: 120000, people: ['eu', 'bia', 'caio'], installments: 4 });
  const row = (s: TripsState, from: string) => tripSummary(trip(s)).plan.direct.find((r) => r.from === from && r.expenseId === 'air')!;

  it('desde o início: o Caio paga as parcelas passadas na próxima, a Bia paga menos; depois todos iguais', () => {
    const schedule = joinSchedule(old(), withCaio, trip(start()).people, 2, 'all')!;
    expect(schedule).toEqual({ eu: [15000, 15000, 0, 10000], bia: [15000, 15000, 0, 10000], caio: [0, 0, 30000, 10000] });
    const s = run(start(), { type: 'editExpense', id: 'air', input: { ...withCaio, schedule } });
    expect(trip(s).expenses[0].shares).toEqual({ eu: 40000, bia: 40000, caio: 40000 });
    // Caio: parcela 3 de 4, de R$ 300 (a parte dele das 2 que passaram + a 3ª).
    const caio = row(s, 'caio');
    expect(installmentInfo(caio.cents, caio.paid, 4, caio.parts)).toMatchObject({ paidCount: 2, next: 30000 });
    // Bia: já pagou o bastante para a 3ª (fica sem pagar este mês) e falta a 4ª, de R$ 100.
    const bia = row(s, 'bia');
    expect(installmentInfo(bia.cents, bia.paid, 4, bia.parts)).toMatchObject({ paidCount: 3, next: 10000 });
    expect(trip(s).log!.at(-1)!.text).toBe('Caio entrou: Mercado · parcelas reajustadas');
  });

  it('redividir o que falta: as parcelas passadas ficam com quem estava; o resto, entre os três', () => {
    const schedule = joinSchedule(old(), withCaio, trip(start()).people, 2, 'rest')!;
    expect(schedule).toEqual({ eu: [15000, 15000, 10000, 10000], bia: [15000, 15000, 10000, 10000], caio: [0, 0, 10000, 10000] });
    const s = run(start(), { type: 'editExpense', id: 'air', input: { ...withCaio, schedule } });
    expect(trip(s).expenses[0].shares).toEqual({ eu: 50000, bia: 50000, caio: 20000 });
    const caio = row(s, 'caio');
    expect(installmentInfo(caio.cents, caio.paid, 4, caio.parts)).toMatchObject({ paidCount: 2, next: 10000 });
    const bia = row(s, 'bia');
    expect(installmentInfo(bia.cents, bia.paid, 4, bia.parts)).toMatchObject({ paidCount: 2, next: 10000 });
  });

  it('as parcelas combinadas ficam ao mudar só o nome; mudar o valor volta às parcelas iguais', () => {
    const schedule = joinSchedule(old(), withCaio, trip(start()).people, 2, 'rest')!;
    let s = run(start(), { type: 'editExpense', id: 'air', input: { ...withCaio, schedule } });
    s = run(s, { type: 'editExpense', id: 'air', input: { ...withCaio, description: 'Casa' } });
    expect(trip(s).expenses[0].schedule).toEqual(schedule);
    s = run(s, { type: 'editExpense', id: 'air', input: { ...withCaio, cents: 150000 } });
    expect(trip(s).expenses[0].schedule).toBeUndefined();
    expect(trip(s).expenses[0].shares).toEqual({ eu: 50000, bia: 50000, caio: 50000 });
  });

  it('sem parcela passada, valores exatos ou parcelas mudadas: não precisa combinar nada', () => {
    const people = trip(start()).people;
    expect(joinSchedule(old(), withCaio, people, 0, 'all')).toBeNull();
    expect(joinSchedule(old(), { ...withCaio, installments: 6 }, people, 2, 'all')).toBeNull();
    // Valores exatos: o que falta é dividido na proporção do valor de cada um.
    expect(joinSchedule(old(), { ...withCaio, split: 'exact', exact: { eu: 40000, bia: 40000, caio: 40000 } }, people, 2, 'rest')).toEqual({
      eu: [15000, 15000, 10000, 10000],
      bia: [15000, 15000, 10000, 10000],
      caio: [0, 0, 10000, 10000],
    });
  });

  it('em qualquer caso, as parcelas fecham o valor da despesa e nenhuma é negativa', () => {
    for (const mode of ['all', 'rest'] as const) {
      for (let k = 1; k < 4; k++) {
        const plan = joinSchedule(old(), withCaio, trip(start()).people, k, mode)!;
        const months = [0, 1, 2, 3].map((m) => Object.values(plan).reduce((a, p) => a + p[m], 0));
        expect(months.reduce((a, c) => a + c, 0)).toBe(120000);
        expect(Object.values(plan).every((p) => p.every((c) => c >= 0))).toBe(true);
      }
    }
  });
});

describe('centavos na viagem', () => {
  it('quem participa de tudo igual fica com a mesma parte no total, quando divide certinho', () => {
    // R$ 100,01 (sobram 2 centavos) e R$ 100,00 (sobra 1): R$ 200,01 = R$ 66,67 para cada um.
    const s = run(
      base(),
      { type: 'addExpense', id: 'a', input: expense({ cents: 10001 }) },
      { type: 'addExpense', id: 'b', input: expense({ cents: 10000, payerId: 'bia' }) },
    );
    expect(tripSummary(trip(s)).people.map((p) => p.owes)).toEqual([6667, 6667, 6667]);
  });

  it('editar uma despesa antiga não tira o equilíbrio das outras', () => {
    let s = run(
      base(),
      { type: 'addExpense', id: 'a', input: expense({ cents: 10001 }) },
      { type: 'addExpense', id: 'b', input: expense({ cents: 10000 }) },
    );
    s = run(s, { type: 'editExpense', id: 'a', input: expense({ cents: 10001, description: 'Feira' }) });
    expect(tripSummary(trip(s)).people.map((p) => p.owes)).toEqual([6667, 6667, 6667]);
  });
});

describe('Deise assume a despesa dos cachorros a partir da 2ª parcela', () => {
  it('a 1ª fica com quem estava; da 2ª em diante, só a Deise paga, e quem saiu não paga mais nada', () => {
    // Cachorros (hotel e ração): R$ 1.000 em 5x, pagos pela Rebeca (eu), divididos com a Bia.
    // A Bia já pagou a 1ª (R$ 100). Da 2ª em diante, quem cuida dos cachorros é a Deise.
    let s = run(
      base(),
      { type: 'addExpense', id: 'dogs', input: expense({ description: 'Cachorros', cents: 100000, people: ['eu', 'bia'], installments: 5 }) },
      { type: 'settle', id: 's1', from: 'bia', to: 'eu', cents: 10000, expenseId: 'dogs' },
      { type: 'addTraveler', id: 'deise', name: 'Deise' },
    );
    const input = expense({ description: 'Cachorros', cents: 100000, people: ['deise'], installments: 5 });
    const old = trip(s).expenses[0];
    // "Desde a 1ª" não vale quando alguém sai.
    expect(joinSchedule(old, input, trip(s).people, 1, 'all')).toBeNull();
    const schedule = joinSchedule(old, input, trip(s).people, 1, 'rest')!;
    expect(schedule).toEqual({
      deise: [0, 20000, 20000, 20000, 20000],
      eu: [10000, 0, 0, 0, 0],
      bia: [10000, 0, 0, 0, 0],
    });
    s = run(s, { type: 'editExpense', id: 'dogs', input: { ...input, schedule } });
    const e = trip(s).expenses[0];
    expect(e.people).toEqual(['deise']);
    expect(e.shares).toEqual({ deise: 80000, eu: 10000, bia: 10000 });
    expect(trip(s).log!.at(-1)!.text).toBe('Deise entrou e Rebeca e Bia saíram: Cachorros · parcelas reajustadas');
    const rows = tripSummary(trip(s)).plan.direct.filter((r) => r.expenseId === 'dogs');
    // Deise: R$ 200 por mês, começando na 2ª.
    const deise = rows.find((r) => r.from === 'deise')!;
    expect(installmentInfo(deise.cents, deise.paid, 5, deise.parts)).toMatchObject({ paidCount: 1, next: 20000 });
    // Bia: já pagou a 1ª, que era a parte dela: não deve mais nada desta despesa.
    expect(rows.find((r) => r.from === 'bia')).toMatchObject({ remaining: 0 });
    // Mudar só o nome mantém as parcelas (e quem saiu continua com a 1ª).
    s = run(s, { type: 'editExpense', id: 'dogs', input: { ...input, description: 'Pets' } });
    expect(trip(s).expenses[0].shares).toEqual({ deise: 80000, eu: 10000, bia: 10000 });
  });

  it('entrar e dividir o Airbnb da 2ª em diante continua funcionando junto', () => {
    let s = run(
      base(),
      { type: 'addExpense', id: 'air', input: expense({ cents: 150000, people: ['eu', 'bia'], installments: 5 }) },
      { type: 'settle', id: 's1', from: 'bia', to: 'eu', cents: 15000, expenseId: 'air' },
      { type: 'addTraveler', id: 'deise', name: 'Deise' },
    );
    const input = expense({ cents: 150000, people: ['eu', 'bia', 'deise'], installments: 5 });
    const schedule = joinSchedule(trip(s).expenses[0], input, trip(s).people, 1, 'rest')!;
    s = run(s, { type: 'editExpense', id: 'air', input: { ...input, schedule } });
    // 1ª: R$ 150 Rebeca + R$ 150 Bia. Faltam R$ 1.200 ÷ 3 = R$ 400 cada, em 4x de R$ 100.
    expect(trip(s).expenses[0].schedule).toEqual({
      eu: [15000, 10000, 10000, 10000, 10000],
      bia: [15000, 10000, 10000, 10000, 10000],
      deise: [0, 10000, 10000, 10000, 10000],
    });
  });
});

describe('despesa nova que começa numa parcela (cachorros a partir da 2ª)', () => {
  // Cachorros: R$ 800 em 5x, pagos pela Rebeca (eu); a Deise é quem cuida e paga, a partir da 2ª.
  const withDeise = () => run(base(), { type: 'addTraveler', id: 'deise', name: 'Deise' });
  const input = expense({ description: 'Cachorros', cents: 80000, people: ['deise'], installments: 5 });

  it('a 1ª fica de fora; a Deise devolve tudo em 4x, da 2ª à 5ª', () => {
    const schedule = startSchedule({ deise: 80000 }, 5, 2)!;
    const s = run(withDeise(), { type: 'addExpense', id: 'dogs', input: { ...input, schedule } });
    const e = trip(s).expenses[0];
    expect(e.schedule).toEqual({ deise: [0, 20000, 20000, 20000, 20000] });
    expect(startOf(e)).toBe(2);
    const row = tripSummary(trip(s)).plan.direct.find((r) => r.expenseId === 'dogs')!;
    expect(installmentInfo(row.cents, row.paid, 5, row.parts)).toMatchObject({ paidCount: 1, next: 20000 });
  });

  it('começar na 1ª não muda nada; voltar para a 1ª depois limpa', () => {
    expect(startSchedule({ deise: 80000 }, 5, 1)).toBeNull();
    let s = run(withDeise(), { type: 'addExpense', id: 'dogs', input: { ...input, schedule: startSchedule({ deise: 80000 }, 5, 3)! } });
    expect(startOf(trip(s).expenses[0])).toBe(3);
    s = run(s, { type: 'editExpense', id: 'dogs', input: { ...input, schedule: {} } });
    expect(trip(s).expenses[0].schedule).toBeUndefined();
    expect(startOf(trip(s).expenses[0])).toBe(1);
  });

  it('dividida entre duas pessoas, cada uma começa na mesma parcela', () => {
    const shares = { deise: 40000, bia: 40000 };
    const s = run(withDeise(), { type: 'addExpense', id: 'dogs', input: { ...input, people: ['deise', 'bia'], schedule: startSchedule(shares, 5, 2)! } });
    expect(trip(s).expenses[0].shares).toEqual(shares);
    expect(trip(s).expenses[0].schedule).toEqual({ deise: [0, 10000, 10000, 10000, 10000], bia: [0, 10000, 10000, 10000, 10000] });
  });
});

describe('viagem "Ano novo - Família": a Deise já estava no Airbnb, mas entrou na 2ª parcela', () => {
  const names = ['Mauricio', 'Natacha', 'Clari', 'João', 'Angela', 'Marcelo', 'Léo', 'Rebeca', 'Robin', 'Leticia'];
  const ids = names.map((n) => n.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''));
  const all = [...ids, 'deise'];
  const air = (people: string[]) => expense({ description: 'Airbnb', cents: 869200, payerId: 'mauricio', people, installments: 5 });

  function today() {
    let s = run(blankTrips(), { type: 'createTrip', id: 't1', name: 'Ano novo - Família' });
    for (const [k, id] of ids.entries()) s = run(s, { type: 'addTraveler', id, name: names[k] });
    s = run(
      s,
      { type: 'addTraveler', id: 'deise', name: 'Deise' },
      { type: 'editTraveler', id: 'clari', coveredBy: 'natacha' },
      { type: 'editTraveler', id: 'leo', coveredBy: 'marcelo' },
      { type: 'addExpense', id: 'air', input: air(ids) },
      // A Deise foi posta no Airbnb desde a 1ª: todo mundo caiu de R$ 173,84 para R$ 158,04.
      { type: 'editExpense', id: 'air', input: air(all) },
    );
    // Pagamentos como estão registrados: uns com o valor antigo (R$ 173,84), outros com o novo (R$ 158,04).
    const pay = (from: string, cents: number, n: number) => {
      for (let i = 0; i < n; i++) s = run(s, { type: 'settle', id: `${from}${i}`, from, to: 'mauricio', cents, expenseId: 'air' });
    };
    pay('rebeca', 17384, 2);
    pay('robin', 17384, 2);
    pay('natacha', 34768, 2);
    pay('joao', 15804, 2);
    pay('leticia', 15804, 2);
    pay('angela', 15804, 2);
    s = run(s, { type: 'settle', id: 'm1', from: 'marcelo', to: 'mauricio', cents: 31608, expenseId: 'air' });
    s = run(s, { type: 'settle', id: 'm2', from: 'marcelo', to: 'mauricio', cents: 31607, expenseId: 'air' });
    return s;
  }
  const next = (s: TripsState, from: string) => {
    const r = tripSummary(trip(s)).plan.direct.find((x) => x.expenseId === 'air' && x.from === from)!;
    return installmentInfo(r.cents, r.paid, 5, r.parts);
  };

  it('reproduz os valores da tela: R$ 126,44 para quem registrou R$ 173,84 e R$ 158,04 para quem registrou R$ 158,04', () => {
    const s = today();
    expect(next(s, 'rebeca')).toMatchObject({ paidCount: 2, next: 12644 });
    expect(next(s, 'leticia')).toMatchObject({ paidCount: 2, next: 15804 });
    expect(next(s, 'deise')).toMatchObject({ paidCount: 0, next: 15804 });
  });

  it('"Alguém entrou depois?" → Deise a partir da 2ª: a 1ª volta a ser R$ 173,84 para os 10 e a Deise vai para a 2/5', () => {
    let s = today();
    const e = trip(s).expenses[0];
    // A despesa como era antes da Deise (o que a tela monta em "Alguém entrou depois?").
    const before = { ...e, people: ids, shares: Object.fromEntries(ids.map((id) => [id, 86920])) };
    delete before.schedule;
    const schedule = joinSchedule(before, air(all), trip(s).people, 1, 'rest')!;
    s = run(s, { type: 'editExpense', id: 'air', input: { ...air(all), schedule } });
    expect(schedule.rebeca[0]).toBe(17384);
    expect(schedule.deise[0]).toBe(0);
    expect(next(s, 'deise')).toMatchObject({ paidCount: 1, next: 15804 });
    // Até a 2ª, cada um devia R$ 173,84 + R$ 158,04 = R$ 331,88. Quem registrou R$ 347,68 pagou
    // R$ 15,80 a mais; quem registrou R$ 316,08, R$ 15,80 a menos.
    expect(next(s, 'rebeca').next).toBe(15804 - 1580);
    // Letícia: ainda faltam R$ 15,80 da 2ª (aparece "Pagar 2/5" de R$ 15,80); depois, a 3ª.
    expect(next(s, 'leticia')).toMatchObject({ paidCount: 1, next: 1580 });
  });
  it('Pessoas → Deise → "Começa a pagar na 2ª de 5": mesmo resultado, direto pela pessoa', () => {
    let s = run(today(), { type: 'startPaying', id: 'deise', expenseId: 'air', from: 2 });
    const e = trip(s).expenses[0];
    expect(personStart(e, 'deise')).toBe(2);
    expect(personStart(e, 'rebeca')).toBe(1);
    expect(e.schedule!.deise[0]).toBe(0);
    for (const id of ids) expect(e.schedule![id][0]).toBe(17384);
    expect(Object.values(e.schedule!).flat().reduce((a, c) => a + c, 0)).toBe(869200);
    expect(next(s, 'deise')).toMatchObject({ paidCount: 1, next: 15804 });
    expect(next(s, 'rebeca').next).toBe(15804 - 1580);
    expect(next(s, 'angela')).toMatchObject({ paidCount: 1, next: 1580 });
    expect(trip(s).log!.at(-1)!.text).toBe('Deise começa a pagar Airbnb na 2ª parcela · parcelas reajustadas');
    // Voltar para a 1ª: parcelas iguais para todos de novo.
    s = run(s, { type: 'startPaying', id: 'deise', expenseId: 'air', from: 1 });
    expect(trip(s).expenses[0].schedule).toBeUndefined();
    expect(personStart(trip(s).expenses[0], 'deise')).toBe(1);
  });
});

describe('despesa à vista cobrada junto com uma parcela (cachorros na 2ª do Airbnb)', () => {
  // Airbnb: R$ 1.000 em 5x, pago pela Rebeca (eu), dividido com a Bia e a Deise, que entrou na 2ª.
  // Hospedagem dos cachorros: R$ 117 à vista, paga pela Rebeca, só da Deise, cobrada na 2ª parcela.
  function setup(installment = 2) {
    let s = run(base(), { type: 'addTraveler', id: 'deise', name: 'Deise' });
    s = run(s, { type: 'addExpense', id: 'air', input: expense({ cents: 100000, people: ['eu', 'bia', 'deise'], installments: 5 }) });
    const air = trip(s).expenses[0];
    const before = { ...air, people: ['eu', 'bia'], shares: { eu: 50000, bia: 50000 } };
    delete before.schedule;
    const schedule = joinSchedule(before, expense({ cents: 100000, people: ['eu', 'bia', 'deise'], installments: 5 }), trip(s).people, 1, 'rest')!;
    s = run(
      s,
      { type: 'editExpense', id: 'air', input: { ...expense({ cents: 100000, people: ['eu', 'bia', 'deise'], installments: 5 }), schedule } },
      { type: 'addExpense', id: 'dogs', input: expense({ description: 'Hospedagem cachorros', cents: 11700, people: ['deise'], alongWith: { expenseId: 'air', installment } }) },
    );
    return s;
  }
  const rowsOf = (s: TripsState) => tripSummary(trip(s)).plan.direct;

  it('a Deise paga a 2ª parcela do Airbnb com os R$ 117 dentro, numa linha só', () => {
    const s = setup();
    const deise = rowsOf(s).filter((r) => r.from === 'deise');
    expect(deise).toHaveLength(1);
    // Airbnb: a 1ª (R$ 200) fica com Rebeca e Bia; as outras 4 entre os três: R$ 266,66 da Deise.
    expect(deise[0]).toMatchObject({ expenseId: 'air', cents: 26666 + 11700 });
    expect(deise[0].along).toEqual([{ expenseId: 'dogs', description: 'Hospedagem cachorros', installment: 2, cents: 11700 }]);
    // 2ª parcela: R$ 66,67 do Airbnb + R$ 117 dos cachorros.
    expect(installmentInfo(deise[0].cents, deise[0].paid, 5, deise[0].parts)).toMatchObject({ paidCount: 1, next: 6667 + 11700 });
    expect(tripSettleText(trip(s), tripSummary(trip(s)), 'direct')).toContain('R$ 183,67 para Rebeca: parcela 2/5 de Mercado + Hospedagem cachorros');
    // O saldo da Deise continua batendo: R$ 266,66 do Airbnb + R$ 117.
    expect(tripSummary(trip(s)).people.find((p) => p.person.id === 'deise')!.balance).toBe(-(26666 + 11700));
  });

  it('na 3ª parcela, os R$ 117 entram na 3ª', () => {
    const r = rowsOf(setup(3)).find((x) => x.from === 'deise')!;
    expect(r.parts).toEqual([0, 6667, 6667 + 11700, 6666, 6666]);
  });

  it('se o Airbnb for excluído, os cachorros voltam a ser cobrados à vista', () => {
    const s = run(setup(), { type: 'deleteExpense', id: 'air', deleted: true });
    expect(rowsOf(s).filter((r) => r.from === 'deise')).toEqual([expect.objectContaining({ cents: 11700, remaining: 11700 })]);
    expect(rowsOf(s).find((r) => r.from === 'deise')!.expenseId).toBeUndefined();
  });

  it('editar e tirar a ligação volta a ser à vista comum', () => {
    let s = setup();
    s = run(s, { type: 'editExpense', id: 'dogs', input: expense({ description: 'Hospedagem cachorros', cents: 11700, people: ['deise'] }) });
    expect(trip(s).expenses.find((e) => e.id === 'dogs')!.alongWith).toBeUndefined();
    expect(rowsOf(s).filter((r) => r.from === 'deise')).toHaveLength(2);
  });
});

describe('Airbnb em "Valores exatos" (depois de "Assumir despesas"): a Deise a partir da 2ª', () => {
  it('a 1ª volta para os outros e, da 2ª em diante, todos são reajustados, a Deise na 2/5', () => {
    let s = run(base(), { type: 'addTraveler', id: 'deise', name: 'Deise' });
    const ids = ['eu', 'bia', 'caio', 'deise'];
    const exact = { eu: 25000, bia: 25000, caio: 25000, deise: 25000 };
    const input = expense({ cents: 100000, people: ids, installments: 5, split: 'exact', exact });
    s = run(s, { type: 'addExpense', id: 'air', input }, { type: 'settle', id: 's1', from: 'bia', to: 'eu', cents: 6667, expenseId: 'air' });
    const e = trip(s).expenses[0];
    // O que a tela monta em "Alguém entrou depois?": a despesa sem a Deise, na proporção dos valores.
    const before = { ...e, people: ['eu', 'bia', 'caio'] };
    const shares = splitLike(before, trip(s).people, e.seq, e.cents)!;
    expect(shares).toEqual({ eu: 33334, bia: 33333, caio: 33333 });
    const schedule = joinSchedule({ ...before, shares }, input, trip(s).people, 1, 'rest')!;
    s = run(s, { type: 'editExpense', id: 'air', input: { ...input, schedule } });
    // 1ª: R$ 200 entre os 3 (R$ 66,67); da 2ª: R$ 800 entre os 4, R$ 50 por parcela.
    expect(schedule.bia).toEqual([6667, 5000, 5000, 5000, 5000]);
    expect(schedule.deise.slice(0, 2)).toEqual([0, 5000]);
    expect(Object.values(schedule).flat().reduce((a, c) => a + c, 0)).toBe(100000);
    const row = (from: string) => tripSummary(trip(s)).plan.direct.find((r) => r.from === from && r.expenseId === 'air')!;
    expect(installmentInfo(row('deise').cents, row('deise').paid, 5, row('deise').parts)).toMatchObject({ paidCount: 1, next: 5000 });
    expect(installmentInfo(row('bia').cents, row('bia').paid, 5, row('bia').parts)).toMatchObject({ paidCount: 1, next: 5000 });
  });
});
