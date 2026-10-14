'use client';

import Link from 'next/link';
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { computeSplit } from '../core/bill';
import { formatBRL } from '../core/money';
import { loginEnabled, useAccount } from '../auth/account';
import { activeBill, activeNote, blankState, isValidRoleDoc, loadState, reducer, roleDoc, saveState, worthKeeping } from '../state/billState';
import { createGroup, fetchGroup, joinGroup } from '../sync/groups';
import { useBillSync } from './useBillSync';
import { InviteSheet, useInvite } from './useInvite';
import { ShareSheet } from './viagem/ShareSheet';
import { addEntry, fromEntry, loadHistory, removeEntry, saveHistory, toEntry, type HistoryEntry } from '../state/history';
import { deletePhoto } from '../state/photos';
import { AccountButton } from './AccountButton';
import { ThemeButton } from './ThemeButton';
import { DivisaoStep } from './DivisaoStep';
import { GroupSummary } from './GroupSummary';
import { HeroCard } from './HeroCard';
import { HistoryScreen } from './HistoryScreen';
import { IconArrowRight, IconHistory, IconPie, IconReceipt, IconSparkle, IconUsers, Logo } from './icons';
import { Art } from './illustrations';
import { MesaStep } from './MesaStep';
import { NotesBar } from './NotesBar';
import { PwaBars } from './PwaBars';
import { PedidosStep } from './PedidosStep';
import { useMediaQuery } from './useMediaQuery';
import { activeVisual } from './visual';

