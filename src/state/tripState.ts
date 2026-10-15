// Viagens guardadas no aparelho (modo solo): a lista de viagens, qual está aberta e quem
// é a pessoa deste aparelho em cada uma. Os cálculos ficam em core/trip.ts.

import { formatBRL } from '../core/money';
import { MAX_NAME, PERSON_COLORS } from '../core/bill';
import {
  addExpense,
  addSettlement,
  canCover,
  MAX_DESCRIPTION,
  MAX_TRIP_NAME,
  MAX_INSTALLMENTS,
  MAX_WEIGHT,
  mergeTraveler,
  installmentsOf,
  joinTraveler,
  newTrip,
  payFor,
  removeTraveler,
  setExpenseDeleted,
  setExpenseSettled,
  TRIP_CATEGORIES,
  transferTraveler,
  updateExpense,
  type Expense,
  type ExpenseInput,
  type SettleMode,
  type Traveler,
  type Trip,
  type TripCategory,
  type TripLogEntry,
} from '../core/trip';

export const TRIPS_KEY = 'racha-viagem-v1';

export interface TripsState {
  trips: Trip[];
  /** Viagem aberta; null mostra a lista de viagens. */
  openId: string | null;
  /** Quem é a pessoa deste aparelho em cada viagem (id da viagem → id do participante). */
  me: Record<string, string>;
  /** Viagens compartilhadas (id da viagem → grupo no Supabase e o que falta enviar). */
  sync?: Record<string, SyncEntry>;
  /** Nome da conta deste aparelho: vai como "quem fez" no registro das viagens compartilhadas. */
  author?: string | null;
}

/**
 * Viagem compartilhada: `base` é a última versão salva no grupo; `pending`, as mudanças feitas
 * aqui que ainda não foram enviadas (a viagem na tela = `pending` aplicadas sobre `base`).
 * Sem internet, elas esperam na fila e vão quando a conexão voltar.
 */
export interface SyncEntry {
  groupId: string;
  code: string;
  version: number;
  base: Trip;
  pending: TripAction[];
}

export type TripAction =
  | { type: 'createTrip'; id: string; name: string; start?: string; end?: string; meName?: string; meId?: string }
  | { type: 'openTrip'; id: string | null }
  | { type: 'editTrip'; name?: string; start?: string | null; end?: string | null; categoryNames?: Partial<Record<TripCategory, string>>; settleMode?: SettleMode; photoId?: string | null }
  | { type: 'deleteTrip'; id: string }
  | { type: 'addTraveler'; id: string; name: string; weight?: number }
  /** coveredBy: quem paga a parte dela (null: ela mesma). */
  | { type: 'editTraveler'; id: string; name?: string; weight?: number; coveredBy?: string | null }
  /** Remove a pessoa. Se ela tem despesas, `to` diz para quem elas passam. */
  | { type: 'removeTraveler'; id: string; to?: string }
  /** Passa para `to` tudo o que está no nome de `from` (despesas, partes, acertos); `from` fica na viagem. */
  | { type: 'transferTraveler'; from: string; to: string }
  /**
   * Alguém entrou no grupo: passa a participar da viagem (ver joinTraveler). `id` é o da pessoa
   * nova, se precisar criar; `prefer`, a pessoa que ela escolheu ser (se estiver livre); `self`:
   * é a conta deste aparelho (vira o "sou eu"); `claim`: a escolha foi dela mesma, e vale mesmo
   * que outro aparelho já a tenha posto como pessoa nova (ainda sem nada no nome); `auto`: quem
   * pôs foi outro aparelho (a pessoa ainda não escolheu quem é).
   */
  | { type: 'joinTraveler'; tripId: string; userId: string; name: string; id: string; prefer?: string; self?: boolean; claim?: boolean; auto?: boolean }
  /** "Você paga a parte de alguém?": `by` paga a parte de `ids` na viagem toda (ver payFor). */
  | { type: 'payFor'; tripId: string; userId: string; by: string; ids: string[] }
  | { type: 'setMe'; id: string | null }
  | { type: 'addExpense'; id: string; input: ExpenseInput }
  | { type: 'editExpense'; id: string; input: ExpenseInput }
  | { type: 'deleteExpense'; id: string; deleted: boolean }
  /** "Todos pagos": a despesa sai (ou volta) do painel de acerto. */
  | { type: 'settleExpense'; id: string; settled: boolean }
  | { type: 'settle'; id: string; from: string; to: string; cents: number; expenseId?: string }
  | { type: 'unsettle'; id: string }
  // ---- compartilhamento (só o app manda; não entram no registro) ----
  /** A viagem aberta virou um grupo (acabou de ser compartilhada). */
  | { type: 'syncLink'; tripId: string; groupId: string; code: string; version: number }
  /** Chegou do grupo uma versão mais nova (de outra pessoa ou buscada de novo). */
  | { type: 'syncRemote'; tripId: string; trip: Trip; version: number; code?: string }
  /** As primeiras `count` mudanças da fila foram salvas no grupo como `sent`. */
  | { type: 'syncSaved'; tripId: string; version: number; count: number; sent: Trip }
  /** Entrou num grupo pelo convite: a viagem chega e abre. */
  | { type: 'syncJoin'; groupId: string; code: string; version: number; trip: Trip; meId?: string }
  /**
   * As viagens dos grupos da conta (em qualquer aparelho em que ela entrar): as que faltam
   * aparecem na lista, as que já estão ficam em dia, e as excluídas pela pessoa (`hidden`,
   * ids de grupo) saem. Não muda a viagem aberta, a não ser que ela tenha sido excluída.
   */
  | { type: 'syncAdopt'; groups: { groupId: string; code: string; version: number; trip: Trip }[]; hidden: string[] }
  /** Perdeu o acesso ao grupo (ou saiu): a viagem fica só neste aparelho. */
  | { type: 'syncUnlink'; tripId: string }
  | { type: 'setAuthor'; name: string | null };

