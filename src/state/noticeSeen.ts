// Qual aviso do grupo este aparelho já mostrou, por viagem. Só conveniência: se o navegador não
// deixar guardar (janela privada, dados bloqueados), o aviso aparece de novo na próxima abertura.

const key = (tripId: string) => `racha-aviso-visto:${tripId}`;

export function noticeSeen(tripId: string, noticeId: string): boolean {
  try {
    return localStorage.getItem(key(tripId)) === noticeId;
  } catch {
    return false;
  }
}

export function markNoticeSeen(tripId: string, noticeId: string): void {
  try {
    localStorage.setItem(key(tripId), noticeId);
  } catch {
    /* sem armazenamento: o aviso volta na próxima vez */
  }
}
