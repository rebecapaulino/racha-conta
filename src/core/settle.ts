// Acerto: transforma saldos em pagamentos entre pessoas. Usado pelo Rolê e pela Viagem.

/** Dinheiro de uma pessoa para outra, em centavos. */
export interface Transfer {
  from: string;
  to: string;
  cents: number;
}

/** Saldo de cada pessoa em centavos (id → valor): positivo recebe, negativo paga. Soma zero. */
export type Balances = Record<string, number>;

/** Transforma os saldos em transferências: quem mais deve paga primeiro a quem mais tem a receber. */
export function settleUp(balance: Balances, order: string[]): Transfer[] {
  const rank = (id: string) => order.indexOf(id);
  const side = (sign: 1 | -1) =>
    order
      .filter((id) => sign * (balance[id] ?? 0) > 0)
      .map((id) => ({ id, left: Math.abs(balance[id]) }))
      .sort((a, b) => b.left - a.left || rank(a.id) - rank(b.id));
  const creditors = side(1);
  const debtors = side(-1);
  const out: Transfer[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const cents = Math.min(creditors[c].left, debtors[d].left);
    out.push({ from: debtors[d].id, to: creditors[c].id, cents });
    creditors[c].left -= cents;
    debtors[d].left -= cents;
    if (creditors[c].left === 0) c++;
    if (debtors[d].left === 0) d++;
  }
  return out;
}

/** Até quantas pessoas com saldo o app procura o mínimo exato (2^15 combinações: instantâneo). */
export const EXACT_LIMIT = 15;

/**
 * Menor número de pagamentos para todo mundo ficar quite.
 *
 * Cada grupo de pessoas cujos saldos somam zero se acerta sozinho, com (tamanho − 1)
 * pagamentos. Então o mínimo é (pessoas com saldo − número de grupos), e o melhor é separar
 * no maior número possível de grupos que somam zero. Até EXACT_LIMIT pessoas, o app testa
 * todas as combinações (programação dinâmica sobre subconjuntos) e, dentro de cada grupo,
 * paga como o settleUp. Acima do limite, usa o settleUp direto, que às vezes faz um
 * pagamento a mais.
 */
export function minTransfers(balance: Balances, order: string[]): Transfer[] {
  const ids = order.filter((id) => (balance[id] ?? 0) !== 0);
  const n = ids.length;
  if (n === 0) return [];
  if (n > EXACT_LIMIT) return settleUp(balance, order);

  const full = (1 << n) - 1;
  // sum[m]: soma dos saldos do subconjunto m. best[m]: quantos grupos de soma zero cabem em m.
  const sum = new Float64Array(full + 1);
  const best = new Int8Array(full + 1);
  for (let m = 1; m <= full; m++) {
    const low = m & -m;
    sum[m] = sum[m ^ low] + balance[ids[31 - Math.clz32(low)]];
    let b = 0;
    for (let j = 0; j < n; j++) if (m & (1 << j) && best[m ^ (1 << j)] > b) b = best[m ^ (1 << j)];
    best[m] = b + (sum[m] === 0 ? 1 : 0);
  }
  // Saldos que não somam zero nunca deveriam chegar aqui; sem garantia, fica o guloso.
  if (sum[full] !== 0) return settleUp(balance, order);

  // Refaz o caminho do melhor resultado: cada trecho entre dois subconjuntos de soma zero é um grupo.
  const cuts: number[] = [];
  let m = full;
  while (m) {
    const zero = sum[m] === 0 ? 1 : 0;
    if (zero) cuts.push(m);
    let j = 0;
    while (!(m & (1 << j)) || best[m ^ (1 << j)] !== best[m] - zero) j++;
    m ^= 1 << j;
  }
  cuts.push(0);

  const out: Transfer[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const group = ids.filter((_, i) => (cuts[k] ^ cuts[k + 1]) & (1 << i));
    out.push(...settleUp(balance, group));
  }
  const rank = (id: string) => order.indexOf(id);
  return out.sort((a, b) => b.cents - a.cents || rank(a.from) - rank(b.from) || rank(a.to) - rank(b.to));
}

