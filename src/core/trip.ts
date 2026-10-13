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
  /**
   * Quem acerta a parte desta pessoa (o pai que paga a da filha, o Robin que paga a da
   * Rebeca). As despesas continuam no nome dela; só no acerto a conta entra na de quem paga.
   */
  coveredBy?: string;
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
  /** Como mostrar o acerto. Sem valor: 'direct'. */
  settleMode?: SettleMode;
}

/**
 * 'direct': cada um paga para quem pagou as despesas dele (só a diferença entre duas pessoas).
 * 'min': o app junta tudo e faz o menor número de Pix (o dinheiro pode ir para outra pessoa).
 */
export type SettleMode = 'direct' | 'min';

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
  return { ok: true, trip: { ...trip, people: cleanCoverage(trip.people.filter((p) => p.id !== id)) } };
}

/** Tira "quem paga por ela" que aponta para quem saiu ou que fecharia um círculo. */
function cleanCoverage(people: Traveler[]): Traveler[] {
  let out = people;
  for (const p of people) {
    if (p.coveredBy === undefined) continue;
    const others = out.map((x) => (x.id === p.id ? { ...x, coveredBy: undefined } : x));
    if (!canCover({ people: others } as Trip, p.id, p.coveredBy)) {
      out = out.map((x) => {
        if (x.id !== p.id) return x;
        const next = { ...x };
        delete next.coveredBy;
        return next;
      });
    }
  }
  return out;
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
  const people = cleanCoverage(
    trip.people.filter((p) => p.id !== fromId).map((p) => (p.coveredBy === fromId ? { ...p, coveredBy: toId } : p)),
  );
  return { ok: true, trip: { ...trip, people, expenses, settlements } };
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

/** Um pagamento do acerto, com quanto já foi pago dele. Pago não some: fica marcado. */
export interface SettleRow extends Transfer {
  /** Quanto já foi registrado como pago deste pagamento. */
  paid: number;
  /** Quanto ainda falta (cents − paid). Zero: está pago. */
  remaining: number;
}

export interface TripSummary {
  /** Gasto total da viagem (despesas não excluídas). */
  total: number;
  people: TravelerBalance[];
  /** Gasto por categoria, do maior para o menor (só as que têm gasto). */
  byCategory: { category: TripCategory; cents: number }[];
  /** Gasto por dia, em ordem de data. */
  byDay: { date: string; cents: number }[];
  /** O que ainda falta pagar, com o menor número de Pix. */
  transfers: Transfer[];
  /** O que ainda falta pagar, cada um direto para quem pagou as despesas dele. */
  direct: Transfer[];
  /** Os pagamentos de cada modo, inclusive os já pagos (para a tela marcar em verde). */
  plan: Record<SettleMode, SettleRow[]>;
  /**
   * false se alguma conta não fechar ao centavo (nunca deveria acontecer). A tela mostra um
   * aviso em vez de números errados, e `transfers` vem vazio.
   */
  ok: boolean;
}

/**
 * De quem é a conta no acerto: segue "quem paga por ela" até chegar em alguém que paga a
 * própria parte (Rebeca → Robin). Sem ninguém, a conta é da própria pessoa.
 */
export function accountOf(trip: Trip, id: string): string {
  const byId = new Map(trip.people.map((p) => [p.id, p]));
  const seen = new Set([id]);
  let cur = id;
  for (;;) {
    const next = byId.get(cur)?.coveredBy;
    if (!next || !byId.has(next) || seen.has(next)) return cur;
    seen.add(next);
    cur = next;
  }
}

/** Quem tem a conta junto com `id` no acerto (a filha na conta do pai), sem contar a própria. */
export function accountMembers(trip: Trip, id: string): Traveler[] {
  return trip.people.filter((p) => p.id !== id && accountOf(trip, p.id) === id);
}

/** Dá para `by` pagar a parte de `id`? Não pode ser a mesma pessoa nem fechar um círculo. */
export function canCover(trip: Trip, id: string, by: string): boolean {
  if (id === by || !trip.people.some((p) => p.id === by)) return false;
  const byId = new Map(trip.people.map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (let cur: string | undefined = by; cur && byId.has(cur) && !seen.has(cur); cur = byId.get(cur)?.coveredBy) {
    if (cur === id) return false;
    seen.add(cur);
  }
  return true;
}

/** Nome da conta no acerto: "Robin (com Rebeca)". */
export function accountName(trip: Trip, id: string): string {
  const name = trip.people.find((p) => p.id === id)?.name ?? '?';
  const with_ = accountMembers(trip, id).map((p) => p.name);
  return with_.length ? `${name} (com ${with_.join(', ')})` : name;
}

/** Saldos, totais e acerto da viagem. */
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

  const plan: Record<SettleMode, SettleRow[]> = ok ? settlePlans(trip, people) : { direct: [], min: [] };
  const open = (rows: SettleRow[]) => rows.filter((r) => r.remaining > 0).map((r) => ({ from: r.from, to: r.to, cents: r.remaining }));
  return {
    total,
    people,
    byCategory: [...byCategory].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents),
    byDay: [...byDay].map(([date, cents]) => ({ date, cents })).sort((a, b) => a.date.localeCompare(b.date)),
    transfers: open(plan.min),
    direct: open(plan.direct),
    plan,
    ok,
  };
}

