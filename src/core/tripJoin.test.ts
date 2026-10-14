import { describe, expect, it } from 'vitest';
import {
  addExpense,
  addSettlement,
  joinTraveler,
  mergeTraveler,
  newTrip,
  personStatement,
  transferTraveler,
  travelerUsage,
  tripSummary,
  updateExpense,
  type ExpenseInput,
  type Trip,
} from './trip';

const NOW = '2026-12-28T12:00:00.000Z';

function tripWith(names: string[]): Trip {
  return { ...newTrip('t1', 'Chácara'), people: names.map((name, i) => ({ id: name.toLowerCase(), name, color: i % 6, weight: 1 })) };
}

function input(over: Partial<ExpenseInput> & Pick<ExpenseInput, 'cents' | 'payerId' | 'people'>): ExpenseInput {
  return { description: 'Mercado', date: '2026-12-28', category: 'mercado', split: 'equal', ...over };
}

function add(t: Trip, id: string, over: Parameters<typeof input>[0]): Trip {
  const r = addExpense(t, input(over), id, NOW);
  if (!r.ok) throw new Error(r.error);
  return r.trip;
}

/** A soma dos saldos é zero e cada despesa fecha ao centavo. */
function balanced(t: Trip) {
  const s = tripSummary(t);
  expect(s.ok).toBe(true);
  expect(s.people.reduce((a, p) => a + p.balance, 0)).toBe(0);
  return s;
}

