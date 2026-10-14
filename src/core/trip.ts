// Viagem: despesas de vários dias, pagas por várias pessoas, com saldo e acerto no final.
// Só cálculo, sem interface nem banco: a mesma lógica serve ao modo solo e ao compartilhado.
//
// Pense num caixa comum: quem paga uma despesa põe dinheiro no caixa, quem participa dela
// tira. No fim, quem pôs mais do que tirou recebe; quem tirou mais do que pôs paga.

import { formatBRL, splitEven, splitWeighted } from './money';
import { MAX_NAME, PERSON_COLORS } from './bill';
import { newcomerName } from './faces';
import { accountIn, canCoverIn, minTransfers, type Transfer } from './settle';

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
  /** Conta do grupo ligada a esta pessoa (quem entrou pelo convite e é ela). */
  userId?: string;
  /**
   * Posta como pessoa nova por outro aparelho, porque a própria pessoa ainda não disse quem é
   * na viagem. Enquanto não tiver nada no nome, ela ainda pode escolher outra pessoa.
   */
  auto?: true;
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
  /**
   * Quem pagou parcelou no cartão (2 a 24 vezes): cada um devolve a sua parte no mesmo
   * número de parcelas. No acerto, vira um pagamento separado ("Airbnb · parcela 2 de 6").
   */
  installments?: number;
  /**
   * Quem paga a parte de quem só nesta despesa (o Mauricio paga a da Lara só no jantar):
   * participante → quem paga. A despesa continua no nome de quem consumiu; no acerto, essa
   * parte entra na conta de quem paga. Para valer na viagem toda, é o `coveredBy` da pessoa.
   */
  coveredBy?: Record<string, string>;
  /**
   * Foto da nota fiscal (id da foto). Fica no aparelho; na viagem compartilhada, também no
   * Supabase Storage, para o grupo todo ver.
   */
  receipt?: string;
}

/** Quem acerta a parte de `pid` nesta despesa: quem paga por ela aqui, ou ela mesma. */
export function chargedTo(e: Pick<ExpenseInput, 'coveredBy'>, pid: string): string {
  const by = e.coveredBy?.[pid];
  return by && by !== pid ? by : pid;
}

/** Só fica quem participa e é pago por outra pessoa da viagem. Vazio: sem o campo. */
function cleanCovered(covered: Record<string, string> | undefined, shares: Record<string, number>, people: Traveler[]) {
  const out: Record<string, string> = {};
  for (const [pid, by] of Object.entries(covered ?? {})) {
    if (pid !== by && Object.hasOwn(shares, pid) && people.some((p) => p.id === by)) out[pid] = by;
  }
  return Object.keys(out).length ? out : undefined;
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
  /**
   * "Todos pagos": todo mundo já acertou esta despesa. Sai do painel de acerto (saldos, quem
   * paga quem, parcelas), mas continua na caderneta e no gasto total da viagem.
   */
  settled?: boolean;
}

/** Pagamento real entre duas pessoas para diminuir o saldo ("Caio pagou R$ 500,00 para Ana"). */
export interface Settlement extends Transfer {
  id: string;
  /** Pagamento de uma despesa parcelada (abate só dela, não do resto do acerto). */
  expenseId?: string;
  /**
   * As despesas que este pagamento acertou (as das duas pessoas, na hora de marcar). Se uma
   * delas for excluída ou marcada "Todos pagos", o pagamento para de contar.
   */
  expenseIds?: string[];
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
  /** Registro de alterações: o que mudou, quando e (no compartilhado) quem fez. */
  log?: TripLogEntry[];
  /** Foto do fundo do cartão da viagem (no aparelho e, no compartilhado, na pasta do grupo). */
  photoId?: string;
  /**
   * Contas do grupo que já ganharam o seu lugar na viagem (ligadas a alguém ou adicionadas).
   * Quem está aqui não é adicionado de novo, nem se a pessoa dela for tirada ou juntada a outra.
   */
  joined?: string[];
}