/**
 * O acerto de cada modo, calculado só com as despesas (assim um pagamento feito não muda
 * a lista: a linha fica marcada como paga). Depois cada pagamento registrado abate da linha
 * da mesma dupla. Se sobrar diferença (pagou a mais, ou para outra pessoa), entram linhas
 * de ajuste, para o que falta pagar continuar fechando ao centavo com os saldos.
 */
function settlePlans(trip: Trip, people: TravelerBalance[]): Record<SettleMode, SettleRow[]> {
  const acc = new Map(trip.people.map((p) => [p.id, accountOf(trip, p.id)]));
  const roots = trip.people.map((p) => p.id).filter((id) => acc.get(id) === id);
  const base: Record<string, number> = Object.fromEntries(roots.map((id) => [id, 0]));
  const now: Record<string, number> = { ...base };
  for (const r of people) {
    const a = acc.get(r.person.id)!;
    base[a] += r.paid - r.owes;
    now[a] += r.balance;
  }
  return {
    min: reconcile(minTransfers(base, roots), trip, acc, roots, now),
    direct: reconcile(directTransfers(trip, false), trip, acc, roots, now),
  };
}

function reconcile(plan: Transfer[], trip: Trip, acc: Map<string, string>, roots: string[], now: Record<string, number>): SettleRow[] {
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const paidPair = new Map<string, number>();
  for (const s of trip.settlements) {
    const [f, t] = [acc.get(s.from), acc.get(s.to)];
    if (!f || !t || f === t) continue;
    paidPair.set(key(f, t), (paidPair.get(key(f, t)) ?? 0) + s.cents);
  }
  const rows: SettleRow[] = plan.map((p) => {
    const k = key(p.from, p.to);
    const avail = paidPair.get(k) ?? 0;
    const paid = Math.min(p.cents, avail);
    paidPair.set(k, avail - paid);
    return { from: p.from, to: p.to, cents: p.cents, paid, remaining: p.cents - paid };
  });
  // O que falta pagar precisa bater com o saldo de agora de cada conta.
  const residual: Record<string, number> = { ...now };
  for (const r of rows) {
    residual[r.to] -= r.remaining;
    residual[r.from] += r.remaining;
  }
  for (const t of minTransfers(residual, roots)) {
    const same = rows.find((r) => r.from === t.from && r.to === t.to);
    if (same) {
      same.cents += t.cents;
      same.remaining += t.cents;
    } else rows.push({ ...t, paid: 0, remaining: t.cents });
  }
  return rows;
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

/** O que ainda falta pagar no modo escolhido. */
export const settleTransfers = (summary: TripSummary, mode: SettleMode = 'direct') =>
  mode === 'min' ? summary.transfers : summary.direct;

/**
 * Acerto direto: para cada dupla, soma o que um deve ao outro pelas despesas que o outro
 * pagou, desconta o caminho contrário (e, com `withSettlements`, os pagamentos já feitos
 * entre os dois), e sobra um único Pix (ou nenhum). Ninguém recebe dinheiro que é de outra
 * pessoa. Quem tem a parte paga por outro entra na conta dele (accountOf).
 */
export function directTransfers(trip: Trip, withSettlements = true): Transfer[] {
  const acc = new Map(trip.people.map((p) => [p.id, accountOf(trip, p.id)]));
  const order = trip.people.map((p) => p.id).filter((id) => acc.get(id) === id);
  // debt[a][b]: quanto a deve para b (antes de compensar).
  const debt = new Map<string, number>();
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const addDebt = (a: string, b: string, c: number) => debt.set(key(a, b), (debt.get(key(a, b)) ?? 0) + c);
  for (const e of activeExpenses(trip)) {
    const payer = acc.get(e.payerId);
    if (!payer) continue;
    for (const [pid, c] of Object.entries(e.shares)) {
      const who = acc.get(pid);
      if (who && who !== payer) addDebt(who, payer, c);
    }
  }
  // Um pagamento de a para b diminui o que a deve para b (ou faz b passar a dever para a).
  if (withSettlements) {
    for (const s of trip.settlements) {
      const [f, t] = [acc.get(s.from), acc.get(s.to)];
      if (f && t && f !== t) addDebt(t, f, s.cents);
    }
  }
  const out: Transfer[] = [];
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      const [a, b] = [order[i], order[j]];
      const net = (debt.get(key(a, b)) ?? 0) - (debt.get(key(b, a)) ?? 0);
      if (net > 0) out.push({ from: a, to: b, cents: net });
      else if (net < 0) out.push({ from: b, to: a, cents: -net });
    }
  }
  const pos = (id: string) => order.indexOf(id);
  return out.sort((x, y) => pos(x.from) - pos(y.from) || y.cents - x.cents || pos(x.to) - pos(y.to));
}

