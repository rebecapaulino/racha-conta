import { useEffect, useRef, useState, type Dispatch } from 'react';
import type { Account } from '../auth/account';
import { isValidRoleDoc, roleDoc, type Action, type AppState } from '../state/billState';
import { fetchGroup, fetchMembers, saveGroup, watchContent, type Member } from '../sync/groups';

const RETRY_MS = 8000;

/** Igual ao da Viagem, para o rolê aberto: envia a fila, busca de novo no conflito e ouve o grupo. */
export function useBillSync(
  state: AppState,
  dispatch: Dispatch<Action>,
  account: Account | null,
  onJoined?: (name: string) => void,
): { members: Member[] } {
  const name = account?.name ?? null;
  const userId = account?.id ?? null;
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
    const sent = roleDoc(state);
    const count = sh.pending.length;
    const gid = sh.groupId;
    inflight.current = true;
    saveGroup(gid, sent, sh.version)
      .then(async (version) => {
        if (version > 0) {
          dispatch({ type: 'syncSaved', version, count, sent });
          return;
        }
        const remote = await fetchGroup(gid);
        if (!remote) dispatch({ type: 'syncUnlink' });
        else if (isValidRoleDoc(remote.content)) dispatch({ type: 'syncRemote', doc: remote.content, version: remote.version });
      })
      .catch(() => window.setTimeout(() => setTick((n) => n + 1), RETRY_MS))
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
      fetchGroup(groupId)
        .then((r) => {
          if (!alive) return;
          if (!r) dispatch({ type: 'syncUnlink' });
          else if (isValidRoleDoc(r.content)) dispatch({ type: 'syncRemote', doc: r.content, version: r.version });
        })
        .catch(() => {});
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
        .catch(() => {});
    void loadDoc();
    void loadMembers();
    const stop = watchContent(
      groupId,
      (r) => isValidRoleDoc(r.content) && dispatch({ type: 'syncRemote', doc: r.content, version: r.version }),
      loadMembers,
    );
    // Além do tempo real: confere de tempos em tempos e ao voltar para o app (se o tempo real
    // cair, as mudanças dos outros aparecem do mesmo jeito).
    const refresh = () => {
      if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
      void loadDoc();
      void loadMembers();
    };
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      alive = false;
      stop();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [groupId, userId, dispatch]);

  return { members: members && members.groupId === groupId ? members.list : [] };
}