/** Ações que só mexem neste aparelho (não vão para o grupo). */
const LOCAL_ONLY = new Set<TripAction['type']>(['createTrip', 'openTrip', 'deleteTrip', 'setMe', 'syncLink', 'syncRemote', 'syncSaved', 'syncJoin', 'syncAdopt', 'syncUnlink', 'setAuthor']);

export const blankTrips = (): TripsState => ({ trips: [], openId: null, me: {} });

export const cleanName = (s: string, max = MAX_NAME) => s.replace(/\s+/g, ' ').trim().slice(0, max);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const cleanDate = (s: string | null | undefined) => (s && DATE.test(s) ? s : undefined);

/** Hoje no relógio do aparelho, "AAAA-MM-DD". */
export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Primeira cor ainda não usada na viagem (depois, volta a repetir). */
function nextColor(trip: Trip): number {
  const used = new Set(trip.people.map((p) => p.color));
  for (let c = 0; c < PERSON_COLORS; c++) if (!used.has(c)) return c;
  return trip.people.length % PERSON_COLORS;
}

export const openTrip = (s: TripsState) => s.trips.find((t) => t.id === s.openId) ?? null;

/**
 * Quem é a pessoa deste aparelho na viagem: o "sou eu" guardado (se ela ainda está na viagem)
 * ou a pessoa ligada à conta logada.
 */
export function meOf(s: TripsState, trip: Trip, userId: string | null): string | null {
  const saved = s.me[trip.id];
  if (saved && trip.people.some((p) => p.id === saved)) return saved;
  return (userId && trip.people.find((p) => p.userId === userId)?.id) || null;
}

/** Aplica uma mudança na viagem aberta. */
function onOpen(s: TripsState, change: (t: Trip) => Trip | null): TripsState {
  const trip = openTrip(s);
  if (!trip) return s;
  const next = change(trip);
  if (!next || next === trip) return s;
  return { ...s, trips: s.trips.map((t) => (t.id === trip.id ? next : t)) };
}

const now = () => new Date().toISOString();

const MAX_LOG = 300;

