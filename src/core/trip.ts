// Viagem: despesas de vários dias, pagas por várias pessoas, com saldo e acerto no final.
// Só cálculo, sem interface nem banco: a mesma lógica serve ao modo solo e ao compartilhado.
//
// Pense num caixa comum: quem paga uma despesa põe dinheiro no caixa, quem participa dela
// tira. No fim, quem pôs mais do que tirou recebe; quem tirou mais do que pôs paga.

import { formatBRL, splitEven, splitWeighted } from './money';
import { minTransfers, type Transfer } from './settle';

export const MAX_TRIP_NAME = 40;
export const MAX_DESCRIPTION = 60;
export const MAX_WEIGHT = 20;

/** Participante: uma pessoa ou uma família inteira ("Família Ana", peso 3,5). */
export interface Traveler {
  id: string;
  name: string;
  /** Índice da cor (0 a 5), as mesmas do Rolê. */
  color: number;
  /** Quanto assume na divisão por peso: 1 = uma pessoa, criança 0,5, família = soma. */
  weight: number;
}

export const TRIP_CATEGORIES = [
  { id: 'hospedagem', label: 'Hospedagem' },
  { id: 'alimentacao', label: 'Alimentação' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'passeios', label: 'Passeios' },
  { id: 'compras', label: 'Compras' },
  { id: 'outros', label: 'Outros' },
] as const;
export type TripCategory = (typeof TRIP_CATEGORIES)[number]['id'];

/** Igual entre os marcados, proporcional ao peso, ou valores exatos de cada um. */
export type SplitMode = 'equal' | 'weight' | 'exact';

/** O que a pessoa preenche ao lançar ou editar uma despesa. */
export interface ExpenseInput {
  description: string;
  cents: number;
  /** Dia da despesa, "AAAA-MM-DD". */
  date: string;
  category: TripCategory;
  payerId: string;
  split: SplitMode;
  /** Quem participa (ids). Quem pagou não precisa estar aqui. */
  people: string[];
  /** Só na divisão por valores exatos: quanto cada um deve, em centavos. */
  exact?: Record<string, number>;
}

export interface Expense extends ExpenseInput {
  id: string;
  /** Ordem de criação: decide quem leva o centavo extra (gira de uma despesa para outra). */
  seq: number;
  /**
   * Quanto cada participante deve, já calculado na hora de salvar. Guardado para que uma
   * mudança futura na regra de arredondamento não altere viagens antigas.
   */
  shares: Record<string, number>;
  createdAt: string;
  updatedAt?: string;
  /** Excluída: sai das contas, mas continua guardada (dá para desfazer). */
  deleted?: boolean;
}

/** Pagamento real entre duas pessoas para diminuir o saldo ("Caio pagou R$ 500,00 para Ana"). */
export interface Settlement extends Transfer {
  id: string;
  /** Quando foi registrado (ISO). */
  at: string;
}

export interface Trip {
  id: string;
  name: string;
  /** Datas opcionais da viagem, "AAAA-MM-DD". */
  start?: string;
  end?: string;
  currency: 'BRL';
  people: Traveler[];
  expenses: Expense[];
  settlements: Settlement[];
  /** Próximo número de ordem de despesa (nunca diminui, nem quando uma é excluída). */
  nextSeq: number;
  /** Nomes de categoria trocados pela pessoa ("Passeios" → "Praia"). */
  categoryNames?: Partial<Record<TripCategory, string>>;
}

export function newTrip(id: string, name: string): Trip {
  return { id, name, currency: 'BRL', people: [], expenses: [], settlements: [], nextSeq: 0 };
}

export function categoryLabel(trip: Trip, id: TripCategory): string {
  return trip.categoryNames?.[id]?.trim() || TRIP_CATEGORIES.find((c) => c.id === id)?.label || 'Outros';
}

/** Peso em centésimos (inteiro), para a divisão por peso ser feita só com inteiros. */
const weightUnits = (w: number) => Math.round(w * 100);

/**
 * Lê o peso digitado: "1", "0,5", "3.5". Aceita de 0 a MAX_WEIGHT, com até 2 casas.
 * Retorna null quando não é um peso válido.
 */
