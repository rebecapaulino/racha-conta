// Modelo da conta e regras de negócio. Sem nenhuma dependência de interface,
// para poder ser testado sozinho e reaproveitado (ex.: app Capacitor depois).

import { formatBRL } from './money';

export const SERVICE_OPTIONS = [0, 10, 12, 15] as const;
export type ServicePct = (typeof SERVICE_OPTIONS)[number];

export const MAX_NAME = 24;
/** Nome de item: o mesmo limite do campo "Adicionar item". */
export const MAX_ITEM_NAME = 40;
export const MAX_QTY = 99;
export const PERSON_COLORS = 6;

export interface Person {
  id: string;
  name: string;
  /** Índice da cor (0 a 5). */
  color: number;
}

export interface Item {
  id: string;
  name: string;
  /** Preço de uma unidade, em centavos. */
  cents: number;
  /** Quantidade pedida (sem o campo, vale 1). */
  qty?: number;
  /** Ids das pessoas que consumiram o item. */
  who: string[];
}

export interface Bill {
  title: string;
  servicePct: ServicePct;
  payerId: string | null;
  people: Person[];
  items: Item[];
  /** Quanto cada pessoa já pagou da parte dela, em centavos (id da pessoa → valor). */
  paid?: Record<string, number>;
}

/** Quanto a pessoa pagou de um item (para explicar por que alguém gastou mais). */
export interface ItemPart {
  item: Item;
  /** Parte da pessoa, em centavos. */
  cents: number;
  /** Entre quantas pessoas o item foi dividido. */
  splitBy: number;
}

export interface PersonShare {
  person: Person;
  consumption: number;
  service: number;
  total: number;
  /** Itens que a pessoa consumiu, na ordem da conta. Soma === consumption. */
  parts: ItemPart[];
}

export interface SplitResult {
  shares: PersonShare[];
  /** Soma dos itens que entraram na divisão. */
  subtotal: number;
  service: number;
  total: number;
  /** Valor dos itens sem ninguém marcado (fora da divisão). */
  unassigned: number;
  unassignedItems: Item[];
}

/** Valor da linha: preço da unidade × quantidade. */
export function itemTotal(item: Item): number {
  return item.cents * (item.qty ?? 1);
}

/**
 * Calcula quanto cada pessoa paga.
 *
 * - Item dividido entre N pessoas: cada uma paga floor(valor / N); os centavos
 *   que sobram vão 1 por pessoa, começando numa posição que gira conforme o
 *   índice do item, para o centavo extra não cair sempre na mesma pessoa.
 * - Serviço total = round(subtotal × % / 100), dividido proporcionalmente ao
 *   consumo pelo método do maior resto.
 * - Garantia: soma dos totais individuais === subtotal + serviço.
 */
export function computeSplit(bill: Bill): SplitResult {
  const consumption = new Map<string, number>();
  const parts = new Map<string, ItemPart[]>();
  bill.people.forEach((p) => {
    consumption.set(p.id, 0);
    parts.set(p.id, []);
  });

  let subtotal = 0;
  let unassigned = 0;
  const unassignedItems: Item[] = [];

  bill.items.forEach((item, idx) => {
    // Ordem da mesa (não a ordem dos cliques) para o resultado ser estável.
    const who = bill.people.filter((p) => item.who.includes(p.id)).map((p) => p.id);
    const value = itemTotal(item);
    if (who.length === 0) {
      unassigned += value;
      unassignedItems.push(item);
      return;
    }
    const n = who.length;
    const base = Math.floor(value / n);
    const rem = value % n;
    const start = idx % n;
    who.forEach((id, k) => {
      const pos = (k - start + n) % n;
      const cents = base + (pos < rem ? 1 : 0);
      consumption.set(id, consumption.get(id)! + cents);
      parts.get(id)!.push({ item, cents, splitBy: n });
    });
    subtotal += value;
  });

  // Arredondamento "meio para cima" só com inteiros.
  const service = Math.floor((subtotal * bill.servicePct + 50) / 100);

  const serviceBy = new Map<string, number>();
  const remainders: { id: string; order: number; frac: number }[] = [];
  let given = 0;
  bill.people.forEach((p, order) => {
    const num = service * consumption.get(p.id)!;
    const q = subtotal > 0 ? Math.floor(num / subtotal) : 0;
    serviceBy.set(p.id, q);
    given += q;
    remainders.push({ id: p.id, order, frac: subtotal > 0 ? num % subtotal : 0 });
  });
  // Maior resto primeiro; empate decidido pela ordem na mesa.
  remainders.sort((a, b) => b.frac - a.frac || a.order - b.order);
  for (let i = 0; i < service - given; i++) {
    const r = remainders[i];
    serviceBy.set(r.id, serviceBy.get(r.id)! + 1);
  }

  const shares = bill.people.map((person) => {
    const c = consumption.get(person.id)!;
    const s = serviceBy.get(person.id)!;
    return { person, consumption: c, service: s, total: c + s, parts: parts.get(person.id)! };
  });

  return { shares, subtotal, service, total: subtotal + service, unassigned, unassignedItems };
}

