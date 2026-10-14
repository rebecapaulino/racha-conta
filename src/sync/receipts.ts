// Fotos das notas fiscais da viagem compartilhada: ficam no Supabase Storage (pasta do grupo),
// para o grupo todo ver. Só quem é do grupo lê e envia (regras em 20261015_notas.sql).
// Cada aparelho também guarda a foto (IndexedDB): depois de baixada, abre sem internet.

import { supabase } from '../auth/supabase';

const BUCKET = 'notas';
const SENT_KEY = 'racha-notas-enviadas';
const path = (groupId: string, id: string) => `${groupId}/${id}.jpg`;

function sentList(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Esta foto já foi enviada para o grupo (por este aparelho)? */
export const wasSent = (groupId: string, id: string) => sentList().includes(path(groupId, id));

/** Marca como já no grupo (enviada daqui ou baixada de lá): não precisa enviar de novo. */
export function markSent(groupId: string, id: string) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify([...sentList(), path(groupId, id)].slice(-500)));
  } catch {
    /* sem armazenamento: só envia de novo depois */
  }
}

/** Envia a foto da nota para a pasta do grupo. false: sem internet ou sem acesso (tenta de novo depois). */
export async function uploadReceipt(groupId: string, id: string, blob: Blob): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { error } = await sb.storage.from(BUCKET).upload(path(groupId, id), blob, { contentType: blob.type || 'image/jpeg', upsert: true });
  if (error) return false;
  markSent(groupId, id);
  return true;
}

/** Baixa a foto de uma nota que outra pessoa do grupo tirou. */
export async function downloadReceipt(groupId: string, id: string): Promise<Blob | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(BUCKET).download(path(groupId, id));
  return error || !data ? null : data;
}