/** Alguém que pode ter a parte paga por outra pessoa (Rolê e Viagem). */
export interface Member {
  id: string;
  /** Quem paga a parte desta pessoa no acerto. */
  coveredBy?: string;
}

/**
 * De quem é a conta no acerto: segue "quem paga por ela" até chegar em alguém que paga a
 * própria parte (Rebeca → Robin). Sem ninguém, a conta é da própria pessoa.
 */
export function accountIn(people: Member[], id: string): string {
  const byId = new Map(people.map((p) => [p.id, p]));
  const seen = new Set([id]);
  let cur = id;
  for (;;) {
    const next = byId.get(cur)?.coveredBy;
    if (!next || !byId.has(next) || seen.has(next)) return cur;
    seen.add(next);
    cur = next;
  }
}

/** Dá para `by` pagar a parte de `id`? Não pode ser a mesma pessoa nem fechar um círculo. */
export function canCoverIn(people: Member[], id: string, by: string): boolean {
  if (id === by || !people.some((p) => p.id === by)) return false;
  const byId = new Map(people.map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (let cur: string | undefined = by; cur && byId.has(cur) && !seen.has(cur); cur = byId.get(cur)?.coveredBy) {
    if (cur === id) return false;
    seen.add(cur);
  }
  return true;
}

/** Tira "quem paga" que aponta para quem saiu (a pessoa volta a pagar a própria parte). */
export function dropCoverage<T extends Member>(people: T[]): T[] {
  const ids = new Set(people.map((p) => p.id));
  return people.map((p) => {
    if (!p.coveredBy || ids.has(p.coveredBy)) return p;
    const rest = { ...p };
    delete rest.coveredBy;
    return rest;
  });
}

/** Um pagamento do acerto, com quanto já foi pago dele. */
export interface PlanRow extends Transfer {
  paid: number;
  remaining: number;
}

/**
 * Acerto direto: para cada dupla, soma o que um deve ao outro, desconta o caminho contrário
 * e sobra um único Pix (ou nenhum). Ninguém recebe dinheiro que é de outra pessoa.
 */
export function netPairs(debts: Transfer[], order: string[]): Transfer[] {
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const debt = new Map<string, number>();
  for (const d of debts) {
    if (d.from === d.to) continue;
    debt.set(key(d.from, d.to), (debt.get(key(d.from, d.to)) ?? 0) + d.cents);
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

/**
 * Abate os pagamentos feitos de cada linha do plano (a linha fica, marcada como paga).
 * Se sobrar diferença (pagou a mais, ou para outra pessoa), entram linhas de ajuste para o
 * que falta fechar ao centavo com os saldos de agora (`now`).
 */
export function reconcilePlan(plan: Transfer[], payments: Transfer[], now: Balances, order: string[]): PlanRow[] {
  const key = (a: string, b: string) => `${a}\u0000${b}`;
  const paidPair = new Map<string, number>();
  for (const s of payments) {
    if (s.from !== s.to) paidPair.set(key(s.from, s.to), (paidPair.get(key(s.from, s.to)) ?? 0) + s.cents);
  }
  const rows: PlanRow[] = plan.map((p) => {
    const avail = paidPair.get(key(p.from, p.to)) ?? 0;
    const paid = Math.min(p.cents, avail);
    paidPair.set(key(p.from, p.to), avail - paid);
    return { from: p.from, to: p.to, cents: p.cents, paid, remaining: p.cents - paid };
  });
  const residual: Balances = Object.fromEntries(order.map((id) => [id, now[id] ?? 0]));
  for (const r of rows) {
    residual[r.to] -= r.remaining;
    residual[r.from] += r.remaining;
  }
  for (const t of minTransfers(residual, order)) {
    const same = rows.find((r) => r.from === t.from && r.to === t.to);
    if (same) {
      same.cents += t.cents;
      same.remaining += t.cents;
    } else rows.push({ ...t, paid: 0, remaining: t.cents });
  }
  return rows;
}