/** Pagamentos agrupados por quem paga, na ordem da viagem: "Rebeca paga R$ 160: 100 para…, 60 para…". */
export function groupByPayer<T extends Transfer>(transfers: T[], trip: Trip): { from: string; cents: number; items: T[] }[] {
  return trip.people
    .map((p) => {
      const items = transfers.filter((t) => t.from === p.id);
      return { from: p.id, cents: items.reduce((a, t) => a + t.cents, 0), items };
    })
    .filter((g) => g.items.length > 0);
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
export function tripSettleText(trip: Trip, summary: TripSummary, mode: SettleMode = 'min'): string {
  const list = settleTransfers(summary, mode);
  if (list.length === 0) return [header(trip), 'Está tudo quite! ✅'].join('\n');
  const name = (id: string) => accountName(trip, id);
  if (mode === 'direct') {
    return [
      header(trip),
      'Para ficar tudo quite (cada um paga para quem pagou):',
      ...groupByPayer(list, trip).flatMap((g) => [
        '',
        g.items.length > 1 ? `*${name(g.from)}* paga ${formatBRL(g.cents)} no total:` : `*${name(g.from)}* paga:`,
        ...g.items.map((t) => `- ${formatBRL(t.cents)} para ${name(t.to)}`),
      ]),
    ].join('\n');
  }
  return [
    header(trip),
    'Para ficar tudo quite:',
    '',
    ...summary.transfers.map((t) => `- ${name(t.from)} paga ${formatBRL(t.cents)} para ${name(t.to)}`),
  ].join('\n');
}
