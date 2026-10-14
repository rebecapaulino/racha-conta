import { useEffect, useRef, useState, type Dispatch } from 'react';
import type { Account } from '../../auth/account';
import { isValidTrip, openTrip, type TripAction, type TripsState } from '../../state/tripState';
import { getPhoto } from '../../state/photos';
import { errorText, fetchMembers, fetchTripGroup, saveTripGroup, type Member, type SyncStatus } from '../../sync/groups';
import { uploadReceipt, wasSent } from '../../sync/receipts';

const RETRY_MS = 8000;
/** De quanto em quanto tempo confere o grupo (com o app aberto). */
const POLL_MS = 20000;

/**
 * Mantém as viagens compartilhadas em dia: envia a fila de mudanças (quando há internet),
 * busca de novo quando outra pessoa salvou antes, ouve o grupo da viagem aberta em tempo real
 * e devolve quem está nele.
 */
export function useTripSync(
  state: TripsState,
  dispatch: Dispatch<TripAction>,
  account: Account | null,
  onJoined?: (name: string) => void,
): { members: Member[]; status: SyncStatus; refresh: () => void } {
  const name = account?.name ?? null;
  // Só muda quando entra ou sai alguém (a conta é recriada a cada renovação da sessão).
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

  // Envia a fila. Uma viagem por vez; se der erro de rede, tenta de novo depois.
  const inflight = useRef(new Set<string>());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const again = () => setTick((n) => n + 1);
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, []);
  useEffect(() => {
    if (!userId) return;
    for (const [tripId, entry] of Object.entries(state.sync ?? {})) {
      if (entry.pending.length === 0 || inflight.current.has(tripId) || navigator.onLine === false) continue;
      const trip = state.trips.find((t) => t.id === tripId);
      if (!trip) continue;
      const count = entry.pending.length;
      inflight.current.add(tripId);
      saveTripGroup(entry.groupId, trip, entry.version)
        .then(async (version) => {
          if (version > 0) {
            dispatch({ type: 'syncSaved', tripId, version, count, sent: trip });
            return;
          }
          // Outra pessoa salvou antes: busca a versão dela; a fila é refeita por cima.
          const remote = await fetchTripGroup(entry.groupId);
          if (!remote) setStatus((st) => ({ ...st, error: 'O grupo não respondeu para esta conta (sem acesso ou sessão expirada). A viagem continua ligada; tente Atualizar agora.' }));
          else if (isValidTrip(remote.trip)) dispatch({ type: 'syncRemote', tripId, trip: remote.trip, version: remote.version });
        })
        .catch((e) => {
          fail('Enviar')(e);
          window.setTimeout(() => setTick((n) => n + 1), RETRY_MS);
        })
        .finally(() => inflight.current.delete(tripId));
    }
  }, [state.sync, state.trips, userId, tick, dispatch]);

  // Viagem aberta compartilhada: busca a última versão, quem está no grupo, e fica ouvindo.
  const open = openTrip(state);
  const tripId = open?.id ?? null;
  const groupId = (tripId && state.sync?.[tripId]?.groupId) || null;
  const [members, setMembers] = useState<{ groupId: string; list: Member[] } | null>(null);
  useEffect(() => {
    if (!groupId || !tripId || !userId) return;
    let alive = true;
    const loadTrip = () =>
      fetchTripGroup(groupId)
        .then((r) => {
          if (!alive) return;
          setStatus({ checkedAt: Date.now(), error: null });
          if (!r) setStatus((st) => ({ ...st, error: 'O grupo não respondeu para esta conta (sem acesso ou sessão expirada). A viagem continua ligada; tente Atualizar agora.' }));
          else if (isValidTrip(r.trip)) dispatch({ type: 'syncRemote', tripId, trip: r.trip, version: r.version });
          else setStatus((st) => ({ ...st, error: 'A versão do grupo veio com algum dado que o app não reconhece.' }));
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
    void loadTrip();
    void loadMembers();
    // Sem tempo real (poupa as conexões do Supabase): confere o grupo de tempos em tempos,
    // só com o app na tela, e na hora em que a pessoa volta para ele.
    const refresh = () => {
      if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
      void loadTrip();
      void loadMembers();
    };
    refreshRef.current = () => {
      void loadTrip();
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
  }, [groupId, tripId, userId, dispatch]);

  // Fotos das notas tiradas neste aparelho: vão para a pasta do grupo (uma vez cada).
  const receipts = (open?.expenses ?? []).map((e) => e.receipt).filter((r): r is string => !!r).join(',');
  useEffect(() => {
    if (!groupId || !userId || !receipts || navigator.onLine === false) return;
    let alive = true;
    (async () => {
      for (const id of receipts.split(',')) {
        if (!alive || wasSent(groupId, id)) continue;
        const blob = await getPhoto(id);
        if (blob) await uploadReceipt(groupId, id, blob);
      }
    })();
    return () => {
      alive = false;
    };
  }, [groupId, userId, receipts, tick]);

  return { members: members && members.groupId === groupId ? members.list : [], status, refresh: () => refreshRef.current() };
}