export function parseWeight(input: string): number | null {
  const t = input.trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null;
  const w = Number(t);
  return w <= MAX_WEIGHT ? w : null;
}

/** "0,5", "1", "3,5": o peso como a pessoa escreve. */
export function formatWeight(w: number): string {
  return String(w).replace('.', ',');
}

export type SharesResult = { ok: true; shares: Record<string, number> } | { ok: false; error: string };

/**
 * Calcula quanto cada participante deve numa despesa, ao centavo.
 *
 * - Igual: floor(valor / N) para cada um; os centavos que sobram vão 1 por pessoa, começando
 *   numa posição que gira com a ordem da despesa (`seq`).
 * - Por peso: proporcional ao peso, pelo método do maior resto (empate também gira).
 * - Valores exatos: a soma tem que bater com o valor; se não bater, diz a diferença.
 *
 * Os participantes seguem a ordem da viagem (não a ordem dos toques) para o resultado ser estável.
 */
export function splitExpense(input: ExpenseInput, people: Traveler[], seq: number): SharesResult {
  if (!Number.isSafeInteger(input.cents) || input.cents <= 0) return { ok: false, error: 'Digite o valor da despesa.' };
  if (!people.some((p) => p.id === input.payerId)) return { ok: false, error: 'Escolha quem pagou.' };
  const who = people.filter((p) => input.people.includes(p.id));
  if (who.length === 0) return { ok: false, error: 'Marque quem participa da despesa.' };

  let parts: number[];
  if (input.split === 'equal') {
    parts = splitEven(input.cents, who.length, seq);
  } else if (input.split === 'weight') {
    const split = splitWeighted(input.cents, who.map((p) => weightUnits(p.weight)), seq);
    if (!split) return { ok: false, error: 'Quem participa está com peso 0. Ajuste os pesos ou divida igual.' };
    parts = split;
  } else {
    parts = who.map((p) => input.exact?.[p.id] ?? 0);
    if (parts.some((c) => !Number.isSafeInteger(c) || c < 0)) return { ok: false, error: 'Confira os valores de cada um.' };
    const sum = parts.reduce((a, c) => a + c, 0);
    if (sum !== input.cents) {
      const diff = input.cents - sum;
      return {
        ok: false,
        error: `A soma das partes dá ${formatBRL(sum)}, mas a despesa é de ${formatBRL(input.cents)}: ${
          diff > 0 ? `faltam ${formatBRL(diff)}` : `passou ${formatBRL(-diff)}`
        }.`,
      };
    }
  }
  return { ok: true, shares: Object.fromEntries(who.map((p, k) => [p.id, parts[k]])) };
}

export type TripResult = { ok: true; trip: Trip } | { ok: false; error: string };

/** Lança uma despesa nova (com as partes já calculadas). */
export function addExpense(trip: Trip, input: ExpenseInput, id: string, now: string): TripResult {
  const seq = trip.nextSeq;
  const r = splitExpense(input, trip.people, seq);
  if (!r.ok) return r;
  const expense: Expense = { ...input, id, seq, shares: r.shares, createdAt: now };
  return { ok: true, trip: { ...trip, expenses: [...trip.expenses, expense], nextSeq: seq + 1 } };
}

/** Edita uma despesa e recalcula as partes dela. Acertos já registrados continuam valendo. */
export function updateExpense(trip: Trip, id: string, input: ExpenseInput, now: string): TripResult {
  const old = trip.expenses.find((e) => e.id === id);
  if (!old) return { ok: false, error: 'Essa despesa não existe mais.' };
  const r = splitExpense(input, trip.people, old.seq);
  if (!r.ok) return r;
  const expense: Expense = { ...old, ...input, shares: r.shares, updatedAt: now };
  if (input.split !== 'exact') delete expense.exact;
  return { ok: true, trip: { ...trip, expenses: trip.expenses.map((e) => (e.id === id ? expense : e)) } };
}