/** Uma linha do registro de alterações da viagem. */
export interface TripLogEntry {
  at: number;
  /** Quem fez: vazio sozinho; no compartilhado, o nome da conta. */
  by: string | null;
  kind: string;
  text: string;
}

export const MAX_INSTALLMENTS = 24;

export interface InstallmentInfo {
  count: number;
  /** Valor de cada parcela (somam o total; o centavo que sobra vai nas primeiras). */
  parts: number[];
  /** Quantas parcelas já foram pagas inteiras. */
  paidCount: number;
  /** Quanto falta da próxima parcela (0 se já pagou tudo). */
  next: number;
}

/** Número de parcelas válido de uma despesa (1 = à vista). */
export const installmentsOf = (e: Pick<ExpenseInput, 'installments'>) =>
  Number.isInteger(e.installments) && e.installments! >= 2 && e.installments! <= MAX_INSTALLMENTS ? e.installments! : 1;

/**
 * Parcelamento de um pagamento: divide o total em `count` parcelas e vê, pelo que já foi
 * pago, quantas estão quitadas e quanto falta da próxima. Pagou um valor quebrado? A conta
 * segue pelo acumulado: R$ 30 de 3x R$ 20 = 1 parcela paga e faltam R$ 10 da segunda.
 */
export function installmentInfo(cents: number, paid: number, count: number): InstallmentInfo {
  const n = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(count)));
  const parts = splitEven(cents, n);
  let acc = 0;
  let paidCount = 0;
  for (const p of parts) {
    if (acc + p > paid) break;
    acc += p;
    paidCount++;
  }
  const next = paidCount < n ? acc + parts[paidCount] - paid : 0;
  return { count: n, parts, paidCount, next: Math.max(0, Math.min(next, cents - paid)) };
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
  const covered = cleanCovered(input.coveredBy, r.shares, trip.people);
  if (covered) expense.coveredBy = covered;
  else delete expense.coveredBy;
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
  // Voltou para à vista: deixa de ser parcelada (sem isso, a parcela antiga continuava no acerto).
  if (installmentsOf(input) === 1) delete expense.installments;
  if (!input.receipt) delete expense.receipt;
  const covered = cleanCovered(input.coveredBy, r.shares, trip.people);
  if (covered) expense.coveredBy = covered;
  else delete expense.coveredBy;
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
export function addSettlement(trip: Trip, t: Transfer & { expenseId?: string }, id: string, now: string): TripResult {
  if (!Number.isSafeInteger(t.cents) || t.cents <= 0) return { ok: false, error: 'Digite o valor do pagamento.' };
  if (t.from === t.to) return { ok: false, error: 'Escolha duas pessoas diferentes.' };
  const known = (pid: string) => trip.people.some((p) => p.id === pid);
  if (!known(t.from) || !known(t.to)) return { ok: false, error: 'Escolha quem pagou e quem recebeu.' };
  const s: Settlement = { from: t.from, to: t.to, cents: t.cents, id, at: now };
  if (t.expenseId && trip.expenses.some((e) => e.id === t.expenseId)) s.expenseId = t.expenseId;
  else {
    const linked = linkedExpenses(trip, t.from, t.to);
    if (linked.length) s.expenseIds = linked;
  }
  return { ok: true, trip: { ...trip, settlements: [...trip.settlements, s] } };
}

export const activeExpenses = (trip: Trip) => trip.expenses.filter((e) => !e.deleted);

/** As que entram no acerto: nem excluídas nem marcadas "Todos pagos". */
export const openExpenses = (trip: Trip) => trip.expenses.filter((e) => !e.deleted && !e.settled);

/** Marca (ou desmarca) "Todos pagos": a despesa sai (ou volta) do painel de acerto. */
export function setExpenseSettled(trip: Trip, id: string, settled: boolean, now: string): Trip {
  return {
    ...trip,
    expenses: trip.expenses.map((e) => {
      if (e.id !== id) return e;
      const next: Expense = { ...e, updatedAt: now };
      if (settled) next.settled = true;
      else delete next.settled;
      return next;
    }),
  };
}

