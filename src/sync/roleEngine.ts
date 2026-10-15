// O motor do rolê compartilhado, sem React (como o tripEngine da Viagem): enviar a fila,
// buscar a versão do grupo e pôr na mesa quem entrou no grupo. O useBillSync só chama estas
// funções e despacha o que elas devolvem; os testes usam um servidor de mentira.

import { personUsed, type Bill, type Person } from '../core/bill';
import { sameNameIds } from '../core/faces';
import { isValidRoleDoc, roleDoc, type Action, type AppState, type RoleDoc } from '../state/billState';
import type { Member, MyGroup } from './groups';
import { addEntry, type HistoryEntry } from '../state/history';

export interface RoleApi {
  save(groupId: string, doc: RoleDoc, base: number): Promise<number>;
  fetch(groupId: string): Promise<{ content: unknown; version: number; code: string } | null>;
}

export const NO_ACCESS = 'O grupo não respondeu para esta conta (sem acesso ou sessão expirada). O rolê continua ligado, e o app tenta de novo sozinho.';
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

/**
 * Os rolês dos grupos da conta, para aparecerem em qualquer aparelho em que ela entrar: os que
 * não são o rolê aberto nem estão em Rolês entram em Rolês (ligados ao grupo); os excluídos pela
 * pessoa (`hidden`) saem de Rolês. O rolê aberto não é mexido aqui (ele já se mantém em dia).
 */
export function adoptRoles(history: HistoryEntry[], current: AppState, groups: MyGroup[], hidden: Set<string>): HistoryEntry[] {
  const groupOf = (e: { id: string; shared?: { groupId: string } }) => e.shared?.groupId ?? (e.id.startsWith('grupo-') ? e.id.slice(6) : null);
  let list = history.filter((e) => {
    const g = groupOf(e);
    return !g || !hidden.has(g);
  });
  let changed = list.length !== history.length;
  const known = new Set([groupOf(current), ...list.map(groupOf)].filter((g): g is string => !!g));
  for (const g of groups) {
    if (g.kind !== 'role' || hidden.has(g.groupId) || known.has(g.groupId) || !isValidRoleDoc(g.content)) continue;
    const doc = g.content;
    list = addEntry(list, {
      id: `grupo-${g.groupId}`,
      startedAt: doc.startedAt,
      photoId: doc.photoId ?? null,
      bill: doc.bill,
      nextColor: doc.nextColor,
      log: doc.log,
      shared: { groupId: g.groupId, code: g.code, version: g.version, base: doc, pending: [] },
    });
    known.add(g.groupId);
    changed = true;
  }
  return changed ? list : history;
}