/** Exclui (ou desfaz a exclusão de) uma despesa. Ela fica guardada, só sai das contas. */
export function setExpenseDeleted(trip: Trip, id: string, deleted: boolean, now: string): Trip {
  return {
    ...trip,
    expenses: trip.expenses.map((e) => {
      if (e.id !== id) return e;
      const next: Expense = { ...e, updatedAt: now };
      if (deleted) next.deleted = true;
      else delete next.deleted;
      return next;
    }),
  };
}

/** Registra um pagamento real entre duas pessoas (pode ser parcial). */
export function addSettlement(trip: Trip, t: Transfer, id: string, now: string): TripResult {
  if (!Number.isSafeInteger(t.cents) || t.cents <= 0) return { ok: false, error: 'Digite o valor do pagamento.' };
  if (t.from === t.to) return { ok: false, error: 'Escolha duas pessoas diferentes.' };
  const known = (pid: string) => trip.people.some((p) => p.id === pid);
  if (!known(t.from) || !known(t.to)) return { ok: false, error: 'Escolha quem pagou e quem recebeu.' };
  return { ok: true, trip: { ...trip, settlements: [...trip.settlements, { from: t.from, to: t.to, cents: t.cents, id, at: now }] } };
}

export const activeExpenses = (trip: Trip) => trip.expenses.filter((e) => !e.deleted);

/** Onde a pessoa aparece (contando despesas excluídas, que podem voltar). */
export function travelerUsage(trip: Trip, id: string): { expenses: number; settlements: number } {
  return {
    expenses: trip.expenses.filter((e) => e.payerId === id || Object.hasOwn(e.shares, id) || e.people.includes(id)).length,
    settlements: trip.settlements.filter((s) => s.from === id || s.to === id).length,
  };
}

/** Só dá para remover direto quem não aparece em nenhuma despesa nem acerto. */
export function canRemoveTraveler(trip: Trip, id: string): boolean {
  const u = travelerUsage(trip, id);
  return u.expenses === 0 && u.settlements === 0;
}

/** Remove quem não aparece em nada. Quem aparece precisa ser passado para outra pessoa antes. */
export function removeTraveler(trip: Trip, id: string): TripResult {
  if (!canRemoveTraveler(trip, id)) return { ok: false, error: 'Essa pessoa tem despesas. Escolha para quem passar as despesas dela.' };
  return { ok: true, trip: { ...trip, people: trip.people.filter((p) => p.id !== id) } };
}

/**
 * Passa tudo de uma pessoa para outra e a remove: despesas que pagou, partes e acertos.
 * Nenhum valor muda. Se as duas participavam da mesma despesa, as partes se somam e a
 * despesa passa a "valores exatos" (para continuar batendo ao centavo); o mesmo vale para
 * divisão por peso, já que o peso de quem recebe é outro. Acerto entre as duas some.
 */
export function mergeTraveler(trip: Trip, fromId: string, toId: string): TripResult {
  if (fromId === toId || !trip.people.some((p) => p.id === toId) || !trip.people.some((p) => p.id === fromId)) {
    return { ok: false, error: 'Escolha outra pessoa para receber as despesas.' };
  }
  const swap = (pid: string) => (pid === fromId ? toId : pid);
  const expenses = trip.expenses.map((e): Expense => {
    const payerId = swap(e.payerId);
    if (!e.people.includes(fromId) && !Object.hasOwn(e.shares, fromId)) return { ...e, payerId };
    const shares: Record<string, number> = {};
    for (const [pid, c] of Object.entries(e.shares)) shares[swap(pid)] = (shares[swap(pid)] ?? 0) + c;
    const people = [...new Set(e.people.map(swap))];
    const keepRule = e.split === 'equal' && !e.people.includes(toId);
    const next: Expense = { ...e, payerId, people, shares, split: keepRule ? 'equal' : 'exact' };
    if (keepRule) delete next.exact;
    else next.exact = { ...shares };
    return next;
  });
  const settlements = trip.settlements
    .map((s) => ({ ...s, from: swap(s.from), to: swap(s.to) }))
    .filter((s) => s.from !== s.to);
  return { ok: true, trip: { ...trip, people: trip.people.filter((p) => p.id !== fromId), expenses, settlements } };
}