/**
 * As despesas à vista que um pagamento de `from` para `to` acerta: as que envolvem as duas
 * contas (uma pagou, a outra participou). Sem nenhuma (no modo de menos Pix o dinheiro pode ir
 * para outra pessoa), as que envolvem qualquer uma das duas.
 */
function linkedExpenses(trip: Trip, from: string, to: string, pool = openExpenses(trip)): string[] {
  const [fa, ta] = [accountOf(trip, from), accountOf(trip, to)];
  const accs = (e: Expense) =>
    new Set([accountOf(trip, e.payerId), ...Object.keys(e.shares).filter((pid) => e.shares[pid] > 0).map((pid) => accountOf(trip, chargedTo(e, pid)))]);
  const cash = pool.filter((e) => installmentsOf(e) === 1);
  const both = cash.filter((e) => {
    const a = accs(e);
    return a.has(fa) && a.has(ta);
  });
  const list = both.length ? both : cash.filter((e) => accs(e).has(fa) || accs(e).has(ta));
  return list.map((e) => e.id);
}

/**
 * Pagamentos que contam: só os das despesas que ainda estão no acerto. Se a despesa (ou uma
 * das despesas que o pagamento acertou) foi excluída ou marcada "Todos pagos", o pagamento
 * sai junto, e ninguém fica "devendo de volta". Desfazer traz tudo de volta.
 */
export function activeSettlements(trip: Trip): Settlement[] {
  const open = new Map(openExpenses(trip).map((e) => [e.id, e]));
  const out: Settlement[] = [];
  for (const s of trip.settlements) {
    if (s.expenseId) {
      if (open.has(s.expenseId)) out.push(s);
      continue;
    }
    const links = s.expenseIds ?? legacyLinks(trip, s);
    if (links.every((id) => open.has(id))) {
      out.push(s);
      continue;
    }
    // Parte das despesas saiu: o pagamento vale só para as que ficaram, até o que se deve nelas.
    const [fa, ta] = [accountOf(trip, s.from), accountOf(trip, s.to)];
    let owed = 0;
    for (const id of links) {
      const e = open.get(id);
      if (!e || accountOf(trip, e.payerId) !== ta) continue;
      for (const [pid, c] of Object.entries(e.shares)) if (accountOf(trip, chargedTo(e, pid)) === fa) owed += c;
    }
    const cents = Math.min(s.cents, owed);
    if (cents > 0) out.push({ ...s, cents });
  }
  return out;
}

/**
 * Pagamento marcado antes de existir a ligação com as despesas: liga às despesas das duas
 * pessoas que já existiam quando ele foi marcado (lançadas antes e ainda não excluídas).
 */
function legacyLinks(trip: Trip, s: Settlement): string[] {
  const then = trip.expenses.filter((e) => e.createdAt <= s.at && !(e.deleted && (e.updatedAt ?? '') < s.at));
  return linkedExpenses(trip, s.from, s.to, then);
}