type Tab = 'mesa' | 'pedidos' | 'divisao';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SoloApp({ areaSwitch }: { areaSwitch?: ReactNode }) {
  // Roda só no aparelho (ver ClientOnly em page.tsx), então pode ler o que está salvo.
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const { bill } = state;
  const result = useMemo(() => computeSplit(bill), [bill]);
  // Pedidos e Divisão mostram a nota aberta (a conta inteira, quando é de uma nota só).
  const note = activeNote(state);
  const view = useMemo(() => activeBill({ bill, noteId: note?.id ?? null }), [bill, note?.id]);
  const viewResult = useMemo(() => (view === bill ? result : computeSplit(view)), [view, bill, result]);

  useEffect(() => saveState(state), [state]);

  // Rolê compartilhado: grupo, convite e quem está nele.
  const { account } = useAccount();
  const { members, status: syncStatus, refresh: syncRefresh } = useBillSync(state, dispatch, account, (name) => toast(`${name} entrou no grupo`));
  const [sharing, setSharing] = useState(false);
  async function share() {
    if (!account || state.shared) return;
    const g = await createGroup('role', roleDoc(state), account.name, account.photo);
    dispatch({ type: 'syncLink', groupId: g.groupId, code: g.code, version: g.version });
  }
  const { invite, setInvite, close: closeInvite } = useInvite('role', !!account);

  // Rolês: contas anteriores, guardadas a cada "Nova conta".
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [screen, setScreen] = useState<'conta' | 'roles'>('conta');
  useEffect(() => saveHistory(history), [history]);

  // No computador a divisão fica sempre à direita; as abas viram só Mesa e Pedidos.
  const wide = useMediaQuery('(min-width: 1000px)');
  const [tab, setTab] = useState<Tab>(() => (state.bill.people.length ? 'pedidos' : 'mesa'));
  const current: Tab = wide && tab === 'divisao' ? 'pedidos' : tab;
  const tabsRef = useRef<HTMLDivElement>(null);

  function go(next: Tab) {
    setTab(next);
    const top = tabsRef.current;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  // Do aviso "ficou fora da divisão" direto para o item, em destaque.
  function goToItem(itemId: string) {
    setTab('pedidos');
    requestAnimationFrame(() => {
      const el = document.getElementById(`item-${itemId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      el.classList.remove('flash');
      void el.offsetWidth; // reinicia a animação
      el.classList.add('flash');
      el.querySelector<HTMLButtonElement>('.chip')?.focus({ preventScroll: true });
    });
  }

  // Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; undo?: () => void } | null>(null);
  const [toastOn, setToastOn] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  function toast(text: string, undo?: () => void) {
    setToastMsg({ text, undo });
    setToastOn(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastOn(false), undo ? 6000 : 2400);
  }
  const toastBox = (
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

  // "Nova conta" (na tela Rolês): a atual vai para os Rolês (nada se perde), então não precisa confirmar.
  function focusTop(then?: () => void) {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (then) requestAnimationFrame(then);
  }
  function startFresh() {
    const kept = worthKeeping(state);
    if (kept) setHistory((h) => addEntry(h, toEntry(state)));
    dispatch({ type: 'reset' });
    setTab('mesa');
    setScreen('conta');
    focusTop(() => document.getElementById('person-name')?.focus());
    if (kept) toast('Conta guardada em Rolês');
  }
  function reopen(e: HistoryEntry) {
    setHistory((h) => {
      const rest = removeEntry(h, e.id);
      return worthKeeping(state) ? addEntry(rest, toEntry(state)) : rest;
    });
    dispatch({ type: 'open', state: fromEntry(e) });
    setTab(e.bill.people.length ? 'pedidos' : 'mesa');
    setScreen('conta');
    focusTop();
    toast('Conta reaberta');
  }
  function forget(e: HistoryEntry) {
    setHistory((h) => removeEntry(h, e.id));
    if (e.photoId) deletePhoto(e.photoId);
    e.bill.notes?.forEach((n) => n.photoId && deletePhoto(n.photoId));
    toast('Rolê apagado');
  }

  async function join() {
    if (!invite || !account) return;
    setInvite({ ...invite, status: 'joining' });
    try {
      const groupId = await joinGroup(invite.code, account.name, account.photo);
      const remote = await fetchGroup(groupId);
      if (!remote || !isValidRoleDoc(remote.content)) throw new Error('rolê inválido');
      const doc = remote.content;
      const id = `grupo-${groupId}`;
      // A conta aberta vai para Rolês (nada se perde), e o rolê do grupo abre.
      if (state.id !== id && worthKeeping(state)) setHistory((h) => addEntry(removeEntry(h, id), toEntry(state)));
      else setHistory((h) => removeEntry(h, id));
      dispatch({
        type: 'open',
        state: { ...blankState(), ...doc, id, shared: { groupId, code: remote.code, version: remote.version, base: doc, pending: [] }, author: account.name },
      });
      setTab(doc.bill.people.length ? 'pedidos' : 'mesa');
      setScreen('conta');
      closeInvite();
      toast(`Você entrou no rolê ${doc.bill.title.trim() || 'Conta da mesa'}`);
    } catch {
      setInvite({ ...invite, status: 'error' });
    }
  }
  const sharedSheets = (
    <>
      <ShareSheet
        open={sharing}
        noun="rolê"
        title={bill.title.trim() || 'Conta da mesa'}
        code={state.shared?.code ?? null}
        pending={state.shared?.pending.length ?? 0}
        status={syncStatus}
        onRefresh={syncRefresh}
        members={members}
        account={account}
        onCreate={share}
        toast={toast}
        onClose={() => setSharing(false)}
      />
      <InviteSheet invite={invite} noun="rolê" onJoin={join} onClose={closeInvite} />
    </>
  );

  // No visual fluent, abas e cartão do total ganham ilustrações de formas sobrepostas.
  const fluent = activeVisual() === 'fluent';

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: string }[] = [
    { id: 'mesa', label: 'Mesa', icon: fluent ? <Art kind="people" size={20} /> : <IconUsers size={18} />, count: bill.people.length ? String(bill.people.length) : undefined },
    { id: 'pedidos', label: 'Pedidos', icon: fluent ? <Art kind="receipt" size={20} /> : <IconReceipt size={18} />, count: bill.items.length ? String(bill.items.length) : undefined },
  ];
  if (!wide) tabs.push({ id: 'divisao', label: 'Divisão', icon: fluent ? <Art kind="pie" size={20} /> : <IconPie size={18} /> });

  // Com várias notas, a Divisão abre no resumo do grupo; "Por nota" mostra uma nota por vez.
  const [divView, setDivView] = useState<'resumo' | 'nota'>('resumo');
  const multi = (bill.notes?.length ?? 0) > 1;
  function openNote(id: string) {
    if (id) dispatch({ type: 'selectNote', id });
    setDivView('nota');
  }

  // Pedido para abrir a nota que a leitura da foto acabou de criar (quem pagou, quem divide).
  const [editRequest, setEditRequest] = useState(0);
  const notesBar = <NotesBar bill={bill} active={note} dispatch={dispatch} toast={toast} editRequest={editRequest} />;
  const divisaoNota = <DivisaoStep bill={view} result={viewResult} startedAt={state.startedAt} billId={state.id} photoId={state.photoId} log={state.log} onGoToItem={goToItem} dispatch={dispatch} toast={toast} />;
  const divisao = !multi ? (
    divisaoNota
  ) : (
    <div className="stack-y">
      <div className="seg div-switch" role="group" aria-label="Como ver a divisão">
        <button type="button" aria-pressed={divView === 'resumo'} onClick={() => setDivView('resumo')}>Resumo do grupo</button>
        <button type="button" aria-pressed={divView === 'nota'} onClick={() => setDivView('nota')}>Por nota</button>
      </div>
      {divView === 'resumo' ? (
        <GroupSummary bill={bill} dispatch={dispatch} toast={toast} onOpenNote={openNote} />
      ) : (
        <>
          {/* No computador a barra das notas já está em Pedidos, ao lado. */}
          {!wide && notesBar}
          {divisaoNota}
        </>
      )}
    </div>
  );

  if (screen === 'roles') {
    return (
      <>
        <div className="app app-single">
          <HistoryScreen
            entries={history}
            fluent={fluent}
            onBack={() => setScreen('conta')}
            onNew={startFresh}
            onReopen={reopen}
            onDelete={forget}
          />
        </div>
        {toastBox}
      </>
    );
  }

  return (
    <>
      <div className="app">
        <div className="col-main">
          <header className="topbar">
            <div className="brand">
              <Logo size={28} />
              <span>Racha Conta</span>
            </div>
            <div className="top-actions">
              <button type="button" className="top-btn" onClick={() => { setScreen('roles'); focusTop(); }}>
                <IconHistory size={18} /> Rolês
                {history.length > 0 && <span className="tab-count">{history.length}</span>}
              </button>
              <ThemeButton />
              <AccountButton toast={toast} />
            </div>
          </header>

          {areaSwitch}

          <HeroCard
            title={bill.title}
            startedAt={state.startedAt}
            total={result.total}
            servicePct={bill.notes && bill.notes.length > 1 ? null : view.servicePct}
            notesCount={bill.notes?.length ?? 1}
            people={bill.people}
            photoId={state.photoId}
            fluent={fluent}
            onPhoto={(photoId) => dispatch({ type: 'photo', photoId })}
            toast={toast}
            onShare={loginEnabled && !state.example ? () => setSharing(true) : undefined}
            members={members}
            accountId={account?.id ?? null}
          />

          <PwaBars />

          {state.example && (
            <div className="example" role="note">
              <span className="example-icon"><IconSparkle size={18} /></span>
              <p><b>Mesa de exemplo.</b> Mexa à vontade.</p>
              <button type="button" className="link-btn" onClick={startFresh}>Começar do zero</button>
            </div>
          )}

          <div className="tabs" role="tablist" aria-label="Etapas" ref={tabsRef}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={current === t.id}
                aria-controls="panel"
                onClick={() => go(t.id)}
              >
                {t.icon}
                {t.label}
                {t.count && <span className="tab-count">{t.count}</span>}
              </button>
            ))}
          </div>

          <div id="panel" role="tabpanel" aria-labelledby={`tab-${current}`} className="panel">
            {current === 'mesa' && <MesaStep bill={bill} result={result} dispatch={dispatch} />}
            {current === 'pedidos' && (
              <PedidosStep
                bill={view}
                title={bill.title}
                result={viewResult}
                example={state.example}
                notePhotoId={note?.photoId ?? null}
                notesBar={!state.example && notesBar}
                onNewNote={() => setEditRequest((n) => n + 1)}
                dispatch={dispatch}
                toast={toast}
              />
            )}
            {current === 'divisao' && divisao}
          </div>

          {current === 'mesa' && (
            <div className="cta">
              <button type="button" className="btn primary big" onClick={() => go('pedidos')}>
                Próximo: pedidos <IconArrowRight />
              </button>
            </div>
          )}
          {current === 'pedidos' && !wide && (
            <div className="cta">
              <button type="button" className="btn primary big" onClick={() => go('divisao')}>
                <span>Ver divisão</span>
                <span className="cta-total">{formatBRL(viewResult.total)}</span>
                <IconArrowRight />
              </button>
            </div>
          )}
          <div className="app-link-row">
            <Link href="/privacidade">Política de Privacidade</Link>
          </div>
        </div>

        {wide && (
          <aside className="col-side" aria-label="Divisão da conta">
            {divisao}
          </aside>
        )}
      </div>

      {toastBox}
      {sharedSheets}
    </>
  );
}
