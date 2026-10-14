import { useEffect, useRef, useState, type Dispatch } from 'react';
import type { Account } from '../auth/account';
import type { Action, AppState } from '../state/billState';
import { getPhoto } from '../state/photos';
import { errorText, fetchGroup, fetchMembers, saveGroup, type Member, type SyncStatus } from '../sync/groups';
import { pullRole, pushRole, type RoleApi } from '../sync/roleEngine';
import { uploadReceipt, wasSent } from '../sync/receipts';

const RETRY_MS = 8000;
/** De quanto em quanto tempo confere o grupo (com o app aberto). */
const POLL_MS = 20000;

/** O servidor de verdade (Supabase), para o motor do rolê. */
const supabaseRoleApi: RoleApi = { save: saveGroup, fetch: fetchGroup };

/** Igual ao da Viagem, para o rolê aberto: envia a fila, busca de novo no conflito e ouve o grupo. */
export function useBillSync(
  state: AppState,
  dispatch: Dispatch<Action>,
  account: Account | null,
  onJoined?: (name: string) => void,
): { members: Member[]; status: SyncStatus; refresh: () => void } {
  const name = account?.name ?? null;
  const userId = account?.id ?? null;
  const [status, setStatus] = useState<SyncStatus>({ checkedAt: null, error: null });
  const fail = (what: string) => (e: unknown) => setStatus((st) => ({ ...st, error: `${what}: ${errorText(e)}` }));
  const refreshRef = useRef<() => void>(() => {});
  const joined = useRef(onJoined);
  useEffect(() => {
    joined.current = onJoined;
  });
  useEffect(() => {
    if (name !== (state.author ?? null)) dispatch({ type: 'setAuthor', name });
  }, [name, state.author, dispatch]);

  const sh = state.shared;
  const groupId = sh?.groupId ?? null;

  const inflight = useRef(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const again = () => setTick((n) => n + 1);
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, []);
  useEffect(() => {
    if (!userId || !sh || sh.pending.length === 0 || inflight.current || navigator.onLine === false) return;
    inflight.current = true;
    // Salvou: confirma. Outra pessoa salvou antes: vem a versão dela e a fila é refeita por cima.
    pushRole(supabaseRoleApi, state)
      .then(({ action, error }) => {
        if (action) dispatch(action);
        if (error) setStatus((st) => ({ ...st, error }));
      })
      .catch((e) => {
          fail('Enviar')(e);
          window.setTimeout(() => setTick((n) => n + 1), RETRY_MS);
        })
      .finally(() => {
        inflight.current = false;
        setTick((n) => n + 1);
      });
  }, [state, sh, userId, tick, dispatch]);

  const [members, setMembers] = useState<{ groupId: string; list: Member[] } | null>(null);
  useEffect(() => {
    if (!groupId || !userId) return;
    let alive = true;
    const loadDoc = () =>
      pullRole(supabaseRoleApi, groupId)
        .then(({ action, error }) => {
          if (!alive) return;
          setStatus({ checkedAt: Date.now(), error: error ?? null });
          if (action) dispatch(action);
        })
        .catch(fail('Buscar o grupo'));
    let known: Set<string> | null = null;
    const loadMembers = () =>
      fetchMembers(groupId)
        .then((list) => {
          if (!alive) return;
          // Quem entrou depois que a tela abriu: avisa.
          if (known) for (const m of list) if (!known.has(m.userId) && m.userId !== userId) joined.current?.(m.name);
          known = new Set(list.map((m) => m.userId));
          setMembers({ groupId, list });
        })
        .catch(fail('Ver quem está no grupo'));
    void loadDoc();
    void loadMembers();
    // Sem tempo real (poupa as conexões do Supabase): confere o grupo de tempos em tempos,
    // só com o app na tela, e na hora em que a pessoa volta para ele.
    const refresh = () => {
      if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
      void loadDoc();
      void loadMembers();
    };
    refreshRef.current = () => {
      void loadDoc();
      void loadMembers();
      setTick((n) => n + 1);
    };
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [groupId, userId, dispatch]);

  // Fotos das notas (e a do cartão) tiradas neste aparelho: vão para a pasta do grupo (uma vez cada).
  const photos = [state.photoId, ...(state.bill.notes ?? []).map((n) => n.photoId)].filter((r): r is string => !!r).join(',');
  useEffect(() => {
    if (!groupId || !userId || !photos || navigator.onLine === false) return;
    let alive = true;
    let retry = 0;
    (async () => {
      let failed = false;
      for (const id of photos.split(',')) {
        if (!alive || wasSent(groupId, id)) continue;
        const blob = await getPhoto(id);
        if (blob && !(await uploadReceipt(groupId, id, blob))) failed = true;
      }
      // Não subiu (sinal fraco, sessão renovando): tenta de novo daqui a pouco.
      if (failed && alive) retry = window.setTimeout(() => setTick((n) => n + 1), RETRY_MS);
    })();
    return () => {
      alive = false;
      window.clearTimeout(retry);
    };
  }, [groupId, userId, photos, tick]);

  return { members: members && members.groupId === groupId ? members.list : [], status, refresh: () => refreshRef.current() };
}