/** Onde a pessoa aparece (contando despesas excluídas, que podem voltar). */
export function travelerUsage(trip: Trip, id: string): { expenses: number; settlements: number } {
  return {
    expenses: trip.expenses.filter(
      (e) => e.payerId === id || Object.hasOwn(e.shares, id) || e.people.includes(id) || Object.values(e.coveredBy ?? {}).includes(id),
    ).length,
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
 * Passa para `toId` tudo o que está no nome de `fromId`: despesas que pagou, partes, acertos e
 * de quem ela paga a parte. Nenhum valor muda. `fromId` continua na viagem, sem nada no nome.
 * Se as duas participavam da mesma despesa, as partes se somam e a despesa passa a "valores
 * exatos" (para continuar batendo ao centavo); o mesmo vale para divisão por peso, já que o
 * peso de quem recebe é outro. Acerto entre as duas some.
 */
export function transferTraveler(trip: Trip, fromId: string, toId: string): TripResult {
  if (fromId === toId || !trip.people.some((p) => p.id === toId) || !trip.people.some((p) => p.id === fromId)) {
    return { ok: false, error: 'Escolha outra pessoa para receber as despesas.' };
  }
  const swap = (pid: string) => (pid === fromId ? toId : pid);
  const expenses = trip.expenses.map((e): Expense => {
    const payerId = swap(e.payerId);
    // Quem paga a parte de quem nesta despesa: troca os nomes. Se as duas participavam, fica
    // como estava a de quem recebe (a parte somada é dela).
    let coveredBy: Record<string, string> | undefined;
    if (e.coveredBy) {
      coveredBy = {};
      for (const [pid, by] of Object.entries(e.coveredBy)) {
        if (pid === fromId && Object.hasOwn(e.shares, toId)) continue;
        if (swap(pid) !== swap(by)) coveredBy[swap(pid)] = swap(by);
      }
      if (!Object.keys(coveredBy).length) coveredBy = undefined;
    }
    const withCover = (x: Expense): Expense => {
      if (coveredBy) return { ...x, coveredBy };
      const y = { ...x };
      delete y.coveredBy;
      return y;
    };
    if (!e.people.includes(fromId) && !Object.hasOwn(e.shares, fromId)) return withCover({ ...e, payerId });
    const shares: Record<string, number> = {};
    for (const [pid, c] of Object.entries(e.shares)) shares[swap(pid)] = (shares[swap(pid)] ?? 0) + c;
    const people = [...new Set(e.people.map(swap))];
    const keepRule = e.split === 'equal' && !e.people.includes(toId);
    const next: Expense = { ...e, payerId, people, shares, split: keepRule ? 'equal' : 'exact' };
    if (keepRule) delete next.exact;
    else next.exact = { ...shares };
    return withCover(next);
  });
  const settlements = trip.settlements
    .map((s) => ({ ...s, from: swap(s.from), to: swap(s.to) }))
    .filter((s) => s.from !== s.to);
  const people = cleanCoverage(trip.people.map((p) => (p.coveredBy === fromId && p.id !== fromId ? { ...p, coveredBy: toId } : p)));
  return { ok: true, trip: { ...trip, people, expenses, settlements } };
}

/**
 * Passa tudo de uma pessoa para outra e a remove (ver transferTraveler). Se quem sai estava
 * ligada a uma conta do grupo e quem fica não, a conta passa para quem fica.
 */
export function mergeTraveler(trip: Trip, fromId: string, toId: string): TripResult {
  const r = transferTraveler(trip, fromId, toId);
  if (!r.ok) return r;
  const userId = trip.people.find((p) => p.id === fromId)?.userId;
  const people = r.trip.people
    .filter((p) => p.id !== fromId)
    .map((p) => (p.id === toId && userId && !p.userId ? { ...p, userId } : p));
  return { ok: true, trip: { ...r.trip, people: cleanCoverage(people) } };
}

export interface JoinResult {
  trip: Trip;
  /** A pessoa da viagem que é a conta (null: não mudou nada e ela não está na viagem). */
  id: string | null;
  /** O que aconteceu: ligou a quem a pessoa escolheu, adicionou, ou já estava. */
  how: 'linked' | 'added' | 'already';
}

/** Quem ainda não está ligado a nenhuma conta (pode ser escolhido por quem entra). */
export const freeTravelers = (trip: Trip) => trip.people.filter((p) => !p.userId);

/**
 * Alguém entrou no grupo: passa a participar da viagem. Nome igual NÃO liga sozinho (duas
 * Rebecas podem ser pessoas diferentes): só liga a `prefer`, a pessoa que quem entrou escolheu
 * em "Quem é você nesta viagem?" (ou o "sou eu" de quem criou). Sem escolha, entra como pessoa
 * nova (`newId`), com o primeiro nome da conta, ou "Rebeca O." se já há uma Rebeca.
 *
 * Cada conta faz isso uma vez só (`joined`): quem foi tirado depois não volta sozinho. Exceção
 * (`claim`, a escolha é da própria pessoa): outro aparelho já a tinha posto como pessoa nova
 * (`auto`); se essa pessoa ainda não tem nada no nome, a escolha vale e a pessoa vazia sai.
 * `auto`: quem chama é outro aparelho (a pessoa nova fica marcada, ver Traveler.auto).
 */
export function joinTraveler(trip: Trip, userId: string, name: string, newId: string, prefer?: string, claim = false, auto = false): JoinResult {
  const linked = trip.people.find((p) => p.userId === userId);
  const joined = trip.joined ?? [];
  const mark = (t: Trip): Trip => (joined.includes(userId) ? t : { ...t, joined: [...joined, userId] });
  const target = prefer ? trip.people.find((p) => p.id === prefer && !p.userId) : undefined;
  if (linked) {
    if (claim && linked.auto && target && canRemoveTraveler(trip, linked.id)) {
      const people = cleanCoverage(trip.people.filter((p) => p.id !== linked.id).map((p) => (p.id === target.id ? { ...p, userId } : p)));
      return { trip: mark({ ...trip, people }), id: target.id, how: 'linked' };
    }
    if (claim && linked.auto) {
      // Disse que é mesmo a pessoa nova: deixa de ser provisória.
      const people = trip.people.map((p) => {
        if (p.id !== linked.id) return p;
        const next = { ...p };
        delete next.auto;
        return next;
      });
      return { trip: mark({ ...trip, people }), id: linked.id, how: 'already' };
    }
    return { trip: mark(trip), id: linked.id, how: joined.includes(userId) ? 'already' : 'linked' };
  }
  if (joined.includes(userId) && !claim) return { trip, id: null, how: 'already' };
  if (target) {
    const people = trip.people.map((p) => (p.id === target.id ? { ...p, userId } : p));
    return { trip: mark({ ...trip, people }), id: target.id, how: 'linked' };
  }
  const label = newcomerName(trip.people.map((p) => p.name), name, MAX_NAME);
  const used = new Set(trip.people.map((p) => p.color));
  let color = trip.people.length % PERSON_COLORS;
  for (let c = PERSON_COLORS - 1; c >= 0; c--) if (!used.has(c)) color = c;
  const person: Traveler = { id: newId, name: label, color, weight: 1, userId, ...(auto ? { auto: true as const } : {}) };
  return { trip: mark({ ...trip, people: [...trip.people, person] }), id: newId, how: 'added' };
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
  /**
   * Quanto entra na conta dele no acerto: o que consumiu, menos as partes que outro paga
   * numa despesa, mais as partes de outros que ele paga. Sem isso, é igual a `owes`.
   */
  charged: number;
  /** Acertos que já mandou e que já recebeu. */
  sent: number;
  received: number;
  /** pagou − na conta dele + mandou − recebeu. Positivo: recebe. Negativo: paga. */
  balance: number;
}

/** Um pagamento do acerto, com quanto já foi pago dele. Pago não some: fica marcado. */
export interface SettleRow extends Transfer {
  /** Quanto já foi registrado como pago deste pagamento. */
  paid: number;
  /** Quanto ainda falta (cents − paid). Zero: está pago. */
  remaining: number;
  /** Só nas despesas parceladas: de qual despesa é e em quantas vezes. */
  expenseId?: string;
  installments?: number;
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
  return accountIn(trip.people, id);
}

/** Quem tem a conta junto com `id` no acerto (a filha na conta do pai), sem contar a própria. */
export function accountMembers(trip: Trip, id: string): Traveler[] {
  return trip.people.filter((p) => p.id !== id && accountOf(trip, p.id) === id);
}

/** Dá para `by` pagar a parte de `id`? Não pode ser a mesma pessoa nem fechar um círculo. */
export function canCover(trip: Trip, id: string, by: string): boolean {
  return canCoverIn(trip.people, id, by);
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
  const row = new Map(trip.people.map((p) => [p.id, { person: p, paid: 0, owes: 0, charged: 0, sent: 0, received: 0, balance: 0 }]));
  const byCategory = new Map<TripCategory, number>();
  const byDay = new Map<string, number>();
  let total = 0;
  let ok = true;

  for (const e of activeExpenses(trip)) {
    const entries = Object.entries(e.shares);
    if (
      entries.reduce((a, [, c]) => a + c, 0) !== e.cents ||
      !ids.has(e.payerId) ||
      entries.some(([pid]) => !ids.has(pid) || !ids.has(chargedTo(e, pid)))
    ) {
      ok = false;
      continue;
    }
    total += e.cents;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.cents);
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.cents);
    // "Todos pagos": conta no gasto, mas não no acerto.
    if (e.settled) continue;
    row.get(e.payerId)!.paid += e.cents;
    for (const [pid, c] of entries) {
      row.get(pid)!.owes += c;
      row.get(chargedTo(e, pid))!.charged += c;
    }
  }
  for (const s of activeSettlements(trip)) {
    if (!ids.has(s.from) || !ids.has(s.to) || s.cents <= 0) {
      ok = false;
      continue;
    }
    row.get(s.from)!.sent += s.cents;
    row.get(s.to)!.received += s.cents;
  }

  const people = trip.people.map((p) => {
    const r = row.get(p.id)!;
    return { ...r, balance: r.paid - r.charged + r.sent - r.received };
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
 * a lista: a linha fica marcada como paga). Despesas parceladas viram pagamentos separados,
 * um por despesa e dupla, sem compensar com o resto (cada parcela bate com a do cartão).
 * Depois cada pagamento registrado abate da sua linha. Se sobrar diferença (pagou a mais,
 * ou para outra pessoa), entram linhas de ajuste, para o que falta continuar fechando ao
 * centavo com os saldos.
 */
function settlePlans(trip: Trip, people: TravelerBalance[]): Record<SettleMode, SettleRow[]> {
  const acc = new Map(trip.people.map((p) => [p.id, accountOf(trip, p.id)]));
  const roots = trip.people.map((p) => p.id).filter((id) => acc.get(id) === id);
  const base: Record<string, number> = Object.fromEntries(roots.map((id) => [id, 0]));
  const now: Record<string, number> = { ...base };
  for (const r of people) {
    const a = acc.get(r.person.id)!;
    base[a] += r.paid - r.charged;
    now[a] += r.balance;
  }
  const split = installmentRows(trip, acc);
  for (const r of split) {
    base[r.from] += r.cents;
    base[r.to] -= r.cents;
  }
  return {
    min: reconcile(minTransfers(base, roots), split, trip, acc, roots, now),
    direct: reconcile(directTransfers(trip, false, true), split, trip, acc, roots, now),
  };
}

/** Uma linha por despesa parcelada e dupla de contas (quem deve → quem pagou). */
function installmentRows(trip: Trip, acc: Map<string, string>): SettleRow[] {
  const rows: SettleRow[] = [];
  for (const e of openExpenses(trip)) {
    const n = installmentsOf(e);
    const payer = acc.get(e.payerId);
    if (n === 1 || !payer) continue;
    for (const p of trip.people) {
      const c = Object.hasOwn(e.shares, p.id) ? e.shares[p.id] : 0;
      const from = acc.get(chargedTo(e, p.id))!;
      if (c <= 0 || from === payer) continue;
      const row = rows.find((r) => r.expenseId === e.id && r.from === from);
      if (row) row.cents += c;
      else rows.push({ from, to: payer, cents: c, paid: 0, remaining: 0, expenseId: e.id, installments: n });
    }
  }
  return rows;
}

function reconcile(
  plan: Transfer[],
  split: SettleRow[],
  trip: Trip,
  acc: Map<string, string>,
  roots: string[],
  now: Record<string, number>,
): SettleRow[] {
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const paidPair = new Map<string, number>();
  const paidSplit = new Map<string, number>();
  for (const s of activeSettlements(trip)) {
    const [f, t] = [acc.get(s.from), acc.get(s.to)];
    if (!f || !t || f === t) continue;
    const own = s.expenseId && split.find((r) => r.expenseId === s.expenseId && r.from === f && r.to === t);
    if (own) paidSplit.set(key(own.expenseId!, f), (paidSplit.get(key(own.expenseId!, f)) ?? 0) + s.cents);
    else paidPair.set(key(f, t), (paidPair.get(key(f, t)) ?? 0) + s.cents);
  }
  const take = (m: Map<string, number>, k: string, cents: number) => {
    const avail = m.get(k) ?? 0;
    const paid = Math.min(cents, avail);
    m.set(k, avail - paid);
    return paid;
  };
  const rows: SettleRow[] = plan.map((p) => {
    const paid = take(paidPair, key(p.from, p.to), p.cents);
    return { from: p.from, to: p.to, cents: p.cents, paid, remaining: p.cents - paid };
  });
  for (const r of split) {
    const paid = take(paidSplit, key(r.expenseId!, r.from), r.cents);
    rows.push({ ...r, paid, remaining: r.cents - paid });
  }
  // O que falta pagar precisa bater com o saldo de agora de cada conta.
  const residual: Record<string, number> = { ...now };
  for (const r of rows) {
    residual[r.to] -= r.remaining;
    residual[r.from] += r.remaining;
  }
  for (const t of minTransfers(residual, roots)) {
    const same = rows.find((r) => r.from === t.from && r.to === t.to && !r.expenseId);
    if (same) {
      same.cents += t.cents;
      same.remaining += t.cents;
    } else rows.push({ ...t, paid: 0, remaining: t.cents });
  }
  return rows;
}

/** Uma linha do extrato de saldos. */
export interface StatementRow {
  id: string;
  /**
   * recebe / paga: falta acertar `cents`. pago: devia e já pagou. recebido: tinha a receber e
   * já recebeu. coberta: a parte dela é paga por outra pessoa (`by`). fora: não participa.
   */
  kind: 'recebe' | 'paga' | 'pago' | 'recebido' | 'coberta' | 'fora';
  cents: number;
  /** Quem paga a parte dela (coberta). */
  by?: string[];
  /** De quem ela paga a parte junto (na conta dela). */
  with?: string[];
}

/**
 * O extrato: uma linha por pessoa. Quem tem a parte paga por outro aparece só com o aviso;
 * o valor fica na linha de quem paga (a conta junta), igual ao acerto.
 */
export function statementRows(trip: Trip, summary: TripSummary): StatementRow[] {
  const row = new Map(summary.people.map((r) => [r.person.id, r]));
  // Quem paga partes dos outros em alguma despesa (só nesta despesa).
  const sponsorsOf = new Map<string, Set<string>>();
  for (const e of openExpenses(trip)) {
    for (const pid of Object.keys(e.shares)) {
      const by = chargedTo(e, pid);
      if (by !== pid) sponsorsOf.set(pid, (sponsorsOf.get(pid) ?? new Set()).add(by));
    }
  }
  return trip.people.map((p): StatementRow => {
    const root = accountOf(trip, p.id);
    if (root !== p.id) return { id: p.id, kind: 'coberta', cents: 0, by: [root] };
    const members = accountMembers(trip, p.id).map((m) => m.id);
    const all = [p.id, ...members].map((id) => row.get(id)).filter((r) => r !== undefined);
    const sum = (k: 'paid' | 'owes' | 'charged' | 'sent' | 'received' | 'balance') => all.reduce((a, r) => a + r[k], 0);
    const balance = sum('balance');
    const base = members.length ? { with: members } : {};
    if (balance > 0) return { id: p.id, kind: 'recebe', cents: balance, ...base };
    if (balance < 0) return { id: p.id, kind: 'paga', cents: -balance, ...base };
    // Participa de alguma despesa (também das marcadas "Todos pagos")?
    const ids = new Set([p.id, ...members]);
    let net = 0;
    let involved = false;
    for (const e of activeExpenses(trip)) {
      if (ids.has(e.payerId)) {
        involved = true;
        net += e.cents;
      }
      for (const [pid, c] of Object.entries(e.shares)) {
        if (ids.has(pid)) involved = true;
        if (ids.has(chargedTo(e, pid))) net -= c;
      }
    }
    if (!involved && sum('sent') === 0 && sum('received') === 0) return { id: p.id, kind: 'fora', cents: 0 };
    // Consumiu, mas outra pessoa pagou a parte dela nas despesas (só nelas).
    if (sum('charged') === 0 && sum('paid') === 0 && sponsorsOf.has(p.id)) {
      return { id: p.id, kind: 'coberta', cents: 0, by: [...sponsorsOf.get(p.id)!] };
    }
    return { id: p.id, kind: net > 0 ? 'recebido' : 'pago', cents: 0, ...base };
  });
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
export function directTransfers(trip: Trip, withSettlements = true, skipInstallments = false): Transfer[] {
  const acc = new Map(trip.people.map((p) => [p.id, accountOf(trip, p.id)]));
  const order = trip.people.map((p) => p.id).filter((id) => acc.get(id) === id);
  // debt[a][b]: quanto a deve para b (antes de compensar).
  const debt = new Map<string, number>();
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const addDebt = (a: string, b: string, c: number) => debt.set(key(a, b), (debt.get(key(a, b)) ?? 0) + c);
  for (const e of openExpenses(trip)) {
    const payer = acc.get(e.payerId);
    if (!payer || (skipInstallments && installmentsOf(e) > 1)) continue;
    for (const [pid, c] of Object.entries(e.shares)) {
      const who = acc.get(chargedTo(e, pid));
      if (who && who !== payer) addDebt(who, payer, c);
    }
  }
  // Um pagamento de a para b diminui o que a deve para b (ou faz b passar a dever para a).
  if (withSettlements) {
    for (const s of activeSettlements(trip)) {
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
  /** A parte é de outra pessoa, paga por esta só nesta despesa ("parte de Lara"). */
  for?: string;
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
  const expenses = [...openExpenses(trip)].sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);
  for (const e of expenses) {
    for (const [pid, c] of Object.entries(e.shares)) {
      const who = chargedTo(e, pid);
      const line: StatementLine = pid === who ? { expense: e, cents: c } : { expense: e, cents: c, for: pid };
      if (e.payerId === id) {
        if (who === id) ownShare += c;
        else if (c > 0) push(owed, who, line);
      } else if (who === id && c > 0) {
        push(owes, e.payerId, line);
      }
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
  const sent = activeSettlements(trip).filter((s) => s.from === id).reduce((a, s) => a + s.cents, 0);
  const received = activeSettlements(trip).filter((s) => s.to === id).reduce((a, s) => a + s.cents, 0);
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
  const list = summary.plan[mode].filter((r) => r.remaining > 0);
  if (list.length === 0) return [header(trip), 'Está tudo quite! ✅'].join('\n');
  const name = (id: string) => accountName(trip, id);
  /** "R$ 50,00 para Mauricio: parcela 2/6 de Airbnb (faltam R$ 250,00)". */
  const pay = (r: SettleRow) => {
    if (!r.expenseId) return `${formatBRL(r.remaining)} para ${name(r.to)}`;
    const i = installmentInfo(r.cents, r.paid, r.installments ?? 1);
    const what = trip.expenses.find((e) => e.id === r.expenseId)?.description ?? 'despesa';
    const left = r.remaining > i.next ? ` (faltam ${formatBRL(r.remaining)})` : '';
    return `${formatBRL(i.next)} para ${name(r.to)}: parcela ${i.paidCount + 1}/${i.count} de ${what}${left}`;
  };
  if (mode === 'direct') {
    return [
      header(trip),
      'Para ficar tudo quite (cada um paga para quem pagou):',
      ...groupByPayer(list, trip).flatMap((g) => [
        '',
        g.items.length > 1 ? `*${name(g.from)}* paga ${formatBRL(g.items.reduce((a, r) => a + r.remaining, 0))} no total:` : `*${name(g.from)}* paga:`,
        ...g.items.map((r) => `- ${pay(r)}`),
      ]),
    ].join('\n');
  }
  return [header(trip), 'Para ficar tudo quite:', '', ...list.map((r) => `- ${name(r.from)} paga ${pay(r)}`)].join('\n');
}
