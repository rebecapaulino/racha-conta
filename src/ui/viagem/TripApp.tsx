'use client';

import Link from 'next/link';
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { activeExpenses, tripSummary, type Expense, type Traveler } from '../../core/trip';
import { loginEnabled, useAccount } from '../../auth/account';
import { loadTrips, meOf, openTrip, saveTrips, tripsReducer, type TripAction } from '../../state/tripState';
import { hideGroup, unhideGroup } from '../../state/hiddenGroups';
import { usePwa } from '../../pwa/pwa';
import { createTripGroup } from '../../sync/groups';
import { joinByInvite, memberActions, selfJoin } from '../../sync/tripEngine';
import { newcomerName } from '../../core/faces';
import { WhoAmISheet } from '../WhoAmISheet';
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
import { FacesProvider } from '../Avatar';
import { facesByName } from '../../core/faces';
import { TripExpenses } from './TripExpenses';
import { TripPeople } from './TripPeople';
import { TripSheet, type TripMode } from './TripSheet';
import { supabaseTripApi, useTripSync } from './useTripSync';
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
  const { account } = useAccount();
  const pwa = usePwa();
  const meId = trip ? meOf(state, trip, account?.id ?? null) : null;
  const summary = useMemo(() => (trip ? tripSummary(trip) : null), [trip]);
  const fluent = activeVisual() === 'fluent';
  const { members, status: syncStatus, refresh: syncRefresh } = useTripSync(state, dispatch, account, (name) => toast(`${name} entrou no grupo`));
  const entry = trip ? state.sync?.[trip.id] : undefined;

  // Quem está no grupo participa da viagem. Você: diz quem é em "Quem é você nesta viagem?"
  // (ou entra direto, sem ninguém para escolher). Os outros: se em 10 minutos não disseram,
  // este aparelho os põe como pessoa nova. Nome igual nunca liga sozinho (ver joinTraveler).
  const self = useMemo(
    () => (trip && entry && account ? selfJoin(trip, members, account, meId, newId) : null),
    [trip, entry, members, account, meId],
  );
  useEffect(() => {
    if (!trip || !entry || members.length === 0) return;
    if (self?.kind === 'auto') dispatch(self.action);
    for (const a of memberActions(trip, members, account?.id ?? null, newId)) dispatch(a);
  }, [trip, entry, members, account?.id, self]);
  function chooseSelf(id: string | null) {
    if (!trip || !account) return;
    dispatch({ type: 'joinTraveler', tripId: trip.id, userId: account.id, name: account.name, id: newId(), self: true, claim: true, ...(id ? { prefer: id } : {}) });
    const who = id ? trip.people.find((p) => p.id === id)?.name : null;
    toast(who ? `Pronto: você é ${who} nesta viagem` : 'Pronto: você entrou na viagem');
  }
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
      // A viagem chega e abre; em seguida, "Quem é você nesta viagem?".
      const { actions, trip: joined } = await joinByInvite(supabaseTripApi, invite.code, account);
      for (const a of actions) {
        if (a.type === 'syncJoin') unhideGroup(a.groupId); // tinha excluído e entrou de novo
        dispatch(a);
      }
      closeInvite();
      // Abriu o link no navegador do celular (o link não abre o atalho): a viagem já está na conta.
      const phone = window.matchMedia('(pointer: coarse)').matches;
      toast(phone && !pwa.standalone ? `Você entrou na viagem ${joined.name}. Ela já aparece também no app Racha Conta da sua tela inicial.` : `Você entrou na viagem ${joined.name}`);
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
    toastTimer.current = window.setTimeout(() => setToastOn(false), undo ? 6000 : Math.max(2600, text.length * 60));
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
  // Excluir uma viagem compartilhada vale para a conta (some de todos os aparelhos dela).
  const act = (a: TripAction) => {
    if (a.type === 'deleteTrip') {
      const groupId = state.sync?.[a.id]?.groupId;
      if (groupId) hideGroup(groupId);
    }
    dispatch(a);
  };
  const tripSheet = <TripSheet mode={tripMode} dispatch={act} toast={toast} accountName={account?.name ?? null} onClose={() => setTripMode(null)} />;
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
            <TripList
              trips={state.trips}
              groups={Object.fromEntries(Object.entries(state.sync ?? {}).map(([id, e]) => [id, e.groupId]))}
              fluent={fluent}
              onOpen={openOne}
              onCreate={() => setTripMode({ kind: 'create' })}
              onDelete={(id) => {
                act({ type: 'deleteTrip', id });
                toast('Viagem apagada');
              }}
            />
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

  // Foto de cada pessoa: pelas contas do grupo; e "você" (deste aparelho) com a foto da sua conta.
  const faces = facesByName(trip.people, members);
  // Só se essa pessoa não for de outra conta (alguém marcou "Sou eu" na pessoa errada).
  const mePerson = trip.people.find((p) => p.id === meId);
  if (mePerson && (!mePerson.userId || mePerson.userId === account?.id) && account?.photo && /^https:\/\//.test(account.photo)) faces[mePerson.id] = account.photo;

  return (
    <FacesProvider value={faces}>
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
            onPhoto={(photoId) => dispatch({ type: 'editTrip', photoId })}
            toast={toast}
            groupId={entry?.groupId ?? null}
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
      <WhoAmISheet
        key={trip.id}
        open={self?.kind === 'ask'}
        noun="viagem"
        people={self?.kind === 'ask' ? self.free : []}
        suggested={self?.kind === 'ask' ? self.suggested : []}
        newName={newcomerName(trip.people.filter((p) => p.userId !== account?.id).map((p) => p.name), account?.name ?? '')}
        onChoose={chooseSelf}
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
    </FacesProvider>
  );
}