/** O que mudou, em uma frase, para o registro. Ações sem efeito na viagem não entram. */
function describe(before: Trip, after: Trip, a: TripAction): string | null {
  const who = (t: Trip, id: string) => t.people.find((p) => p.id === id)?.name ?? '?';
  const exp = (t: Trip, id: string) => t.expenses.find((e) => e.id === id);
  switch (a.type) {
    case 'editTrip': {
      if (after.name !== before.name) return `Renomeou a viagem para ${after.name}`;
      if (after.start !== before.start || after.end !== before.end) return 'Mudou as datas da viagem';
      if (JSON.stringify(after.categoryNames ?? {}) !== JSON.stringify(before.categoryNames ?? {})) return 'Mudou o nome de uma categoria';
      if (after.photoId !== before.photoId) return !after.photoId ? 'Tirou a foto da viagem' : before.photoId ? 'Trocou a foto da viagem' : 'Adicionou a foto da viagem';
      return null;
    }
    case 'addTraveler':
      return `Adicionou ${who(after, a.id)}`;
    case 'editTraveler': {
      const b = before.people.find((p) => p.id === a.id);
      const n = after.people.find((p) => p.id === a.id);
      if (!b || !n) return null;
      if (b.name !== n.name) return `Renomeou ${b.name} para ${n.name}`;
      if (b.coveredBy !== n.coveredBy) {
        return n.coveredBy ? `${who(after, n.coveredBy)} paga a parte de ${n.name} na viagem toda` : `${n.name} volta a pagar a própria parte`;
      }
      return null;
    }
    case 'transferTraveler':
      return `Passou para ${who(after, a.to)} as despesas de ${who(after, a.from)}`;
    case 'joinTraveler': {
      const n = after.people.find((p) => p.userId === a.userId);
      if (!n) return null;
      return before.people.some((p) => p.id === n.id) ? `${a.name} entrou no grupo como ${n.name}` : `${n.name} entrou na viagem`;
    }
    case 'payFor': {
      const now = after.people.filter((p) => p.coveredBy === a.by && before.people.find((b) => b.id === p.id)?.coveredBy !== a.by);
      if (!now.length) return null;
      const names = now.map((p) => p.name);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names.at(-1)}` : names[0];
      return `${who(after, a.by)} paga a parte de ${list} na viagem toda`;
    }
    case 'removeTraveler':
      return a.to ? `Tirou ${who(before, a.id)} (as despesas passaram para ${who(after, a.to)})` : `Tirou ${who(before, a.id)}`;
    case 'addExpense': {
      const e = exp(after, a.id);
      return e ? `Lançou ${e.description} · ${formatBRL(e.cents)}, pago por ${who(after, e.payerId)}` : null;
    }
    case 'editExpense': {
      const [b, e] = [exp(before, a.id), exp(after, a.id)];
      if (!b || !e) return null;
      if (b.cents !== e.cents) return `Editou ${e.description}: ${formatBRL(b.cents)} → ${formatBRL(e.cents)}`;
      if (!b.receipt && e.receipt) return `Adicionou a nota fiscal de ${e.description}`;
      if (b.receipt && !e.receipt) return `Tirou a nota fiscal de ${e.description}`;
      return `Editou ${e.description}`;
    }
    case 'deleteExpense': {
      const e = exp(after, a.id);
      return e ? (a.deleted ? `Excluiu ${e.description}` : `Desfez a exclusão de ${e.description}`) : null;
    }
    case 'settleExpense': {
      const e = exp(after, a.id);
      return e ? (a.settled ? `Marcou ${e.description}: todos pagos` : `${e.description} voltou para o acerto`) : null;
    }
    case 'settle':
      return `${who(after, a.from)} pagou ${formatBRL(a.cents)} para ${who(after, a.to)}`;
    case 'unsettle': {
      const x = before.settlements.find((y) => y.id === a.id);
      return x ? `Desmarcou: ${who(before, x.from)} pagou ${formatBRL(x.cents)} para ${who(before, x.to)}` : null;
    }
    default:
      return null;
  }
}

/**
 * Aplica a ação e, se a viagem aberta mudou, anota no registro dela. Na viagem compartilhada,
 * a mudança também entra na fila para ir ao grupo, e o registro leva o nome de quem fez.
 */
export function tripsReducer(s: TripsState, a: TripAction): TripsState {
  const sync = syncReducer(s, a);
  if (sync) return sync;
  const open = openTrip(s);
  const entry = open ? s.sync?.[open.id] : undefined;
  const after = reduceAs(s, a, entry ? s.author ?? null : null);
  if (!entry || after === s || LOCAL_ONLY.has(a.type) || openTrip(after) === open) return after;
  return { ...after, sync: { ...s.sync, [open!.id]: { ...entry, pending: [...entry.pending, a] } } };
}

/** Aplica a fila sobre a viagem (o mesmo que aconteceu na tela, de novo, sobre a versão do grupo). */
export function replay(trip: Trip, actions: TripAction[], by: string | null): Trip {
  let s: TripsState = { trips: [trip], openId: trip.id, me: {} };
  for (const a of actions) s = reduceAs(s, a, by);
  return s.trips[0];
}

function syncReducer(s: TripsState, a: TripAction): TripsState | null {
  const put = (trip: Trip, entry: SyncEntry | null) => {
    const sync = { ...s.sync };
    if (entry) sync[trip.id] = entry;
    else delete sync[trip.id];
    const has = s.trips.some((t) => t.id === trip.id);
    return { ...s, trips: has ? s.trips.map((t) => (t.id === trip.id ? trip : t)) : [trip, ...s.trips], sync };
  };
  switch (a.type) {
    case 'setAuthor':
      return { ...s, author: a.name };
    case 'syncLink': {
      const trip = s.trips.find((t) => t.id === a.tripId);
      return trip ? put(trip, { groupId: a.groupId, code: a.code, version: a.version, base: trip, pending: [] }) : s;
    }
    case 'syncRemote': {
      const entry = s.sync?.[a.tripId];
      if (!entry || a.version <= entry.version || a.trip.id !== a.tripId) return s;
      const local = replay(a.trip, entry.pending, s.author ?? null);
      return put(local, { ...entry, version: a.version, base: a.trip, code: a.code || entry.code });
    }
    case 'syncSaved': {
      const entry = s.sync?.[a.tripId];
      if (!entry) return s;
      return { ...s, sync: { ...s.sync, [a.tripId]: { ...entry, version: a.version, base: a.sent, pending: entry.pending.slice(a.count) } } };
    }
    case 'syncJoin': {
      const old = s.sync?.[a.trip.id];
      const next = put(a.trip, { groupId: a.groupId, code: a.code, version: a.version, base: a.trip, pending: old?.pending ?? [] });
      const me = a.meId && a.trip.people.some((p) => p.id === a.meId) ? { ...s.me, [a.trip.id]: a.meId } : s.me;
      return { ...next, openId: a.trip.id, me };
    }
    case 'syncUnlink': {
      const trip = s.trips.find((t) => t.id === a.tripId);
      return trip ? put(trip, null) : s;
    }
    case 'syncAdopt':
      return adopt(s, a.groups, new Set(a.hidden));
    default:
      return null;
  }
}

/** Ver a ação syncAdopt. */
function adopt(s: TripsState, groups: { groupId: string; code: string; version: number; trip: Trip }[], hidden: Set<string>): TripsState {
  let next = s;
  // Excluídas pela pessoa (em qualquer aparelho): saem daqui também.
  for (const [tripId, e] of Object.entries(s.sync ?? {})) {
    if (hidden.has(e.groupId)) next = applyTrip(next, { type: 'deleteTrip', id: tripId });
  }
  for (const g of groups) {
    if (hidden.has(g.groupId) || !isValidTrip(g.trip)) continue;
    const linked = Object.entries(next.sync ?? {}).find(([, e]) => e.groupId === g.groupId);
    if (linked) {
      // Já está aqui: só põe em dia (a fila deste aparelho é refeita por cima).
      next = syncReducer(next, { type: 'syncRemote', tripId: linked[0], trip: g.trip, version: g.version, code: g.code }) ?? next;
      continue;
    }
    // A mesma viagem já ligada a outro grupo (compartilhada duas vezes): fica a que já está.
    if (next.sync?.[g.trip.id]) continue;
    // Falta (ou estava só neste aparelho, solta do grupo): a versão do grupo vale.
    const has = next.trips.some((t) => t.id === g.trip.id);
    next = {
      ...next,
      trips: has ? next.trips.map((t) => (t.id === g.trip.id ? g.trip : t)) : [...next.trips, g.trip],
      sync: { ...next.sync, [g.trip.id]: { groupId: g.groupId, code: g.code, version: g.version, base: g.trip, pending: [] } },
    };
  }
  return next;
}

/** O mesmo, com o nome de quem fez (viagem compartilhada). */
export function reduceAs(s: TripsState, a: TripAction, by: string | null): TripsState {
  const after = applyTrip(s, a);
  if (after === s || a.type === 'createTrip' || a.type === 'openTrip' || a.type === 'deleteTrip' || a.type === 'setMe') return after;
  const [before, next] = [openTrip(s), openTrip(after)];
  if (!before || !next || before === next) return after;
  const text = describe(before, next, a);
  if (!text) return after;
  const entry: TripLogEntry = { at: Date.now(), by, kind: a.type, text };
  const logged = { ...next, log: [...(next.log ?? []), entry].slice(-MAX_LOG) };
  return { ...after, trips: after.trips.map((t) => (t.id === logged.id ? logged : t)) };
}

function applyTrip(s: TripsState, a: TripAction): TripsState {
  switch (a.type) {
    case 'createTrip': {
      let trip: Trip = { ...newTrip(a.id, cleanName(a.name, MAX_TRIP_NAME) || 'Viagem') };
      const start = cleanDate(a.start);
      const end = cleanDate(a.end);
      if (start) trip.start = start;
      if (end) trip.end = end;
      const me = a.meName ? cleanName(a.meName) : '';
      const meId = a.meId ?? `${a.id}-eu`;
      if (me) trip = { ...trip, people: [{ id: meId, name: me, color: 0, weight: 1 }] };
      // Mantém o resto (as outras viagens continuam ligadas aos grupos delas).
      return { ...s, trips: [trip, ...s.trips], openId: trip.id, me: me ? { ...s.me, [trip.id]: meId } : s.me };
    }
    case 'openTrip':
      return a.id === null || s.trips.some((t) => t.id === a.id) ? { ...s, openId: a.id } : s;
    case 'editTrip':
      return onOpen(s, (t) => {
        const next: Trip = { ...t };
        if (a.name !== undefined) next.name = cleanName(a.name, MAX_TRIP_NAME) || t.name;
        for (const key of ['start', 'end'] as const) {
          if (a[key] === undefined) continue;
          const d = cleanDate(a[key]);
          if (d) next[key] = d;
          else delete next[key];
        }
        if (a.categoryNames) {
          const names: Partial<Record<TripCategory, string>> = {};
          for (const c of TRIP_CATEGORIES) {
            const n = cleanName(a.categoryNames[c.id] ?? '', MAX_NAME);
            if (n && n !== c.label) names[c.id] = n;
          }
          if (Object.keys(names).length) next.categoryNames = names;
          else delete next.categoryNames;
        }
        if (a.settleMode === 'min') next.settleMode = 'min';
        else if (a.settleMode === 'direct') delete next.settleMode;
        if (a.photoId !== undefined) {
          if (a.photoId && PHOTO_ID.test(a.photoId)) next.photoId = a.photoId;
          else delete next.photoId;
        }
        return next;
      });
    case 'deleteTrip': {
      const me = { ...s.me };
      delete me[a.id];
      const next: TripsState = { ...s, trips: s.trips.filter((t) => t.id !== a.id), openId: s.openId === a.id ? null : s.openId, me };
      if (s.sync?.[a.id]) {
        const sync = { ...s.sync };
        delete sync[a.id];
        if (Object.keys(sync).length) next.sync = sync;
        else delete next.sync;
      }
      return next;
    }
    case 'addTraveler': {
      const name = cleanName(a.name);
      if (!name) return s;
      const weight = validWeight(a.weight) ? a.weight! : 1;
      return onOpen(s, (t) => ({ ...t, people: [...t.people, { id: a.id, name, color: nextColor(t), weight }] }));
    }
    case 'editTraveler':
      return onOpen(s, (t) => ({
        ...t,
        people: t.people.map((p) => {
          if (p.id !== a.id) return p;
          const name = a.name === undefined ? p.name : cleanName(a.name) || p.name;
          const weight = validWeight(a.weight) ? a.weight! : p.weight;
          const next: Traveler = { ...p, name, weight };
          if (a.coveredBy === null) delete next.coveredBy;
          else if (a.coveredBy !== undefined && canCover(t, p.id, a.coveredBy)) next.coveredBy = a.coveredBy;
          return next;
        }),
      }));
    case 'removeTraveler': {
      const next = onOpen(s, (t) => {
        const r = a.to ? mergeTraveler(t, a.id, a.to) : removeTraveler(t, a.id);
        return r.ok ? r.trip : null;
      });
      // Se era a pessoa deste aparelho, quem recebeu as despesas passa a ser.
      const tripId = s.openId;
      if (next === s || !tripId || s.me[tripId] !== a.id) return next;
      const me = { ...next.me };
      if (a.to) me[tripId] = a.to;
      else delete me[tripId];
      return { ...next, me };
    }
    case 'transferTraveler':
      return onOpen(s, (t) => {
        const r = transferTraveler(t, a.from, a.to);
        return r.ok ? r.trip : null;
      });
    case 'joinTraveler': {
      const trip = openTrip(s);
      if (!trip || trip.id !== a.tripId || !a.userId) return s;
      const r = joinTraveler(trip, a.userId, cleanName(a.name, 60), a.id, a.prefer, !!a.claim, !!a.auto);
      if (r.trip === trip && !(a.self && r.id && s.me[trip.id] !== r.id)) return s;
      const next = r.trip === trip ? s : { ...s, trips: s.trips.map((t) => (t.id === trip.id ? r.trip : t)) };
      return a.self && r.id ? { ...next, me: { ...next.me, [trip.id]: r.id } } : next;
    }
    case 'payFor': {
      const trip = openTrip(s);
      if (!trip || trip.id !== a.tripId || !a.userId) return s;
      const next = payFor(trip, a.by, a.ids, a.userId);
      return next === trip ? s : { ...s, trips: s.trips.map((t) => (t.id === trip.id ? next : t)) };
    }
    case 'setMe': {
      const trip = openTrip(s);
      if (!trip) return s;
      const me = { ...s.me };
      if (a.id && trip.people.some((p) => p.id === a.id)) me[trip.id] = a.id;
      else delete me[trip.id];
      return { ...s, me };
    }
    case 'addExpense':
      return onOpen(s, (t) => {
        const r = addExpense(t, cleanInput(a.input), a.id, now());
        return r.ok ? r.trip : null;
      });
    case 'editExpense':
      return onOpen(s, (t) => {
        const r = updateExpense(t, a.id, cleanInput(a.input), now());
        return r.ok ? r.trip : null;
      });
    case 'deleteExpense':
      return onOpen(s, (t) => setExpenseDeleted(t, a.id, a.deleted, now()));
    case 'settleExpense':
      return onOpen(s, (t) => setExpenseSettled(t, a.id, a.settled, now()));
    case 'settle':
      return onOpen(s, (t) => {
        const r = addSettlement(t, { from: a.from, to: a.to, cents: a.cents, expenseId: a.expenseId }, a.id, now());
        return r.ok ? r.trip : null;
      });
    case 'unsettle':
      return onOpen(s, (t) => ({ ...t, settlements: t.settlements.filter((x) => x.id !== a.id) }));
    default:
      return s;
  }
}

function validWeight(w: number | undefined): boolean {
  return typeof w === 'number' && Number.isFinite(w) && w >= 0 && w <= MAX_WEIGHT && Math.round(w * 100) === w * 100;
}

function cleanInput(input: ExpenseInput): ExpenseInput {
  const out: ExpenseInput = { ...input, description: cleanName(input.description, MAX_DESCRIPTION) };
  if (input.split !== 'exact') delete out.exact;
  if (installmentsOf(input) === 1) delete out.installments;
  if (!out.coveredBy || !Object.keys(out.coveredBy).length) delete out.coveredBy;
  if (!out.receipt) delete out.receipt;
  return out;
}

// ---------- guardar e ler ----------

const isStr = (v: unknown): v is string => typeof v === 'string';
/** Nome de foto aceito (vira nome de arquivo na pasta do grupo: nada de "/" ou "..") */
const PHOTO_ID = /^[a-z0-9]{6,40}$/;
const isInt = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const CATEGORY_IDS = new Set<string>(TRIP_CATEGORIES.map((c) => c.id));

function isValidExpense(e: unknown): e is Expense {
  if (!isObj(e)) return false;
  return (
    isStr(e.id) && isStr(e.description) && isInt(e.cents, 1) && isStr(e.date) && DATE.test(e.date) &&
    isStr(e.category) && CATEGORY_IDS.has(e.category) && isStr(e.payerId) &&
    (e.split === 'equal' || e.split === 'weight' || e.split === 'exact') &&
    Array.isArray(e.people) && e.people.every(isStr) &&
    (e.exact === undefined || (isObj(e.exact) && Object.values(e.exact).every((c) => isInt(c)))) &&
    isObj(e.shares) && Object.values(e.shares).every((c) => isInt(c)) &&
    isInt(e.seq) && isStr(e.createdAt) && (e.updatedAt === undefined || isStr(e.updatedAt)) &&
    (e.deleted === undefined || e.deleted === true) &&
    (e.settled === undefined || e.settled === true) &&
    (e.installments === undefined || (isInt(e.installments, 2) && (e.installments as number) <= MAX_INSTALLMENTS)) &&
    (e.coveredBy === undefined || (isObj(e.coveredBy) && Object.values(e.coveredBy).every(isStr))) &&
    (e.receipt === undefined || (isStr(e.receipt) && PHOTO_ID.test(e.receipt)))
  );
}

export function isValidTrip(t: unknown): t is Trip {
  if (!isObj(t)) return false;
  return (
    isStr(t.id) && isStr(t.name) && t.currency === 'BRL' &&
    (t.start === undefined || (isStr(t.start) && DATE.test(t.start))) &&
    (t.end === undefined || (isStr(t.end) && DATE.test(t.end))) &&
    Array.isArray(t.people) &&
    t.people.every((p) => isObj(p) && isStr(p.id) && isStr(p.name) && isInt(p.color) && validWeight(p.weight as number) && (p.coveredBy === undefined || isStr(p.coveredBy)) && (p.userId === undefined || isStr(p.userId)) && (p.auto === undefined || p.auto === true)) &&
    Array.isArray(t.expenses) && t.expenses.every(isValidExpense) &&
    Array.isArray(t.settlements) &&
    t.settlements.every((x) => isObj(x) && isStr(x.id) && isStr(x.from) && isStr(x.to) && isInt(x.cents, 1) && isStr(x.at) && (x.expenseId === undefined || isStr(x.expenseId)) && (x.expenseIds === undefined || (Array.isArray(x.expenseIds) && x.expenseIds.every(isStr)))) &&
    isInt(t.nextSeq) &&
    (t.settleMode === undefined || t.settleMode === 'direct' || t.settleMode === 'min') &&
    (t.categoryNames === undefined || (isObj(t.categoryNames) && Object.values(t.categoryNames).every(isStr))) &&
    (t.photoId === undefined || (isStr(t.photoId) && PHOTO_ID.test(t.photoId))) &&
    (t.joined === undefined || (Array.isArray(t.joined) && t.joined.every(isStr))) &&
    (t.payAsked === undefined || (Array.isArray(t.payAsked) && t.payAsked.every(isStr))) &&
    (t.log === undefined || (Array.isArray(t.log) && t.log.every((e) => isObj(e) && typeof e.at === 'number' && isStr(e.text))))
  );
}

/** Lê as viagens guardadas. Uma viagem estragada é deixada de fora, sem levar as outras junto. */
export function loadTrips(): TripsState {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    if (!raw) return blankTrips();
    const parsed: unknown = JSON.parse(raw);
    if (!isObj(parsed) || !Array.isArray(parsed.trips)) return blankTrips();
    const trips = parsed.trips.filter(isValidTrip);
    const openId = isStr(parsed.openId) && trips.some((t) => t.id === parsed.openId) ? parsed.openId : null;
    const me: Record<string, string> = {};
    if (isObj(parsed.me)) {
      for (const t of trips) {
        const id = parsed.me[t.id];
        if (isStr(id) && t.people.some((p) => p.id === id)) me[t.id] = id;
      }
    }
    const sync: Record<string, SyncEntry> = {};
    if (isObj(parsed.sync)) {
      for (const t of trips) {
        const e = parsed.sync[t.id];
        if (isObj(e) && isStr(e.groupId) && isStr(e.code) && isInt(e.version) && isValidTrip(e.base) && Array.isArray(e.pending)) {
          sync[t.id] = { groupId: e.groupId, code: e.code, version: e.version, base: e.base, pending: e.pending.filter((x): x is TripAction => isObj(x) && isStr(x.type)) };
        }
      }
    }
    return {
      trips,
      openId,
      me,
      ...(Object.keys(sync).length ? { sync } : {}),
      ...(isStr(parsed.author) ? { author: parsed.author } : {}),
    };
  } catch {
    return blankTrips();
  }
}

export function saveTrips(s: TripsState): void {
  try {
    localStorage.setItem(TRIPS_KEY, JSON.stringify(s));
  } catch {
    /* sem espaço ou modo privado: segue sem guardar */
  }
}
