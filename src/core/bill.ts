// Modelo da conta e regras de negócio. Sem nenhuma dependência de interface,
// para poder ser testado sozinho e reaproveitado (ex.: app Capacitor depois).

import { formatBRL, splitEven, splitWeighted } from './money';
import { normalName, sameName } from './faces';
import { categoryEmoji } from './noteCategory';
import { accountIn, dropCoverage, minTransfers, netPairs, reconcilePlan, settleUp, type Balances, type PlanRow, type Transfer } from './settle';

export { settleUp, type PlanRow, type Transfer };

/** Acerto direto para quem pagou cada nota, ou com o menor número de Pix. */
export type SettleMode = 'direct' | 'min';

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
  /** Quem paga a parte desta pessoa (o pai paga a da filha). Sem o campo, paga a própria. */
  coveredBy?: string;
  /** Conta do grupo ligada a esta pessoa (quem entrou pelo convite e é ela). */
  userId?: string;
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
  /** Nota fiscal a que o item pertence (só quando a conta tem mais de uma nota). */
  noteId?: string;
}

/** Categorias prontas de nota; a pessoa também pode digitar outra. */
export const NOTE_CATEGORIES = ['Comida', 'Bebidas', 'Doces', 'Mercado', 'Transporte', 'Outros'] as const;
export const MAX_CATEGORY = 24;

/**
 * Uma nota fiscal dentro da conta (ex.: a do bar e a dos doces). Cada nota tem a sua
 * categoria, quem pagou, quem divide, o serviço e a foto. As pessoas são as da conta.
 */
export interface Note {
  id: string;
  /** Categoria (da lista ou digitada). Vazia: "Nota 1", "Nota 2"… */
  category: string;
  servicePct: ServicePct;
  payerId: string | null;
  /** Quem divide esta nota (ids). Item novo começa com essas pessoas marcadas. */
  people: string[];
  /** Quanto cada pessoa já pagou desta nota, em centavos. */
  paid?: Record<string, number>;
  /** Foto da nota guardada no aparelho (IndexedDB), ou null. */
  photoId: string | null;
}

