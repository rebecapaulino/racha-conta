'use client';

import Link from 'next/link';
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { activeExpenses, tripSummary, type Expense, type Traveler } from '../../core/trip';
import { loginEnabled, useAccount } from '../../auth/account';
import { isValidTrip, loadTrips, openTrip, saveTrips, tripsReducer } from '../../state/tripState';
import { createTripGroup, fetchTripGroup, joinGroup } from '../../sync/groups';
import { InviteSheet, useInvite } from '../useInvite';
import { AccountButton } from '../AccountButton';
import { ThemeButton } from '../ThemeButton';
import { IconBook, IconPlus, IconScale, IconSuitcase, IconUsers, Logo } from '../icons';
import { Art } from '../illustrations';
import { PwaBars } from '../PwaBars';
import { useMediaQuery } from '../useMediaQuery';
import { activeVisual } from '../visual';
import { ExpenseSheet, type ExpenseMode } from './ExpenseSheet';
import { PersonSheet } from './PersonSheet';
import { ShareSheet } from './ShareSheet';
import { SettleSheet, type SettleTarget } from './SettleSheet';
import { TripBalances } from './TripBalances';
import { TripCover, TripList } from './TripCover';
import { TripExpenses } from './TripExpenses';
import { TripPeople } from './TripPeople';
import { TripSheet, type TripMode } from './TripSheet';
import { useTripSync } from './useTripSync';
import { newId } from '../../state/billState';
import { putPhoto } from '../../state/photos';
import { rememberPhotoUrl } from '../usePhotoUrl';