describe('quem entra no grupo participa da viagem', () => {
  it('conta nova sem ninguém com o nome dela: entra como pessoa nova, com o primeiro nome', () => {
    const t = tripWith(['Rebeca', 'Caio']);
    const r = joinTraveler(t, 'u-bia', 'Beatriz Souza', 'novo');
    expect(r.how).toBe('added');
    expect(r.id).toBe('novo');
    expect(r.trip.people.map((p) => p.name)).toEqual(['Rebeca', 'Caio', 'Beatriz']);
    expect(r.trip.people[2]).toMatchObject({ id: 'novo', userId: 'u-bia', weight: 1 });
    expect(r.trip.joined).toEqual(['u-bia']);
    // Cor ainda não usada.
    expect(new Set(r.trip.people.map((p) => p.color)).size).toBe(3);
  });

  it('nome igual NÃO liga sozinho: outra Rebeca entra como "Rebeca O.", e a anotada fica como estava', () => {
    const t = add(tripWith(['Rebeca', 'Caio']), 'e1', { cents: 10000, payerId: 'rebeca', people: ['rebeca', 'caio'] });
    const r = joinTraveler(t, 'u-reb2', 'Rebeca Oliveira', 'novo');
    expect(r.how).toBe('added');
    expect(r.trip.people.map((p) => p.name)).toEqual(['Rebeca', 'Caio', 'Rebeca O.']);
    expect(r.trip.people[0].userId).toBeUndefined();
    expect(personStatement(r.trip, 'rebeca').owedTotal).toBe(5000);
  });

  it('quem entra escolheu ser a pessoa anotada: liga a ela, com as despesas dela', () => {
    const t = add(tripWith(['Rebeca', 'Bia']), 'e1', { cents: 10000, payerId: 'rebeca', people: ['rebeca', 'bia'] });
    const r = joinTraveler(t, 'u-bia', 'Beatriz Souza', 'novo', 'bia');
    expect(r.how).toBe('linked');
    expect(r.id).toBe('bia');
    expect(r.trip.people).toHaveLength(2);
    expect(r.trip.people[1].userId).toBe('u-bia');
    expect(personStatement(r.trip, 'bia').owesTotal).toBe(5000);
  });

  it('nome repetido: primeiro nome, depois a inicial do sobrenome, depois o nome inteiro', () => {
    const t: Trip = { ...tripWith([]), people: [{ id: 'a1', name: 'Ana', color: 0, weight: 1 }, { id: 'a2', name: 'Ana P.', color: 1, weight: 1 }] };
    expect(joinTraveler(t, 'u1', 'Ana Paula', 'n').trip.people.at(-1)!.name).toBe('Ana Paula');
    expect(joinTraveler(tripWith(['Ana']), 'u1', 'ana paula', 'n').trip.people.at(-1)!.name).toBe('ana P.');
    expect(joinTraveler(tripWith(['Rebeca']), 'u1', 'Dani', 'n').trip.people.at(-1)!.name).toBe('Dani');
  });

  it('escolher alguém que já é de outra conta não vale: entra como pessoa nova', () => {
    const t = joinTraveler(tripWith(['Rebeca', 'Bia']), 'u-bia1', 'Bia', 'x', 'bia').trip;
    const r = joinTraveler(t, 'u-bia2', 'Bia Lima', 'novo', 'bia');
    expect(r.how).toBe('added');
    expect(r.trip.people.find((p) => p.id === 'bia')!.userId).toBe('u-bia1');
    expect(r.trip.people.find((p) => p.id === 'novo')!.name).toBe('Bia L.');
  });

  it('outro aparelho já a pôs como pessoa nova: a escolha dela ainda vale (se a nova não tem nada)', () => {
    const auto = joinTraveler(tripWith(['Rebeca', 'Bia']), 'u-bia', 'Bia Souza', 'n1', undefined, false, true);
    expect(auto.trip.people.find((p) => p.id === 'n1')).toMatchObject({ name: 'Bia S.', auto: true });
    // Sem ser a própria pessoa (claim), não muda.
    expect(joinTraveler(auto.trip, 'u-bia', 'Bia Souza', 'n2', 'bia').how).toBe('already');
    const chosen = joinTraveler(auto.trip, 'u-bia', 'Bia Souza', 'n2', 'bia', true);
    expect(chosen.id).toBe('bia');
    expect(chosen.trip.people.map((p) => p.id)).toEqual(['rebeca', 'bia']);
    expect(chosen.trip.people[1].userId).toBe('u-bia');
  });

  it('a pessoa nova posta por outro já tem despesa: a escolha não troca; "pessoa nova" só confirma', () => {
    let t = joinTraveler(tripWith(['Rebeca', 'Bia']), 'u-bia', 'Bia Souza', 'n1', undefined, false, true).trip;
    t = add(t, 'e1', { cents: 1000, payerId: 'n1', people: ['n1', 'rebeca'] });
    const r = joinTraveler(t, 'u-bia', 'Bia Souza', 'n2', 'bia', true);
    expect(r.id).toBe('n1');
    expect(r.trip.people.find((p) => p.id === 'n1')!.auto).toBeUndefined();
    expect(r.trip.people.find((p) => p.id === 'bia')!.userId).toBeUndefined();
  });

  it('é uma vez só: chamar de novo não muda nada (dois aparelhos fazendo ao mesmo tempo)', () => {
    const once = joinTraveler(tripWith(['Rebeca']), 'u-bia', 'Bia', 'n1').trip;
    const twice = joinTraveler(once, 'u-bia', 'Bia', 'n2');
    expect(twice.trip).toBe(once);
    expect(twice.how).toBe('already');
    expect(twice.id).toBe('n1');
  });

  it('quem foi tirado da viagem depois de entrar não volta sozinho', () => {
    const joined = joinTraveler(tripWith(['Rebeca']), 'u-bia', 'Bia', 'n1').trip;
    const removed: Trip = { ...joined, people: joined.people.filter((p) => p.id !== 'n1') };
    const again = joinTraveler(removed, 'u-bia', 'Bia', 'n2');
    expect(again.trip).toBe(removed);
    expect(again.id).toBeNull();
  });

  it('quem chegou depois pode entrar nas despesas de antes (editar) e nas novas', () => {
    let t = add(tripWith(['Rebeca', 'Caio']), 'e1', { cents: 30000, payerId: 'rebeca', people: ['rebeca', 'caio'] });
    t = joinTraveler(t, 'u-bia', 'Bia', 'bia').trip;
    // A despesa de antes continua só com quem estava…
    expect(personStatement(t, 'bia').owesTotal).toBe(0);
    // …até alguém marcar a Bia nela.
    const r = updateExpense(t, 'e1', input({ cents: 30000, payerId: 'rebeca', people: ['rebeca', 'caio', 'bia'] }), NOW);
    if (!r.ok) throw new Error(r.error);
    t = add(r.trip, 'e2', { cents: 9000, payerId: 'bia', people: ['rebeca', 'caio', 'bia'] });
    const s = balanced(t);
    const bia = s.people.find((p) => p.person.id === 'bia')!;
    expect(bia.owes).toBe(10000 + 3000);
    expect(bia.paid).toBe(9000);
    expect(bia.balance).toBe(9000 - 13000);
  });
});