export interface Bill {
  title: string;
  servicePct: ServicePct;
  payerId: string | null;
  people: Person[];
  items: Item[];
  /** Quanto cada pessoa já pagou da parte dela, em centavos (id da pessoa → valor). */
  paid?: Record<string, number>;
  /**
   * Notas fiscais da conta. Sem o campo, a conta é uma nota só e valem serviço, pagador e
   * pagamentos daqui de cima. Com o campo, valem os de cada nota e cada item tem o seu noteId.
   */
  notes?: Note[];
  /** Acertos feitos no resumo do grupo ("Ana pagou R$ 20 à Rebeca"), em centavos. */
  settled?: Transfer[];
  /** Como mostrar o acerto do resumo do grupo. Sem o campo, vale 'direct'. */
  settleMode?: SettleMode;
  /**
   * Contas do grupo que já ganharam o seu lugar na mesa (ligadas a alguém ou adicionadas).
   * Quem está aqui não é adicionado de novo, nem se for tirado da mesa depois.
   */
  joined?: string[];
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

/** Nome da nota para mostrar: a categoria, ou "Nota 2" quando não tem. */
export function noteLabel(note: Note, index: number): string {
  return note.category.trim() || `Nota ${index + 1}`;
}

/** Id da nota de um item (item sem nota, ou de nota que não existe mais, fica na primeira). */
function noteOfItem(notes: Note[], item: Item): string {
  return notes.some((n) => n.id === item.noteId) ? item.noteId! : notes[0].id;
}

/**
 * Uma nota vista como uma conta comum: só os itens dela, só quem divide,
 * e o serviço, o pagador e os pagamentos dela. Sem notas, devolve a própria conta.
 */
export function noteBill(bill: Bill, noteId: string | null): Bill {
  const notes = bill.notes;
  if (!notes?.length) return bill;
  const note = notes.find((n) => n.id === noteId) ?? notes[0];
  // Com várias notas, o título diz qual é ("Festa · Doces"), para a notinha e o resumo.
  const label = notes.length > 1 ? noteLabel(note, notes.indexOf(note)) : '';
  return {
    title: [bill.title.trim(), label].filter(Boolean).join(' · '),
    servicePct: note.servicePct,
    payerId: note.payerId,
    paid: note.paid,
    // Quem pagou aparece mesmo sem dividir (ex.: bancou os doces e não comeu): fica com R$ 0.
    people: bill.people.filter((p) => note.people.includes(p.id) || p.id === note.payerId),
    items: bill.items.filter((i) => noteOfItem(notes, i) === note.id),
  };
}

/**
 * Passa a conta para o modo "várias notas": o que já existe vira a primeira nota.
 * Se já tem notas, devolve como está.
 */
export function withNotes(bill: Bill, firstNoteId: string): Bill {
  if (bill.notes?.length) return bill;
  const note: Note = {
    id: firstNoteId,
    category: '',
    servicePct: bill.servicePct,
    payerId: bill.payerId,
    people: bill.people.map((p) => p.id),
    photoId: null,
    ...(bill.paid && Object.keys(bill.paid).length ? { paid: bill.paid } : {}),
  };
  return {
    ...bill,
    payerId: null,
    paid: undefined,
    notes: [note],
    items: bill.items.map((i) => ({ ...i, noteId: note.id })),
  };
}

/**
 * Calcula quanto cada pessoa paga. Com várias notas, calcula cada nota (com o serviço
 * dela) e soma por pessoa; os itens de cada pessoa vêm na ordem das notas.
 */
export function computeSplit(bill: Bill): SplitResult {
  if (!bill.notes?.length) return splitOne(bill);
  const byNote = bill.notes.map((n) => splitOne(noteBill(bill, n.id)));
  const shares = bill.people.map((person): PersonShare => {
    const share: PersonShare = { person, consumption: 0, service: 0, total: 0, parts: [] };
    for (const r of byNote) {
      const s = r.shares.find((x) => x.person.id === person.id);
      if (!s) continue;
      share.consumption += s.consumption;
      share.service += s.service;
      share.total += s.total;
      share.parts.push(...s.parts);
    }
    return share;
  });
  const sum = (f: (r: SplitResult) => number) => byNote.reduce((t, r) => t + f(r), 0);
  return {
    shares,
    subtotal: sum((r) => r.subtotal),
    service: sum((r) => r.service),
    total: sum((r) => r.total),
    unassigned: sum((r) => r.unassigned),
    unassignedItems: byNote.flatMap((r) => r.unassignedItems),
  };
}

/**
 * Calcula quanto cada pessoa paga numa nota.
 *
 * - Item dividido entre N pessoas: cada uma paga floor(valor / N); os centavos
 *   que sobram vão 1 por pessoa, começando numa posição que gira conforme o
 *   índice do item, para o centavo extra não cair sempre na mesma pessoa.
 * - Serviço total = round(subtotal × % / 100), dividido proporcionalmente ao
 *   consumo pelo método do maior resto.
 * - Garantia: soma dos totais individuais === subtotal + serviço.
 */
function splitOne(bill: Bill): SplitResult {
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
    const split = splitEven(value, n, idx % n);
    who.forEach((id, k) => {
      const cents = split[k];
      consumption.set(id, consumption.get(id)! + cents);
      parts.get(id)!.push({ item, cents, splitBy: n });
    });
    subtotal += value;
  });

  // Arredondamento "meio para cima" só com inteiros.
  const service = Math.floor((subtotal * bill.servicePct + 50) / 100);

  // Maior resto primeiro; empate decidido pela ordem na mesa.
  const serviceSplit = splitWeighted(service, bill.people.map((p) => consumption.get(p.id)!)) ?? bill.people.map(() => 0);
  const serviceBy = new Map(bill.people.map((p, k) => [p.id, serviceSplit[k]]));

  const shares = bill.people.map((person) => {
    const c = consumption.get(person.id)!;
    const s = serviceBy.get(person.id)!;
    return { person, consumption: c, service: s, total: c + s, parts: parts.get(person.id)! };
  });

  return { shares, subtotal, service, total: subtotal + service, unassigned, unassignedItems };
}

/** Situação do pagamento de cada pessoa ("quem já pagou"). */
export type PayState = 'payer' | 'paid' | 'partial' | 'open' | 'over' | 'covered';