/**
 * Despesa parecida já lançada: mesmo valor no mesmo dia. Serve para o aviso "Bia já lançou
 * R$ 612,40 hoje. Lançar mesmo assim?". Não bloqueia: duas compras iguais acontecem.
 */
export function findDuplicate(trip: Trip, input: Pick<ExpenseInput, 'cents' | 'date'>, ignoreId?: string): Expense | null {
  return activeExpenses(trip).find((e) => e.id !== ignoreId && e.cents === input.cents && e.date === input.date) ?? null;
}

export interface TravelerBalance {
  person: Traveler;
  /** Quanto pagou de despesas (pôs no caixa). */
  paid: number;
  /** Quanto consumiu: a soma das partes dele (tirou do caixa). */
  owes: number;
  /** Acertos que já mandou e que já recebeu. */
  sent: number;
  received: number;
  /** pagou − consumiu + mandou − recebeu. Positivo: recebe. Negativo: paga. */
  balance: number;
}

export interface TripSummary {
  /** Gasto total da viagem (despesas não excluídas). */
  total: number;
  people: TravelerBalance[];
  /** Gasto por categoria, do maior para o menor (só as que têm gasto). */
  byCategory: { category: TripCategory; cents: number }[];
  /** Gasto por dia, em ordem de data. */
  byDay: { date: string; cents: number }[];
  /** Menor número de pagamentos para todos ficarem quites. */
  transfers: Transfer[];
  /**
   * false se alguma conta não fechar ao centavo (nunca deveria acontecer). A tela mostra um
   * aviso em vez de números errados, e `transfers` vem vazio.
   */
  ok: boolean;
}

/** Saldos, totais e acerto mínimo da viagem. */
export function tripSummary(trip: Trip): TripSummary {
  const ids = new Set(trip.people.map((p) => p.id));
  const row = new Map(trip.people.map((p) => [p.id, { person: p, paid: 0, owes: 0, sent: 0, received: 0, balance: 0 }]));
  const byCategory = new Map<TripCategory, number>();
  const byDay = new Map<string, number>();
  let total = 0;
  let ok = true;

  for (const e of activeExpenses(trip)) {
    const entries = Object.entries(e.shares);
    if (entries.reduce((a, [, c]) => a + c, 0) !== e.cents || !ids.has(e.payerId) || entries.some(([pid]) => !ids.has(pid))) {
      ok = false;
      continue;
    }
    total += e.cents;
    row.get(e.payerId)!.paid += e.cents;
    for (const [pid, c] of entries) row.get(pid)!.owes += c;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.cents);
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.cents);
  }
  for (const s of trip.settlements) {
    if (!ids.has(s.from) || !ids.has(s.to) || s.cents <= 0) {
      ok = false;
      continue;
    }
    row.get(s.from)!.sent += s.cents;
    row.get(s.to)!.received += s.cents;
  }

  const people = trip.people.map((p) => {
    const r = row.get(p.id)!;
    return { ...r, balance: r.paid - r.owes + r.sent - r.received };
  });
  // A soma dos saldos é sempre zero: o que entrou no caixa é o que saiu.
  if (people.reduce((a, r) => a + r.balance, 0) !== 0) ok = false;

  const balance = Object.fromEntries(people.map((r) => [r.person.id, r.balance]));
  return {
    total,
    people,
    byCategory: [...byCategory].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents),
    byDay: [...byDay].map(([date, cents]) => ({ date, cents })).sort((a, b) => a.date.localeCompare(b.date)),
    transfers: ok ? minTransfers(balance, trip.people.map((p) => p.id)) : [],
    ok,
  };
}

/**
 * Quem paga a próxima: quem está devendo mais ao caixa. Se cada despesa nova for paga por
 * essa pessoa, os saldos se equilibram durante a viagem e sobra pouco para acertar no fim.
 */
export function nextPayer(summary: TripSummary): TravelerBalance | null {
  let best: TravelerBalance | null = null;
  for (const r of summary.people) if (r.balance < 0 && (!best || r.balance < best.balance)) best = r;
  return best;
}

/** Uma despesa na conta de alguém: quanto daquela despesa entra nessa dívida. */
export interface StatementLine {
  expense: Expense;
  cents: number;
}

