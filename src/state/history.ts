// Histórico de rolês: cada "Nova conta" guarda a conta anterior aqui.
// As contas são pequenas e ficam no armazenamento local; as fotos ficam à parte (photos.ts).
// Se o armazenamento falhar, o histórico vive só enquanto a página estiver aberta.

import { isValidBill, validLog, type AppState } from './billState';

export type HistoryEntry = Pick<AppState, 'id' | 'startedAt' | 'photoId' | 'bill' | 'nextColor' | 'log'>;

const KEY = 'racha-conta-historico-v1';

export function toEntry(s: AppState): HistoryEntry {
  return { id: s.id, startedAt: s.startedAt, photoId: s.photoId, bill: s.bill, nextColor: s.nextColor, log: s.log };
}

export function fromEntry(e: HistoryEntry): AppState {
  return { ...e, noteId: null, log: validLog(e.log), example: false };
}

/** Guarda (ou atualiza) um rolê, mantendo o mais recente primeiro. */
export function addEntry(list: HistoryEntry[], e: HistoryEntry): HistoryEntry[] {
  return [e, ...list.filter((x) => x.id !== e.id)].sort((a, b) => b.startedAt - a.startedAt);
}

export function removeEntry(list: HistoryEntry[], id: string): HistoryEntry[] {
  return list.filter((x) => x.id !== id);
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        !!e && typeof e.id === 'string' && typeof e.startedAt === 'number' && isValidBill(e.bill),
    );
  } catch {
    return [];
  }
}

export function saveHistory(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* modo privado ou cota cheia: segue só em memória */
  }
}