export interface Payment {
  share: PersonShare;
  state: PayState;
  /** Quanto já pagou. */
  paid: number;
  /** Quanto ainda falta (negativo = pagou a mais). */
  owed: number;
  /** Quanto a pessoa paga no total: a parte dela mais a de quem ela cobre. */
  due: number;
  /** De quem a pessoa paga a parte (ids), e quanto isso dá. */
  covers: string[];
  coversCents: number;
  /** 'covered': quem paga a parte desta pessoa (ou quem pagou a conta, se é da mesma conta). */
  by?: string;
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
  // Quem paga a parte de quem vale entre as pessoas desta conta (ou desta nota).
  const acc = (id: string) => accountIn(bill.people, id);
  const payerAcc = bill.payerId ? acc(bill.payerId) : null;
  const totalOf = (id: string) => result.shares.find((s) => s.person.id === id)?.total ?? 0;
  const rows = result.shares.map((share): Payment => {
    const id = share.person.id;
    const paid = bill.paid?.[id] ?? 0;
    const none = { covers: [] as string[], coversCents: 0 };
    if (id === bill.payerId) return { share, state: 'payer', paid: share.total, owed: 0, due: share.total, ...none };
    // Na conta de outra pessoa (ou na de quem pagou): não deve nada sozinha.
    if (acc(id) !== id) return { share, state: 'covered', paid, owed: 0, due: 0, ...none, by: acc(id) };
    if (acc(id) === payerAcc) return { share, state: 'covered', paid, owed: 0, due: 0, ...none, by: bill.payerId! };
    const covers = bill.people.filter((p) => p.id !== id && p.id !== bill.payerId && acc(p.id) === id).map((p) => p.id);
    const coversCents = covers.reduce((a, c) => a + totalOf(c) - (bill.paid?.[c] ?? 0), 0);
    const due = share.total + coversCents;
    const owed = due - paid;
    const state: PayState = owed === 0 || due === 0 ? 'paid' : owed < 0 ? 'over' : paid > 0 ? 'partial' : 'open';
    return { share, state, paid, owed, due, covers, coversCents };
  });
  return {
    rows,
    paidCount: rows.filter((r) => r.state !== 'open' && r.state !== 'partial').length,
    remaining: rows.reduce((a, r) => a + Math.max(0, r.owed), 0),
  };
}

/** As notas da conta; a conta de uma nota só vira uma nota com os campos dela (id ""). */
export function notesOf(bill: Bill): Note[] {
  if (bill.notes?.length) return bill.notes;
  return [
    {
      id: '',
      category: '',
      servicePct: bill.servicePct,
      payerId: bill.payerId,
      people: bill.people.map((p) => p.id),
      photoId: null,
      ...(bill.paid ? { paid: bill.paid } : {}),
    },
  ];
}

export interface NoteSummary {
  note: Note;
  label: string;
  result: SplitResult;
  payer: Person | null;
}

export interface GroupSummary {
  notes: NoteSummary[];
  /** Quanto cada pessoa gastou em cada nota (na ordem de `notes`) e no total. */
  people: { person: Person; byNote: number[]; total: number }[];
  total: number;
  /** Saldo de cada pessoa: positivo recebe, negativo paga. Já desconta os acertos. */
  balance: Record<string, number>;
  /** O que ainda falta pagar, no modo escolhido na conta. */
  transfers: Transfer[];
  /**
   * Os pagamentos de cada modo, inclusive os já pagos (ficam na lista, marcados). Quem tem a
   * parte paga por outra pessoa entra na conta dela: as linhas são entre contas.
   */
  plan: Record<SettleMode, PlanRow[]>;
  /** Notas com valor e sem ninguém marcado como pagador (cada um paga a sua parte no caixa). */
  withoutPayer: NoteSummary[];
}

/**
 * Resumo do grupo: soma as notas por pessoa e diz quem paga para quem.
 *
 * - Em cada nota com pagador, cada pessoa deve a ele a sua parte, menos o que já marcou
 *   como pago naquela nota. Nota sem pagador não gera dívida.
 * - As dívidas de todas as notas viram um saldo por pessoa (se a Ana deve 30 à Rebeca e a
 *   Rebeca deve 20 à Ana, fica "Ana paga 10 à Rebeca").
 * - Os acertos feitos no resumo (`settled`) entram no saldo.
 * - Quem mais deve paga para quem mais tem a receber, até zerar (no máximo N-1 transferências).
 */
