'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { computeSplit } from '../core/bill';
import { formatBRL } from '../core/money';
import { loadState, reducer, saveState, worthKeeping } from '../state/billState';
import { addEntry, fromEntry, loadHistory, removeEntry, saveHistory, toEntry, type HistoryEntry } from '../state/history';
import { deletePhoto } from '../state/photos';
import { DivisaoStep } from './DivisaoStep';
import { HeroCard } from './HeroCard';
import { HistoryScreen } from './HistoryScreen';
import { IconArrowRight, IconHistory, IconPie, IconPlus, IconReceipt, IconSparkle, IconUsers, Logo } from './icons';
import { Art } from './illustrations';
import { MesaStep } from './MesaStep';
import { PwaBars } from './PwaBars';
import { PedidosStep } from './PedidosStep';
import { useMediaQuery } from './useMediaQuery';
import { activeVisual } from './visual';

type Tab = 'mesa' | 'pedidos' | 'divisao';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SoloApp() {
  // Roda só no aparelho (ver ClientOnly em page.tsx), então pode ler o que está salvo.
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const { bill } = state;
  const result = useMemo(() => computeSplit(bill), [bill]);

  useEffect(() => saveState(state), [state]);

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
  const [toastMsg, setToastMsg] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  function toast(msg: string) {
    setToastMsg(msg);
    setToastOn(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastOn(false), 2400);
  }

  // "Nova conta": a atual vai para os Rolês (nada se perde), então não precisa confirmar.
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
    toast('Rolê apagado');
  }

  // No visual fluent, abas e cartão do total ganham ilustrações de formas sobrepostas.
  const fluent = activeVisual() === 'fluent';

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: string }[] = [
    { id: 'mesa', label: 'Mesa', icon: fluent ? <Art kind="people" size={20} /> : <IconUsers size={18} />, count: bill.people.length ? String(bill.people.length) : undefined },
    { id: 'pedidos', label: 'Pedidos', icon: fluent ? <Art kind="receipt" size={20} /> : <IconReceipt size={18} />, count: bill.items.length ? String(bill.items.length) : undefined },
  ];
  if (!wide) tabs.push({ id: 'divisao', label: 'Divisão', icon: fluent ? <Art kind="pie" size={20} /> : <IconPie size={18} /> });

  const divisao = <DivisaoStep bill={bill} result={result} startedAt={state.startedAt} billId={state.id} photoId={state.photoId} log={state.log} onGoToItem={goToItem} dispatch={dispatch} toast={toast} />;

  if (screen === 'roles') {
    return (
      <>
        <div className="app app-single">
          <HistoryScreen
            entries={history}
            fluent={fluent}
            onBack={() => setScreen('conta')}
            onReopen={reopen}
            onDelete={forget}
          />
        </div>
        <div className={`toast${toastOn ? ' show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>
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
              <button type="button" className="round-btn" onClick={startFresh} aria-label="Nova conta" title="Nova conta">
                <IconPlus />
              </button>
            </div>
          </header>

          <HeroCard
            title={bill.title}
            startedAt={state.startedAt}
            total={result.total}
            servicePct={bill.servicePct}
            people={bill.people}
            photoId={state.photoId}
            fluent={fluent}
            onPhoto={(photoId) => dispatch({ type: 'photo', photoId })}
            toast={toast}
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
            {current === 'pedidos' && <PedidosStep bill={bill} result={result} dispatch={dispatch} />}
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
                <span className="cta-total">{formatBRL(result.total)}</span>
                <IconArrowRight />
              </button>
            </div>
          )}
        </div>

        {wide && (
          <aside className="col-side" aria-label="Divisão da conta">
            {divisao}
          </aside>
        )}
      </div>

      <div className={`toast${toastOn ? ' show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>

    </>
  );
}