type Tab = 'pessoas' | 'despesas' | 'saldos';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Aba Viagem no modo solo: as viagens ficam guardadas neste aparelho. */
export default function TripApp({ areaSwitch }: { areaSwitch: ReactNode }) {
  const [state, dispatch] = useReducer(tripsReducer, undefined, loadTrips);
  useEffect(() => saveTrips(state), [state]);
  const trip = openTrip(state);
  const meId = trip ? state.me[trip.id] ?? null : null;
  const summary = useMemo(() => (trip ? tripSummary(trip) : null), [trip]);
  const fluent = activeVisual() === 'fluent';
  const { account } = useAccount();
  const { members, status: syncStatus, refresh: syncRefresh } = useTripSync(state, dispatch, account, (name) => toast(`${name} entrou no grupo`));
  const entry = trip ? state.sync?.[trip.id] : undefined;
  const [sharing, setSharing] = useState(false);

  /** Foto do "Ler nota fiscal": guarda no aparelho e abre a despesa nova com ela. */
  async function scanned(blob: Blob) {
    const id = newId();
    if (!(await putPhoto(id, blob))) {
      toast('Não deu para guardar a foto neste aparelho.');
      return;
    }
    rememberPhotoUrl(id, blob);
    setExpenseMode({ kind: 'new', scan: { id, blob } });
  }

  async function share() {
    if (!trip || !account || entry) return;
    const g = await createTripGroup(trip, account.name, account.photo);
    dispatch({ type: 'syncLink', tripId: trip.id, groupId: g.groupId, code: g.code, version: g.version });
  }

  // Convite (?convite=código): mostra de quem é e entra no grupo.
  const { invite, setInvite, close: closeInvite } = useInvite('trip', !!account);
  async function join() {
    if (!invite || !account) return;
    setInvite({ ...invite, status: 'joining' });
    try {
      const groupId = await joinGroup(invite.code, account.name, account.photo);
      const remote = await fetchTripGroup(groupId);
      if (!remote || !isValidTrip(remote.trip)) throw new Error('viagem inválida');
      // "Sou eu": a pessoa da viagem com o mesmo primeiro nome da conta.
      const first = (n: string) => n.trim().split(/\s+/)[0].toLocaleLowerCase('pt-BR');
      const meId = remote.trip.people.find((p) => first(p.name) === first(account.name))?.id;
      dispatch({ type: 'syncJoin', groupId, code: remote.code, version: remote.version, trip: remote.trip, meId });
      closeInvite();
      toast(`Você entrou na viagem ${remote.trip.name}`);
    } catch {
      setInvite({ ...invite, status: 'error' });
    }
  }

  // No computador os saldos ficam sempre à direita; as abas viram só Pessoas e Despesas.
  const wide = useMediaQuery('(min-width: 1000px)');
  const firstTab = (t: typeof trip): Tab => (t && t.people.length > 1 ? 'despesas' : 'pessoas');
  const [tab, setTab] = useState<Tab>(() => firstTab(trip));
  // Viagem trocada (aberta da lista ou recém-criada): começa nas despesas, ou em Pessoas se falta gente.
  const [seenTrip, setSeenTrip] = useState(trip?.id);
  if (trip?.id !== seenTrip) {
    setSeenTrip(trip?.id);
    setTab(firstTab(trip));
  }
  const current: Tab = wide && tab === 'saldos' ? 'despesas' : tab;
  const tabsRef = useRef<HTMLDivElement>(null);

  function go(next: Tab) {
    setTab(next);
    const top = tabsRef.current;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  // Aviso rápido, com "Desfazer" quando dá para voltar atrás.
  const [toastMsg, setToastMsg] = useState<{ text: string; undo?: () => void } | null>(null);
  const [toastOn, setToastOn] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  function toast(text: string, undo?: () => void) {
    setToastMsg({ text, undo });
    setToastOn(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastOn(false), undo ? 6000 : 2600);
  }

  const [expenseMode, setExpenseMode] = useState<ExpenseMode | null>(null);
  const [tripMode, setTripMode] = useState<TripMode | null>(null);
  const [editing, setEditing] = useState<Traveler | null>(null);
  const [settling, setSettling] = useState<SettleTarget | null>(null);

  function openList() {
    dispatch({ type: 'openTrip', id: null });
    window.scrollTo({ top: 0 });
  }
  function openOne(id: string) {
    dispatch({ type: 'openTrip', id });
    window.scrollTo({ top: 0 });
  }

  const toastEl = (
    <div className={`toast${toastOn ? ' show' : ''}${toastMsg?.undo ? ' has-undo' : ''}`} role="status" aria-live="polite">
      <span>{toastMsg?.text}</span>
      {toastMsg?.undo && toastOn && (
        <button
          type="button"
          className="toast-undo"
          onClick={() => {
            toastMsg.undo?.();
            setToastOn(false);
          }}
        >
          Desfazer
        </button>
      )}
    </div>
  );
  const tripSheet = <TripSheet mode={tripMode} dispatch={dispatch} toast={toast} onClose={() => setTripMode(null)} />;
  const inviteSheet = <InviteSheet invite={invite} noun="viagem" onJoin={join} onClose={closeInvite} />;


  if (!trip || !summary) {
    return (
      <>
        <div className="app app-single trip-app">
          <div className="col-main">
            <header className="topbar">
              <div className="brand"><Logo size={28} /><span>Racha Conta</span></div>
              <div className="top-actions">
                <ThemeButton />
                <AccountButton toast={toast} />
              </div>
            </header>
            {areaSwitch}
            <PwaBars />
            <TripList trips={state.trips} fluent={fluent} onOpen={openOne} onCreate={() => setTripMode({ kind: 'create' })} />
            <div className="app-link-row"><Link href="/privacidade">Política de Privacidade</Link></div>
          </div>
        </div>
        {tripSheet}
        {inviteSheet}
        {toastEl}
      </>
    );
  }

  const tabs: { id: Tab; label: string; icon: ReactNode; count?: string }[] = [
    { id: 'pessoas', label: 'Pessoas', icon: fluent ? <Art kind="people" size={20} /> : <IconUsers size={18} />, count: trip.people.length ? String(trip.people.length) : undefined },
    { id: 'despesas', label: 'Despesas', icon: fluent ? <Art kind="notebook" size={20} /> : <IconBook size={18} />, count: summary.byDay.length ? String(activeExpenses(trip).length) : undefined },
  ];
  if (!wide) tabs.push({ id: 'saldos', label: 'Saldos', icon: fluent ? <Art kind="money" size={20} /> : <IconScale size={18} /> });

  const newExpense = (payerId?: string) => setExpenseMode({ kind: 'new', ...(payerId ? { payerId } : {}) });
  const balances = (
    <TripBalances trip={trip} summary={summary} meId={meId} fluent={fluent} dispatch={dispatch} toast={toast} onSettle={setSettling} />
  );

  return (
    <>
      <div className="app trip-app">
        <div className="col-main">
          <header className="topbar">
            <div className="brand"><Logo size={28} /><span>Racha Conta</span></div>
            <div className="top-actions">
              <button type="button" className="top-btn" onClick={openList}>
                <IconSuitcase size={18} /> Viagens
                {state.trips.length > 1 && <span className="tab-count">{state.trips.length}</span>}
              </button>
              <ThemeButton />
              <AccountButton toast={toast} />
            </div>
          </header>

          {areaSwitch}
          <TripCover
            trip={trip}
            fluent={fluent}
            onEdit={() => setTripMode({ kind: 'edit', trip })}
            onShare={loginEnabled ? () => setSharing(true) : undefined}
            members={members}
            accountId={account?.id ?? null}
          />
          <PwaBars />

          <div className="tabs" role="tablist" aria-label="Partes da viagem" ref={tabsRef}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`vtab-${t.id}`}
                aria-selected={current === t.id}
                aria-controls="vpanel"
                onClick={() => go(t.id)}
              >
                {t.icon}
                {t.label}
                {t.count && <span className="tab-count">{t.count}</span>}
              </button>
            ))}
          </div>

          <div id="vpanel" role="tabpanel" aria-labelledby={`vtab-${current}`} className="panel">
            {current === 'pessoas' && (
              <TripPeople trip={trip} summary={summary} meId={meId} fluent={fluent} dispatch={dispatch} onEdit={setEditing} />
            )}
            {current === 'despesas' && (
              <TripExpenses
                trip={trip}
                summary={summary}
                meId={meId}
                fluent={fluent}
                dispatch={dispatch}
                toast={toast}
                onEdit={(e: Expense) => setExpenseMode({ kind: 'edit', expense: e })}
                onGoPeople={() => go('pessoas')}
                groupId={entry?.groupId ?? null}
                onScan={scanned}
              />
            )}
            {current === 'saldos' && balances}
          </div>

          {current !== 'saldos' && trip.people.length > 0 && (
            <div className="cta">
              <button type="button" className="btn primary big" onClick={() => newExpense()}>
                <IconPlus /> Nova despesa
              </button>
            </div>
          )}
          <div className="app-link-row"><Link href="/privacidade">Política de Privacidade</Link></div>
        </div>

        {wide && (
          <aside className="col-side" aria-label="Saldos da viagem">
            {balances}
          </aside>
        )}
      </div>

      <ExpenseSheet
        trip={trip}
        meId={meId}
        mode={expenseMode}
        dispatch={dispatch}
        toast={toast}
        onClose={() => setExpenseMode(null)}
        onSaved={() => current === 'pessoas' && setTab('despesas')}
        groupId={entry?.groupId ?? null}
      />
      <PersonSheet trip={trip} meId={meId} person={editing} dispatch={dispatch} toast={toast} onClose={() => setEditing(null)} />
      <SettleSheet trip={trip} transfer={settling} dispatch={dispatch} toast={toast} onClose={() => setSettling(null)} />
      <ShareSheet
        open={sharing}
        noun="viagem"
        title={trip.name}
        code={entry?.code ?? null}
        pending={entry?.pending.length ?? 0}
        status={syncStatus}
        onRefresh={syncRefresh}
        members={members}
        account={account}
        onCreate={share}
        toast={toast}
        onClose={() => setSharing(false)}
      />
      {tripSheet}
      {inviteSheet}
      {toastEl}
    </>
  );
}