/** Tudo o que uma pessoa deve (ou tem a receber de) outra, despesa por despesa. */
export interface PairDebt {
  other: string;
  cents: number;
  lines: StatementLine[];
}

/** A conta detalhada de uma pessoa: de onde sai o saldo dela. */
export interface PersonStatement {
  /** O que ela deve a cada um que pagou despesas das quais ela participou. */
  owesTo: PairDebt[];
  owesTotal: number;
  /** O que cada um deve a ela pelas despesas que ela pagou. */
  owedBy: PairDebt[];
  owedTotal: number;
  /** A parte dela nas despesas que ela mesma pagou: já está paga, não entra no acerto. */
  ownShare: number;
  sent: number;
  received: number;
  /** owedTotal − owesTotal + sent − received. É o mesmo saldo do tripSummary. */
  balance: number;
}

/**
 * A conta de uma pessoa, sem compensar nada: cada despesa paga por outro vira uma dívida
 * com quem pagou, e cada despesa paga por ela vira um crédito com quem participou.
 * O acerto final (tripSummary.transfers) junta tudo isso para fazer menos Pix.
 */
export function personStatement(trip: Trip, id: string): PersonStatement {
  const owes = new Map<string, StatementLine[]>();
  const owed = new Map<string, StatementLine[]>();
  const push = (m: Map<string, StatementLine[]>, k: string, l: StatementLine) => m.set(k, [...(m.get(k) ?? []), l]);
  let ownShare = 0;
  const expenses = [...activeExpenses(trip)].sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);
  for (const e of expenses) {
    if (e.payerId === id) {
      for (const [pid, c] of Object.entries(e.shares)) {
        if (pid === id) ownShare += c;
        else if (c > 0) push(owed, pid, { expense: e, cents: c });
      }
    } else if (Object.hasOwn(e.shares, id) && e.shares[id] > 0) {
      push(owes, e.payerId, { expense: e, cents: e.shares[id] });
    }
  }
  const pairs = (m: Map<string, StatementLine[]>): PairDebt[] =>
    trip.people
      .filter((p) => m.has(p.id))
      .map((p) => {
        const lines = m.get(p.id)!;
        return { other: p.id, cents: lines.reduce((a, l) => a + l.cents, 0), lines };
      });
  const owesTo = pairs(owes);
  const owedBy = pairs(owed);
  const owesTotal = owesTo.reduce((a, d) => a + d.cents, 0);
  const owedTotal = owedBy.reduce((a, d) => a + d.cents, 0);
  const sent = trip.settlements.filter((s) => s.from === id).reduce((a, s) => a + s.cents, 0);
  const received = trip.settlements.filter((s) => s.to === id).reduce((a, s) => a + s.cents, 0);
  return { owesTo, owesTotal, owedBy, owedTotal, ownShare, sent, received, balance: owedTotal - owesTotal + sent - received };
}

const header = (trip: Trip) => `*Racha Conta* - ${trip.name.trim() || 'Viagem'}`;

/** Texto para o WhatsApp com os saldos até agora. */
export function tripBalancesText(trip: Trip, summary: TripSummary): string {
  const lines = summary.people.map(({ person, balance }) =>
    balance > 0
      ? `- ${person.name}: recebe ${formatBRL(balance)}`
      : balance < 0
        ? `- ${person.name}: paga ${formatBRL(-balance)}`
        : `- ${person.name}: está quite`,
  );
  return [header(trip), `Gasto total: ${formatBRL(summary.total)}`, '', 'Saldos até agora:', ...lines].join('\n');
}

/** Texto para o WhatsApp com o acerto final (quem paga quem). */
export function tripSettleText(trip: Trip, summary: TripSummary): string {
  if (summary.transfers.length === 0) return [header(trip), 'Está tudo quite! ✅'].join('\n');
  const name = (id: string) => trip.people.find((p) => p.id === id)?.name ?? '?';
  return [
    header(trip),
    'Para ficar tudo quite:',
    '',
    ...summary.transfers.map((t) => `- ${name(t.from)} paga ${formatBRL(t.cents)} para ${name(t.to)}`),
  ].join('\n');
}
