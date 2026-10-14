// O motor do rolê compartilhado, sem React (como o tripEngine da Viagem): enviar a fila,
// buscar a versão do grupo e pôr na mesa quem entrou no grupo. O useBillSync só chama estas
// funções e despacha o que elas devolvem; os testes usam um servidor de mentira.

import type { Bill } from '../core/bill';
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

/**
 * Quem está no grupo e ainda não ganhou o seu lugar na mesa: uma ação para cada. Quem criou o
 * grupo fica de fora: no Rolê não há "sou eu", e ele normalmente já se pôs na mesa (talvez com
 * outro nome); adicionar de novo duplicaria.
 */
export function roleMemberActions(bill: Bill, members: Member[], newId: () => string): Action[] {
  const joined = new Set(bill.joined ?? []);
  return members
    .filter((m) => m.role !== 'owner' && !joined.has(m.userId))
    .map((m) => ({ type: 'joinPerson', userId: m.userId, name: m.name, id: newId() }));
}