export function groupSummary(bill: Bill): GroupSummary {
  const notes = notesOf(bill).map((note, i): NoteSummary => ({
    note,
    label: noteLabel(note, i),
    result: computeSplit(noteBill(bill, note.id || null)),
    payer: bill.people.find((p) => p.id === note.payerId) ?? null,
  }));

  const people = bill.people.map((person) => {
    const byNote = notes.map((n) => n.result.shares.find((s) => s.person.id === person.id)?.total ?? 0);
    return { person, byNote, total: byNote.reduce((a, b) => a + b, 0) };
  });

  const ids = bill.people.map((p) => p.id);
  const acc = new Map(ids.map((id) => [id, accountIn(bill.people, id)]));
  const roots = ids.filter((id) => acc.get(id) === id);
  const balance: Balances = Object.fromEntries(ids.map((id) => [id, 0]));
  // Dívidas entre contas, só das notas (sem os acertos), para montar o plano.
  const debts: Transfer[] = [];
  const move = (from: string, to: string, cents: number) => {
    if (!(from in balance) || !(to in balance) || from === to) return;
    balance[from] -= cents;
    balance[to] += cents;
  };
  for (const n of notes) {
    if (!n.payer) continue;
    for (const s of n.result.shares) {
      if (s.person.id === n.payer.id) continue;
      // Deve a parte dele ao pagador, menos o que já pagou (negativo: pagou a mais, recebe de volta).
      const cents = s.total - (n.note.paid?.[s.person.id] ?? 0);
      move(s.person.id, n.payer.id, cents);
      const [f, t] = [acc.get(s.person.id), acc.get(n.payer.id)];
      if (f && t && f !== t && cents !== 0) debts.push(cents > 0 ? { from: f, to: t, cents } : { from: t, to: f, cents: -cents });
    }
  }
  const base: Balances = Object.fromEntries(roots.map((id) => [id, 0]));
  for (const d of debts) {
    base[d.from] -= d.cents;
    base[d.to] += d.cents;
  }
  const paidAcc: Transfer[] = [];
  for (const t of bill.settled ?? []) {
    move(t.to, t.from, t.cents);
    const [f, to] = [acc.get(t.from), acc.get(t.to)];
    if (f && to && f !== to) paidAcc.push({ from: f, to, cents: t.cents });
  }
  const now: Balances = Object.fromEntries(roots.map((id) => [id, 0]));
  for (const id of ids) now[acc.get(id)!] += balance[id];

  const plan: Record<SettleMode, PlanRow[]> = {
    direct: reconcilePlan(netPairs(debts, roots), paidAcc, now, roots),
    min: reconcilePlan(minTransfers(base, roots), paidAcc, now, roots),
  };
  return {
    notes,
    people,
    total: notes.reduce((a, n) => a + n.result.total, 0),
    balance,
    transfers: plan.direct.filter((r) => r.remaining > 0).map((r) => ({ from: r.from, to: r.to, cents: r.remaining })),
    plan,
    withoutPayer: notes.filter((n) => !n.payer && n.result.total > 0),
  };
}

/**
 * Alguém entrou no grupo do rolê: passa a estar na mesa. Já ligada a alguém: nada muda. Senão,
 * liga à única pessoa sem conta com o mesmo nome ("Bia" ↔ "Bia Souza"); sem ninguém assim,
 * entra como pessoa nova (`id`, cor `color`) com o primeiro nome da conta (o nome inteiro, se
 * o primeiro já está na mesa), nas notas que eram de todo mundo, como quem é adicionado à mão.
 * Cada conta uma vez só (`joined`): quem foi tirado depois não volta sozinho.
 */
export function joinPerson(bill: Bill, userId: string, name: string, id: string, color: number): { bill: Bill; added: boolean } {
  const joined = bill.joined ?? [];
  if (joined.includes(userId)) return { bill, added: false };
  const mark = (b: Bill): Bill => ({ ...b, joined: [...joined, userId] });
  if (bill.people.some((p) => p.userId === userId)) return { bill: mark(bill), added: false };
  const clean = name.replace(/\s+/g, ' ').trim();
  const byName = bill.people.filter((p) => !p.userId && sameName(p.name, clean));
  if (byName.length === 1) {
    return { bill: mark({ ...bill, people: bill.people.map((p) => (p.id === byName[0].id ? { ...p, userId } : p)) }), added: false };
  }
  const first = clean.split(' ')[0] ?? '';
  const taken = (n: string) => bill.people.some((p) => normalName(p.name) === normalName(n));
  const label = (first && !taken(first) ? first : clean || 'Convidado').slice(0, MAX_NAME).trim();
  const everyone = bill.people.map((p) => p.id);
  const notes = bill.notes?.map((n) => (everyone.every((pid) => n.people.includes(pid)) ? { ...n, people: [...n.people, id] } : n));
  const person: Person = { id, name: label, color: color % PERSON_COLORS, userId };
  return { bill: mark({ ...bill, people: [...bill.people, person], ...(notes ? { notes } : {}) }), added: true };
}

