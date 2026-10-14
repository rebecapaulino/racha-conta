import { useEffect, useRef, useState, type Dispatch } from 'react';
import type { Account } from '../auth/account';
import { isValidRoleDoc, roleDoc, type Action, type AppState } from '../state/billState';
import { fetchGroup, fetchMembers, saveGroup, watchContent, type Member } from '../sync/groups';

const RETRY_MS = 8000;

/** Igual ao da Viagem, para o rolê aberto: envia a fila, busca de novo no conflito e ouve o grupo. */
export function useBillSync(state: AppState, dispatch: Dispatch<Action>, account: Account | null): { members: Member[] } {
  const name = account?.name ?? null;
  const userId = account?.id ?? null;
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
    const loadMembers = () =>
      fetchMembers(groupId)
        .then((list) => alive && setMembers({ groupId, list }))
        .catch(() => {});
    void loadDoc();
    void loadMembers();
    const stop = watchContent(
      groupId,
      (r) => isValidRoleDoc(r.content) && dispatch({ type: 'syncRemote', doc: r.content, version: r.version }),
      loadMembers,
    );
    return () => {
      alive = false;
      stop();
    };
  }, [groupId, userId, dispatch]);

  return { members: members && members.groupId === groupId ? members.list : [] };
}
