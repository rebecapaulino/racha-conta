// O motor da viagem compartilhada, sem React: enviar a fila, buscar a versão do grupo,
// entrar pelo convite e pôr na viagem quem entrou no grupo. O useTripSync só chama estas
// funções e despacha o que elas devolvem; os testes usam um servidor de mentira no lugar do Supabase.

import type { Trip } from '../core/trip';
import { isValidTrip, type TripAction, type TripsState } from '../state/tripState';
import type { Member, RemoteTrip } from './groups';

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
 * Entra no grupo pelo convite: a viagem chega, abre neste aparelho e a pessoa passa a
 * participar dela (ligada a quem já estava com o nome dela, ou como pessoa nova).
 */
export async function joinByInvite(api: TripApi, code: string, account: JoinAccount, newId: () => string): Promise<{ actions: TripAction[]; trip: Trip }> {
  const groupId = await api.join(code, account.name, account.photo);
  const remote = await api.fetch(groupId);
  if (!remote || !isValidTrip(remote.trip)) throw new Error('viagem inválida');
  return {
    trip: remote.trip,
    actions: [
      { type: 'syncJoin', groupId, code: remote.code, version: remote.version, trip: remote.trip },
      { type: 'joinTraveler', tripId: remote.trip.id, userId: account.id, name: account.name, id: newId(), self: true },
    ],
  };
}

/**
 * Quem está no grupo e ainda não ganhou o seu lugar na viagem (entrou antes desta versão do
 * app, ou por outro aparelho): uma ação para cada. Vale também para a conta deste aparelho,
 * que fica ligada ao "sou eu" (`meId`) se ele ainda não tem conta. Quem criou o grupo só é
 * ligado pelo próprio aparelho: ele já está na viagem, talvez com outro nome, e só o aparelho
 * dele sabe qual pessoa é.
 */
export function memberActions(trip: Trip, members: Member[], accountId: string | null, meId: string | null, newId: () => string): TripAction[] {
  const joined = new Set(trip.joined ?? []);
  const out: TripAction[] = [];
  for (const m of members) {
    if (joined.has(m.userId)) continue;
    const self = m.userId === accountId;
    if (!self && m.role === 'owner') continue;
    out.push({
      type: 'joinTraveler',
      tripId: trip.id,
      userId: m.userId,
      name: m.name,
      id: newId(),
      ...(self ? { self: true, ...(meId ? { prefer: meId } : {}) } : {}),
    });
  }
  return out;
}