/** Remove a pessoa da mesa, de todos os itens e, se for o caso, do pagador (também em cada nota). */
export function removePerson(bill: Bill, personId: string): Bill {
  const paid = { ...bill.paid };
  delete paid[personId];
  const notes = bill.notes?.map((n) => {
    const notePaid = { ...n.paid };
    delete notePaid[personId];
    return {
      ...n,
      people: n.people.filter((id) => id !== personId),
      payerId: n.payerId === personId ? null : n.payerId,
      ...(n.paid ? { paid: notePaid } : {}),
    };
  });
  return {
    ...bill,
    ...(notes ? { notes } : {}),
    ...(bill.settled ? { settled: bill.settled.filter((t) => t.from !== personId && t.to !== personId) } : {}),
    paid,
    people: dropCoverage(bill.people.filter((p) => p.id !== personId)),
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
  const nameOf = (id: string) => bill.people.find((p) => p.id === id)?.name ?? 'alguém';
  for (const { share: s, state, paid, owed, due, covers, by } of pay.rows) {
    if (payer && s.person.id === payer.id) continue;
    const name = s.person.name;
    // "Mauricio deve R$ 50,00 (com a parte de Lara)"; "Lara: R$ 20,00, Mauricio paga".
    const name2 = covers.length ? `${name} (com a parte de ${covers.map(nameOf).join(', ')})` : name;
    if (state === 'covered') {
      lines.push(`- ${name}: ${formatBRL(s.total)}, ${by === bill.payerId ? `na conta de ${nameOf(by!)}` : `${nameOf(by!)} paga`}`);
    } else if (tracking && state === 'paid') {
      lines.push(`- ${name2}: ${formatBRL(due)} ✅ pago`);
    } else if (tracking && state === 'over') {
      lines.push(`- ${name2}: ${formatBRL(due)} ✅ pago (pagou ${formatBRL(-owed)} a mais, receber de volta)`);
    } else if (tracking && state === 'partial') {
      lines.push(`- ${name2} ${payer ? 'deve' : 'falta'} ${formatBRL(owed)} (já pagou ${formatBRL(paid)})`);
    } else if (payer) {
      lines.push(`- ${name2} deve ${formatBRL(due)}`);
    } else {
      lines.push(`- ${name2}: ${formatBRL(due)}`);
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

/** Texto do resumo do grupo (várias notas) para colar no WhatsApp. */
export function groupSummaryText(bill: Bill, g: GroupSummary = groupSummary(bill)): string {
  const name = (id: string) => bill.people.find((p) => p.id === id)?.name ?? 'alguém';
  const title = bill.title.trim();
  const lines: string[] = [];
  lines.push('*Racha Conta*' + (title ? ' - ' + title : ''));
  lines.push(`Total: ${formatBRL(g.total)} (${g.notes.length} ${g.notes.length === 1 ? 'nota' : 'notas'})`);
  lines.push('');

  lines.push('*Notas*');
  for (const n of g.notes) {
    lines.push(`${categoryEmoji(n.note.category)} ${n.label}: ${formatBRL(n.result.total)}` + (n.payer ? ` · pago por ${n.payer.name}` : ' · sem quem pagou'));
  }
  lines.push('');

  lines.push('*Quanto cada um gastou*');
  for (const p of g.people) {
    const parts = g.notes.map((n, i) => (p.byNote[i] > 0 ? `${n.label} ${formatBRL(p.byNote[i])}` : '')).filter(Boolean);
    lines.push(`- ${p.person.name}: ${formatBRL(p.total)}` + (parts.length > 1 ? ` (${parts.join(' · ')})` : ''));
  }

  const rows = g.plan.direct;
  // A conta de quem paga por outras pessoas: "Mauricio (com Lara)".
  const account = (id: string) => {
    const with_ = bill.people.filter((p) => p.id !== id && accountIn(bill.people, p.id) === id).map((p) => p.name);
    return with_.length ? `${name(id)} (com ${with_.join(', ')})` : name(id);
  };
  if (rows.length || g.notes.some((n) => n.payer)) {
    lines.push('');
    lines.push('*Quem paga para quem*');
    for (const r of rows) {
      if (r.remaining === 0) lines.push(`- ${account(r.from)} pagou ${formatBRL(r.cents)} a ${name(r.to)} ✅`);
      else if (r.paid > 0) lines.push(`- ${account(r.from)} paga ${formatBRL(r.remaining)} para ${name(r.to)} (já pagou ${formatBRL(r.paid)})`);
      else lines.push(`- ${account(r.from)} paga ${formatBRL(r.cents)} para ${name(r.to)}`);
    }
    if (!g.transfers.length) lines.push('Tudo acertado ✅');
  }
  for (const n of g.withoutPayer) {
    lines.push('');
    lines.push(`${n.label} está sem quem pagou: cada um paga a sua parte no caixa.`);
  }
  return lines.join('\n');
}
