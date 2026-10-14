// Grupos no Supabase: criar, entrar pelo convite, buscar e salvar. Sem tempo real: cada
// aparelho confere o grupo de tempos em tempos (ver useTripSync/useBillSync).
// Quem protege os dados são as regras do banco (só quem é do grupo lê; gravar só pelas
// funções, que conferem o grupo e a versão). Ver supabase/migrations/20261014_grupos.sql.

import { supabase } from '../auth/supabase';
import type { Trip } from '../core/trip';

export interface Member {
  userId: string;
  name: string;
  photo: string | null;
  role: 'owner' | 'editor';
  /** Quando entrou no grupo (ISO). */
  joinedAt?: string;
}

/** Como está a conversa com o grupo (para mostrar na janela de compartilhar). */
export interface SyncStatus {
  /** Última vez que conferiu o grupo com sucesso. */
  checkedAt: number | null;
  /** Último erro ao falar com o grupo (null: tudo certo). */
  error: string | null;
}

/** Texto curto do erro (do Supabase ou da rede). */
export function errorText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') return (e as { message: string }).message;
  return String(e);
}

export interface InvitePreview {
  groupId: string;
  kind: 'trip' | 'role';
  title: string;
  ownerName: string;
  members: number;
}

export interface RemoteTrip {
  trip: Trip;
  version: number;
  code: string;
}

function db() {
  const sb = supabase();
  if (!sb) throw new Error('Sem conexão com o servidor.');
  return sb;
}

/** Endereço do convite: abre o app e mostra "Entrar no grupo". */
export const inviteUrl = (code: string) => `${window.location.origin}/?convite=${encodeURIComponent(code)}`;

/** Cria o grupo com o conteúdo (`{ trip }` na Viagem, `{ bill, log, … }` no Rolê). */
export async function createGroup(kind: 'trip' | 'role', content: object, name: string, photo: string | null): Promise<{ groupId: string; code: string; version: number }> {
  const { data, error } = await db().rpc('create_group', { p_kind: kind, p_data: content, p_name: name, p_photo: photo });
  if (error) throw error;
  return { groupId: data.id, code: data.invite_code, version: data.version };
}

export const createTripGroup = (trip: Trip, name: string, photo: string | null) => createGroup('trip', { trip }, name, photo);

/** O conteúdo do grupo como está no banco. null: não existe mais ou a pessoa não é do grupo. */
export async function fetchGroup(groupId: string): Promise<{ content: unknown; version: number; code: string } | null> {
  const { data, error } = await db().from('groups').select('data, version, invite_code').eq('id', groupId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { content: data.data, version: data.version, code: data.invite_code };
}

/** Salva. Devolve a versão nova, ou -1 se outra pessoa salvou antes. */
export async function saveGroup(groupId: string, content: object, base: number): Promise<number> {
  const { data, error } = await db().rpc('save_group', { p_id: groupId, p_data: content, p_base: base });
  if (error) throw error;
  return data as number;
}

export async function previewInvite(code: string): Promise<InvitePreview | null> {
  const { data, error } = await db().rpc('invite_preview', { p_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return { groupId: row.group_id, kind: row.kind, title: row.title, ownerName: row.owner_name ?? '', members: row.members ?? 0 };
}

export async function joinGroup(code: string, name: string, photo: string | null): Promise<string> {
  const { data, error } = await db().rpc('join_group', { p_code: code, p_name: name, p_photo: photo });
  if (error) throw error;
  return data as string;
}

/** A viagem como está no grupo. null: não existe mais ou a pessoa não é do grupo. */
export async function fetchTripGroup(groupId: string): Promise<RemoteTrip | null> {
  const g = await fetchGroup(groupId);
  return g ? { trip: (g.content as { trip: Trip }).trip, version: g.version, code: g.code } : null;
}

/** Salva. Devolve a versão nova, ou -1 se outra pessoa salvou antes (aí busca e refaz). */
export const saveTripGroup = (groupId: string, trip: Trip, base: number) => saveGroup(groupId, { trip }, base);

export async function fetchMembers(groupId: string): Promise<Member[]> {
  const { data, error } = await db().from('group_members').select('user_id, name, photo, role, joined_at').eq('group_id', groupId).order('joined_at');
  if (error) throw error;
  return (data ?? []).map((m) => ({ userId: m.user_id, name: m.name, photo: m.photo, role: m.role, joinedAt: m.joined_at }));
}
