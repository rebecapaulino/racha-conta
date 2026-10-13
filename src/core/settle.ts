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
