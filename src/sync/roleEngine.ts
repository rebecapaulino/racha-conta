// O motor do rolê compartilhado, sem React (como o tripEngine da Viagem): enviar a fila,
// buscar a versão do grupo e pôr na mesa quem entrou no grupo. O useBillSync só chama estas
// funções e despacha o que elas devolvem; os testes usam um servidor de mentira.

import { personUsed, type Bill, type Person } from '../core/bill';
import { sameNameIds } from '../core/faces';
import { isValidRoleDoc, roleDoc, type Action, type AppState, type RoleDoc } from '../state/billState';
import type { Member } from './groups';

export interface RoleApi {
  save(groupId: string, doc: RoleDoc, base: number): Promise<number>;
  fetch(groupId: string): Promise<{ content: unknown; version: number; code: string } | null>;
}

export const NO_ACCESS = 'O grupo não respondeu para esta conta (sem acesso ou sessão expirada). O rolê continua ligado; tente Atualizar agora.';
export const UNKNOWN_DATA = 'A versão do grupo veio com algum dado que o app não reconhece.';

export interface RoleStep {
  action: Action | null;
  error?: string;
}

/**
 * Envia a fila. Salvou: "syncSaved". Outra pessoa salvou antes: busca a versão dela
 * ("syncRemote"; a fila é refeita por cima). Erro de rede: lança.
 */
export async function pushRole(api: RoleApi, state: AppState): Promise<RoleStep> {
  const sh = state.shared;
  if (!sh || sh.pending.length === 0) return { action: null };
  const sent = roleDoc(state);
  const count = sh.pending.length;
  const version = await api.save(sh.groupId, sent, sh.version);
  if (version > 0) return { action: { type: 'syncSaved', version, count, sent } };
  return pullRole(api, sh.groupId);
}

/** Busca o rolê no grupo. */
export async function pullRole(api: RoleApi, groupId: string): Promise<RoleStep> {
  const remote = await api.fetch(groupId);
  if (!remote) return { action: null, error: NO_ACCESS };
  if (!isValidRoleDoc(remote.content)) return { action: null, error: UNKNOWN_DATA };
  return { action: { type: 'syncRemote', doc: remote.content, version: remote.version } };
}

/** Quanto tempo quem entrou tem para dizer quem é, antes de outro aparelho pô-la como pessoa nova. */
export const CHOOSE_MS = 10 * 60 * 1000;

/**
 * Quem está no grupo e ainda não ganhou o seu lugar na mesa: os outros aparelhos põem como
 * pessoa nova (nunca ligam pelo nome), depois de `CHOOSE_MS`. Ficam de fora a conta deste
 * aparelho (ver selfJoinRole) e quem criou o grupo (no Rolê não há "sou eu", e quem cria
 * normalmente já se pôs na mesa, talvez com outro nome: adicionar de novo duplicaria).
 */
export function roleMemberActions(bill: Bill, members: Member[], accountId: string | null, newId: () => string, now = Date.now()): Action[] {
  const joined = new Set(bill.joined ?? []);
  return members
    .filter((m) => m.userId !== accountId && m.role !== 'owner' && !joined.has(m.userId))
    .filter((m) => !m.joinedAt || now - Date.parse(m.joinedAt) >= CHOOSE_MS)
    .map((m): Action => ({ type: 'joinPerson', userId: m.userId, name: m.name, id: newId(), auto: true }));
}

export type SelfJoinRole = { kind: 'none' } | { kind: 'auto'; action: Action } | { kind: 'ask'; free: Person[]; suggested: string[] };

/** Como selfJoin da Viagem: quem entrou diz quem é na mesa ("Quem é você neste rolê?"). */
export function selfJoinRole(bill: Bill, members: Member[], account: { id: string; name: string } | null, newId: () => string): SelfJoinRole {
  const me = account && members.find((m) => m.userId === account.id);
  if (!account || !me || me.role === 'owner') return { kind: 'none' };
  const base: Action = { type: 'joinPerson', userId: account.id, name: account.name, id: newId(), claim: true };
  const free = bill.people.filter((p) => !p.userId);
  const linked = bill.people.find((p) => p.userId === account.id);
  if (linked) {
    if (!linked.auto) return { kind: 'none' };
    if (free.length && !personUsed(bill, linked.id)) return { kind: 'ask', free, suggested: sameNameIds(free, account.name) };
    return { kind: 'auto', action: base };
  }
  if ((bill.joined ?? []).includes(account.id)) return { kind: 'none' };
  if (free.length === 0) return { kind: 'auto', action: base };
  return { kind: 'ask', free, suggested: sameNameIds(free, account.name) };
}