/** Situação do pagamento de cada pessoa ("quem já pagou"). */
export type PayState = 'payer' | 'paid' | 'partial' | 'open' | 'over';

export interface Payment {
  share: PersonShare;
  state: PayState;
  /** Quanto já pagou. */
  paid: number;
  /** Quanto ainda falta (negativo = pagou a mais). */
  owed: number;
}

export interface PaymentSummary {
  rows: Payment[];
  /** Quantas pessoas já estão quites (quem pagou no caixa conta). */
  paidCount: number;
  /** Quanto ainda falta receber de todo mundo. */
  remaining: number;
}

/**
 * Quem já pagou. Guarda o valor pago (não só "sim/não"): se a conta mudar depois,
 * aparece quanto falta ou quanto foi pago a mais. Quem pagou no caixa já está quite.
 */
export function payments(bill: Bill, result: SplitResult = computeSplit(bill)): PaymentSummary {
  const rows = result.shares.map((share): Payment => {
    const paid = bill.paid?.[share.person.id] ?? 0;
    if (share.person.id === bill.payerId) return { share, state: 'payer', paid: share.total, owed: 0 };
    const owed = share.total - paid;
    const state: PayState = owed === 0 || share.total === 0 ? 'paid' : owed < 0 ? 'over' : paid > 0 ? 'partial' : 'open';
    return { share, state, paid, owed };
  });
  return {
    rows,
    paidCount: rows.filter((r) => r.state !== 'open' && r.state !== 'partial').length,
    remaining: rows.reduce((a, r) => a + Math.max(0, r.owed), 0),
  };
}

/** Remove a pessoa da mesa, de todos os itens e, se for o caso, do pagador. */
export function removePerson(bill: Bill, personId: string): Bill {
  const paid = { ...bill.paid };
  delete paid[personId];
  return {
    ...bill,
    paid,
    people: bill.people.filter((p) => p.id !== personId),
    items: bill.items.map((it) => ({ ...it, who: it.who.filter((id) => id !== personId) })),
    payerId: bill.payerId === personId ? null : bill.payerId,
  };
}

/** Texto pronto para colar no grupo do WhatsApp. */
export function summaryText(bill: Bill, result: SplitResult = computeSplit(bill)): string {
  const title = bill.title.trim();
  const lines: string[] = [];
  lines.push('*Racha Conta*' + (title ? ' - ' + title : ''));
  lines.push(
    'Total: ' +
      formatBRL(result.total) +
      (bill.servicePct ? ` (com ${bill.servicePct}% de serviço)` : ''),
  );
  lines.push('');

  const payer = bill.people.find((p) => p.id === bill.payerId);
  // Marcas de "já pagou" só aparecem quando alguém já foi marcado.
  const tracking = Object.keys(bill.paid ?? {}).length > 0;
  const pay = payments(bill, result);
  for (const { share: s, state, paid, owed } of pay.rows) {
    if (payer && s.person.id === payer.id) continue;
    const name = s.person.name;
    if (tracking && state === 'paid') {
      lines.push(`- ${name}: ${formatBRL(s.total)} ✅ pago`);
    } else if (tracking && state === 'over') {
      lines.push(`- ${name}: ${formatBRL(s.total)} ✅ pago (pagou ${formatBRL(-owed)} a mais, receber de volta)`);
    } else if (tracking && state === 'partial') {
      lines.push(`- ${name} ${payer ? 'deve' : 'falta'} ${formatBRL(owed)} (já pagou ${formatBRL(paid)})`);
    } else if (payer) {
      lines.push(`- ${name} deve ${formatBRL(s.total)}`);
    } else {
      lines.push(`- ${name}: ${formatBRL(s.total)}`);
    }
  }
  if (payer) {
    lines.push('');
    lines.push(`Pagar para *${payer.name}*, que pagou a conta.`);
  }
  if (tracking) {
    lines.push('');
    lines.push(pay.remaining > 0 ? `Falta receber: ${formatBRL(pay.remaining)}` : 'Tudo pago ✅');
  }
  return lines.join('\n');
}

export function whatsappUrl(text: string): string {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}
