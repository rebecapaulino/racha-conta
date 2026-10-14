// O motor da viagem compartilhada, sem React: enviar a fila, buscar a versão do grupo,
// entrar pelo convite e pôr na viagem quem entrou no grupo. O useTripSync só chama estas
// funções e despacha o que elas devolvem; os testes usam um servidor de mentira no lugar do Supabase.

import { canRemoveTraveler, freeTravelers, type Traveler, type Trip } from '../core/trip';
import { sameNameIds } from '../core/faces';
import { isValidTrip, type TripAction, type TripsState } from '../state/tripState';
import type { Member, MyGroup, RemoteTrip } from './groups';

/** O que o motor precisa do servidor (no app, as funções de sync/groups.ts). */
export interface TripApi {
  save(groupId: string, trip: Trip, base: number): Promise<number>;
  fetch(groupId: string): Promise<RemoteTrip | null>;
  join(code: string, name: string, photo: string | null): Promise<string>;
}

export const NO_ACCESS = 'O grupo não respondeu para esta conta (sem acesso ou sessão expirada). A viagem continua ligada; tente Atualizar agora.';
export const UNKNOWN_DATA = 'A versão do grupo veio com algum dado que o app não reconhece.';

export interface Step {
  action: TripAction | null;
  error?: string;
}

/**
 * Envia a fila de uma viagem. Salvou: devolve o "syncSaved". Outra pessoa salvou antes: busca
 * a versão dela e devolve o "syncRemote" (a fila é refeita por cima e vai na próxima vez).
 * Erro de rede: lança (quem chama tenta de novo depois).
 */
export async function pushTrip(api: TripApi, state: Pick<TripsState, 'sync' | 'trips'>, tripId: string): Promise<Step> {
  const entry = state.sync?.[tripId];
  const trip = state.trips.find((t) => t.id === tripId);
  if (!entry || !trip || entry.pending.length === 0) return { action: null };
  const count = entry.pending.length;
  const version = await api.save(entry.groupId, trip, entry.version);
  if (version > 0) return { action: { type: 'syncSaved', tripId, version, count, sent: trip } };
  return pullTrip(api, entry.groupId, tripId);
}

/** Busca a viagem no grupo. */
export async function pullTrip(api: TripApi, groupId: string, tripId: string): Promise<Step> {
  const remote = await api.fetch(groupId);
  if (!remote) return { action: null, error: NO_ACCESS };
  if (!isValidTrip(remote.trip)) return { action: null, error: UNKNOWN_DATA };
  return { action: { type: 'syncRemote', tripId, trip: remote.trip, version: remote.version, code: remote.code } };
}

export interface JoinAccount {
  id: string;
  name: string;
  photo: string | null;
}

/**
 * Entra no grupo pelo convite: a viagem chega e abre neste aparelho. Quem a pessoa é na viagem
 * ela escolhe em seguida ("Quem é você nesta viagem?", ver selfJoin).
 */
export async function joinByInvite(api: TripApi, code: string, account: JoinAccount): Promise<{ actions: TripAction[]; trip: Trip }> {
  const groupId = await api.join(code, account.name, account.photo);
  const remote = await api.fetch(groupId);
  if (!remote || !isValidTrip(remote.trip)) throw new Error('viagem inválida');
  return { trip: remote.trip, actions: [{ type: 'syncJoin', groupId, code: remote.code, version: remote.version, trip: remote.trip }] };
}

/** Quanto tempo quem entrou tem para dizer quem é, antes de outro aparelho pô-la como pessoa nova. */
export const CHOOSE_MS = 10 * 60 * 1000;

/**
 * Quem está no grupo e ainda não ganhou o seu lugar na viagem: os outros aparelhos põem como
 * pessoa nova (nunca ligam pelo nome), mas só depois de `CHOOSE_MS` (antes disso, a própria
 * pessoa está escolhendo quem é). Não entram aqui: a conta deste aparelho (ver selfJoin) e quem
 * criou o grupo (já está na viagem, e só o aparelho dele sabe com qual nome).
 */
export function memberActions(trip: Trip, members: Member[], accountId: string | null, newId: () => string, now = Date.now()): TripAction[] {
  const joined = new Set(trip.joined ?? []);
  return members
    .filter((m) => m.userId !== accountId && m.role !== 'owner' && !joined.has(m.userId))
    .filter((m) => !m.joinedAt || now - Date.parse(m.joinedAt) >= CHOOSE_MS)
    .map((m): TripAction => ({ type: 'joinTraveler', tripId: trip.id, userId: m.userId, name: m.name, id: newId(), auto: true }));
}

export type SelfJoin =
  /** Já está na viagem (ou não é do grupo): nada a fazer. */
  | { kind: 'none' }
  /** Resolve sem perguntar. */
  | { kind: 'auto'; action: TripAction }
  /** Perguntar "Quem é você nesta viagem?" entre as pessoas livres; `suggested`: mesmo nome. */
  | { kind: 'ask'; free: Traveler[]; suggested: string[] };

/**
 * A conta deste aparelho está no grupo: falta dizer quem ela é na viagem?
 * - Quem criou o grupo: é o seu "sou eu", sem perguntar.
 * - Quem entrou: escolhe entre as pessoas que ainda não são de nenhuma conta, ou "pessoa nova".
 *   Sem ninguém livre, entra direto como pessoa nova.
 * - Outro aparelho já a pôs como pessoa nova (passaram os 10 minutos): ainda pergunta, enquanto
 *   essa pessoa não tiver nada no nome.
 */
export function selfJoin(trip: Trip, members: Member[], account: { id: string; name: string } | null, meId: string | null, newId: () => string): SelfJoin {
  const me = account && members.find((m) => m.userId === account.id);
  if (!account || !me) return { kind: 'none' };
  const joined = (trip.joined ?? []).includes(account.id);
  const base = { type: 'joinTraveler', tripId: trip.id, userId: account.id, name: account.name, id: newId(), self: true, claim: true } as const;
  const free = freeTravelers(trip);
  if (me.role === 'owner') {
    if (joined) return { kind: 'none' };
    return { kind: 'auto', action: meId && free.some((p) => p.id === meId) ? { ...base, prefer: meId } : base };
  }
  const linked = trip.people.find((p) => p.userId === account.id);
  if (linked) {
    if (!linked.auto) return { kind: 'none' };
    if (free.length && canRemoveTraveler(trip, linked.id)) return { kind: 'ask', free, suggested: sameNameIds(free, account.name) };
    return { kind: 'auto', action: base };
  }
  if (joined) return { kind: 'none' }; // foi tirada da viagem depois: não volta sozinha
  if (free.length === 0) return { kind: 'auto', action: base };
  return { kind: 'ask', free, suggested: sameNameIds(free, account.name) };
}

/**
 * As viagens dos grupos da conta, para aparecerem em qualquer aparelho em que ela entrar (ver a
 * ação syncAdopt). `hidden`: grupos que a pessoa excluiu da lista dela.
 */
export function adoptAction(groups: MyGroup[], hidden: Iterable<string>): TripAction {
  const trips = groups
    .filter((g) => g.kind === 'trip' && !!g.content && typeof g.content === 'object' && isValidTrip((g.content as { trip?: unknown }).trip))
    .map((g) => ({ groupId: g.groupId, code: g.code, version: g.version, trip: (g.content as { trip: Trip }).trip }));
  return { type: 'syncAdopt', groups: trips, hidden: [...hidden] };
}