describe('assumir as despesas de outra pessoa', () => {
  /** Rebeca e "Bia" (anotada à mão), com despesas, acerto e alguém pago por ela. */
  function placeholder(): Trip {
    let t = tripWith(['Rebeca', 'Bia', 'Caio', 'Lara']);
    t = { ...t, people: t.people.map((p) => (p.id === 'lara' ? { ...p, coveredBy: 'bia' } : p)) };
    t = add(t, 'e1', { cents: 40000, payerId: 'rebeca', people: ['rebeca', 'bia', 'caio', 'lara'] });
    t = add(t, 'e2', { cents: 12000, payerId: 'bia', people: ['rebeca', 'bia', 'caio'] });
    const s = addSettlement(t, { from: 'caio', to: 'bia', cents: 1000 }, 's1', NOW);
    if (!s.ok) throw new Error(s.error);
    return joinTraveler(s.trip, 'u-bia', 'Beatriz', 'beatriz').trip;
  }

  it('passar sem tirar: tudo vai para quem assume, quem passou fica sem nada, e os saldos fecham', () => {
    const t = placeholder();
    const before = tripSummary(t);
    const r = transferTraveler(t, 'bia', 'beatriz');
    if (!r.ok) throw new Error(r.error);
    expect(r.trip.people.some((p) => p.id === 'bia')).toBe(true);
    expect(travelerUsage(r.trip, 'bia')).toEqual({ expenses: 0, settlements: 0 });
    const after = balanced(r.trip);
    const old = before.people.find((p) => p.person.id === 'bia')!;
    const now = after.people.find((p) => p.person.id === 'beatriz')!;
    expect(now.balance).toBe(old.balance);
    expect(now.paid).toBe(old.paid);
    expect(after.total).toBe(before.total);
    // Quem a Bia pagava a parte (Lara) passa a ter a parte paga por quem assumiu.
    expect(r.trip.people.find((p) => p.id === 'lara')!.coveredBy).toBe('beatriz');
  });

  it('passar e tirar (juntar): a conta do grupo de quem saiu passa para quem ficou sem conta', () => {
    const t = tripWith(['Rebeca', 'Bia']);
    const linked = joinTraveler(t, 'u-bia', 'Bia', 'x', 'bia').trip; // a "Bia" virou a conta
    const withNew: Trip = { ...linked, people: [...linked.people, { id: 'beatriz', name: 'Beatriz', color: 3, weight: 1 }] };
    const r = mergeTraveler(withNew, 'bia', 'beatriz');
    if (!r.ok) throw new Error(r.error);
    expect(r.trip.people.find((p) => p.id === 'beatriz')!.userId).toBe('u-bia');
    // E ela não é adicionada de novo.
    expect(joinTraveler(r.trip, 'u-bia', 'Bia', 'n2').how).toBe('already');
  });

  it('juntar não tira a conta de quem já tinha uma', () => {
    let t = joinTraveler(tripWith(['Rebeca', 'Bia', 'Caio']), 'u-bia', 'Bia', 'x', 'bia').trip;
    t = joinTraveler(t, 'u-caio', 'Caio', 'y', 'caio').trip;
    const r = mergeTraveler(t, 'bia', 'caio');
    if (!r.ok) throw new Error(r.error);
    expect(r.trip.people.find((p) => p.id === 'caio')!.userId).toBe('u-caio');
  });

  it('não passa para a mesma pessoa nem de/para quem não existe', () => {
    const t = tripWith(['Rebeca', 'Bia']);
    expect(transferTraveler(t, 'bia', 'bia').ok).toBe(false);
    expect(transferTraveler(t, 'bia', 'zé').ok).toBe(false);
    expect(transferTraveler(t, 'zé', 'bia').ok).toBe(false);
  });

  it('quem assume pagava a parte de quem passou: o "paga a parte" some (não paga a si mesma)', () => {
    let t = tripWith(['Rebeca', 'Bia', 'Beatriz']);
    t = { ...t, people: t.people.map((p) => (p.id === 'beatriz' ? { ...p, coveredBy: 'bia' } : p)) };
    t = add(t, 'e1', { cents: 9000, payerId: 'rebeca', people: ['rebeca', 'bia', 'beatriz'] });
    const r = transferTraveler(t, 'bia', 'beatriz');
    if (!r.ok) throw new Error(r.error);
    expect(r.trip.people.find((p) => p.id === 'beatriz')!.coveredBy).toBeUndefined();
    balanced(r.trip);
  });

  it('sorteio: passar de qualquer um para qualquer um nunca muda o total nem desequilibra', () => {
    let seed = 7;
    const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let round = 0; round < 200; round++) {
      const names = ['Ana', 'Bia', 'Caio', 'Dani', 'Edu'];
      let t = tripWith(names);
      const ids = t.people.map((p) => p.id);
      for (let k = 0; k < 6; k++) {
        const people = ids.filter(() => r() > 0.4);
        if (!people.length) people.push(ids[0]);
        const cents = 100 + Math.floor(r() * 90000);
        const res = addExpense(t, input({ cents, payerId: ids[Math.floor(r() * ids.length)], people, split: r() > 0.5 ? 'equal' : 'weight' }), 'e' + k, NOW);
        if (res.ok) t = res.trip;
      }
      const from = ids[Math.floor(r() * ids.length)];
      const to = ids.filter((x) => x !== from)[Math.floor(r() * (ids.length - 1))];
      const before = tripSummary(t);
      const moved = transferTraveler(t, from, to);
      if (!moved.ok) throw new Error(moved.error);
      const after = balanced(moved.trip);
      expect(after.total).toBe(before.total);
      const bal = (s: typeof before, id: string) => s.people.find((p) => p.person.id === id)!.balance;
      expect(bal(after, to)).toBe(bal(before, to) + bal(before, from));
      expect(bal(after, from)).toBe(0);
    }
  });
});
