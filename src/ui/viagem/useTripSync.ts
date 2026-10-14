import { useEffect, useRef, useState, type Dispatch } from 'react';
import type { Account } from '../../auth/account';
import { isValidTrip, openTrip, type TripAction, type TripsState } from '../../state/tripState';
import { fetchMembers, fetchTripGroup, saveTripGroup, watchGroup, type Member } from '../../sync/groups';

const RETRY_MS = 8000;

/**
 * Mantém as viagens compartilhadas em dia: envia a fila de mudanças (quando há internet),
 * busca de novo quando outra pessoa salvou antes, ouve o grupo da viagem aberta em tempo real
 * e devolve quem está nele.
 */
export function useTripSync(state: TripsState, dispatch: Dispatch<TripAction>, account: Account | null): { members: Member[] } {
  const name = account?.name ?? null;
  // Só muda quando entra ou sai alguém (a conta é recriada a cada renovação da sessão).
  const userId = account?.id ?? null;
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
          if (!remote) dispatch({ type: 'syncUnlink', tripId });
          else if (isValidTrip(remote.trip)) dispatch({ type: 'syncRemote', tripId, trip: remote.trip, version: remote.version });
        })
        .catch(() => window.setTimeout(() => setTick((n) => n + 1), RETRY_MS))
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
          if (!r) dispatch({ type: 'syncUnlink', tripId });
          else if (isValidTrip(r.trip)) dispatch({ type: 'syncRemote', tripId, trip: r.trip, version: r.version });
        })
        .catch(() => {});
    const loadMembers = () =>
      fetchMembers(groupId)
        .then((list) => alive && setMembers({ groupId, list }))
        .catch(() => {});
    void loadTrip();
    void loadMembers();
    const stop = watchGroup(
      groupId,
      (r) => isValidTrip(r.trip) && dispatch({ type: 'syncRemote', tripId, trip: r.trip, version: r.version }),
      loadMembers,
    );
    return () => {
      alive = false;
      stop();
    };
  }, [groupId, tripId, userId, dispatch]);

  return { members: members && members.groupId === groupId ? members.list : [] };
}
