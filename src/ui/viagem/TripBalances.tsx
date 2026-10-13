import { useState, type CSSProperties, type Dispatch } from 'react';
import { whatsappUrl } from '../../core/bill';
import { formatBRL } from '../../core/money';
import type { Transfer } from '../../core/settle';
import { activeExpenses, categoryLabel, tripBalancesText, tripSettleText, type Trip, type TripSummary } from '../../core/trip';
import type { TripAction } from '../../state/tripState';
import { Avatar } from '../Avatar';
import { IconAlert, IconCheck, IconCopy, IconShare } from '../icons';
import { Art } from '../illustrations';
import { CategoryIcon } from './CategoryIcon';

/** "R$ 1.486,75" sem quebrar a linha entre o "R$" e o número. */
const glued = (cents: number) => formatBRL(cents).replace(' ', '\u00a0');

interface Props {
  trip: Trip;
  summary: TripSummary;
  meId: string | null;
  fluent: boolean;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string, undo?: () => void) => void;
  onSettle: (t: Transfer) => void;
}

/** Saldos: quem paga quem para ficar quite, o saldo de cada um, os gastos por categoria e o resumo. */
export function TripBalances({ trip, summary, meId, fluent, dispatch, toast, onSettle }: Props) {
  const [kind, setKind] = useState<'acerto' | 'saldos'>('acerto');
  const person = (id: string) => trip.people.find((p) => p.id === id)!;
  const called = (id: string, lower = false) => (id === meId ? (lower ? 'você' : 'Você') : person(id).name);
  const hasExpenses = activeExpenses(trip).length > 0;
  const text = kind === 'acerto' ? tripSettleText(trip, summary) : tripBalancesText(trip, summary);
  const biggest = Math.max(1, ...summary.people.map((r) => Math.abs(r.balance)));

  function copy() {
    if (!navigator.clipboard?.writeText) {
      toast('Não deu para copiar neste navegador. Use Enviar.');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => toast('Resumo copiado'),
      () => toast('Não deu para copiar. Use Enviar.'),
    );
  }

  async function send() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* a pessoa fechou o menu */
      }
      return;
    }
    window.open(whatsappUrl(text), '_blank', 'noopener');
  }

  if (!summary.ok) {
    return (
      <p className="warn" role="alert">
        <IconAlert size={16} />
        <span>
          <b>Alguma despesa não fechou ao centavo.</b> Para não mostrar números errados, os saldos ficam escondidos.
          Abra a última despesa lançada e salve de novo.
        </span>
      </p>
    );
  }

  if (!hasExpenses) {
    return (
      <section className="card empty">
        <span className="empty-icon">{fluent ? <Art kind="money" size={36} /> : '⚖️'}</span>
        <p><b>Nada para acertar ainda.</b><br />Os saldos aparecem aqui assim que você lançar a primeira despesa.</p>
      </section>
    );
  }

  return (
    <div className="stack-y trip-balances">
      <section className="card" aria-labelledby="h-quite">
        <div className="card-head">
          <h2 id="h-quite">Para ficar tudo quite</h2>
          {summary.transfers.length > 0 && <span className="badge">{summary.transfers.length}</span>}
        </div>
        {summary.transfers.length === 0 ? (
          <p className="all-square"><IconCheck size={16} /> Está tudo quite!</p>
        ) : (
          <>
            <p className="hint">O menor número de pagamentos para zerar todo mundo.</p>
            <ul className="list transfers">
              {summary.transfers.map((t) => (
                <li key={`${t.from}-${t.to}`} className="transfer">
                  <span className="transfer-who">
                    <Avatar person={person(t.from)} size="sm" />
                    <span className="transfer-text">
                      <b>{called(t.from)}</b> paga para <b>{called(t.to, true)}</b>
                    </span>
                    <b className="transfer-amount num">{formatBRL(t.cents)}</b>
                  </span>
                  <button type="button" className="btn secondary transfer-btn" onClick={() => onSettle(t)}>
                    <IconCheck size={16} /> Registrar pagamento
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {trip.settlements.length > 0 && (
          <div className="settled">
            <h3 className="field-label">Já pago</h3>
            <ul className="list">
              {[...trip.settlements].reverse().map((s) => (
                <li key={s.id} className="settled-row">
                  <span className="ok-dot" aria-hidden="true"><IconCheck size={12} /></span>
                  <span className="settled-text">
                    {called(s.from)} pagou <b className="num">{formatBRL(s.cents)}</b> para {called(s.to, true)}
                  </span>
                  <button
                    type="button"
                    className="link-btn"
                    aria-label={`Desfazer: ${person(s.from).name} pagou ${formatBRL(s.cents)} para ${person(s.to).name}`}
                    onClick={() => {
                      dispatch({ type: 'unsettle', id: s.id });
                      toast('Pagamento desfeito');
                    }}
                  >
                    Desfazer
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="h-balances">
        <div className="card-head">
          <h2 id="h-balances">Saldos</h2>
        </div>
        <p className="hint">Quanto cada um pagou menos quanto consumiu. Quem pôs mais no caixa recebe.</p>
        <ul className="list balances">
          {summary.people.map(({ person: p, paid, owes, sent, received, balance }) => {
            const state = balance > 0 ? 'in' : balance < 0 ? 'out' : 'zero';
            const style = { '--w': `${(Math.abs(balance) / biggest) * 50}%` } as CSSProperties;
            return (
              <li key={p.id} className={`balance balance-${state}`}>
                <div className="balance-top">
                  <Avatar person={p} size="md" />
                  <span className="row-main">
                    <b>
                      {p.name}
                      {p.id === meId && <span className="tag">você</span>}
                    </b>
                    <small className="balance-lines">
                      <span>pagou {glued(paid)}</span>
                      <span>consumiu {glued(owes)}</span>
                      {sent > 0 && <span>já mandou {glued(sent)}</span>}
                      {received > 0 && <span>já recebeu {glued(received)}</span>}
                    </small>
                  </span>
                  <span className="balance-tag">
                    {state === 'in' ? 'recebe' : state === 'out' ? 'paga' : 'quite'}
                    {state !== 'zero' && <b className="num">{formatBRL(Math.abs(balance))}</b>}
                  </span>
                </div>
                <span className="balance-bar" style={style} aria-hidden="true"><i /></span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="h-cats">
        <div className="card-head">
          <h2 id="h-cats">Gastos por categoria</h2>
          <span className="muted num">{formatBRL(summary.total)}</span>
        </div>
        <ul className="list cat-bars">
          {summary.byCategory.map(({ category, cents }) => {
            const pct = summary.total ? Math.round((cents / summary.total) * 100) : 0;
            return (
              <li key={category} className="cat-bar">
                <span className="cat-tile"><CategoryIcon category={category} size={18} /></span>
                <span className="cat-bar-main">
                  <span className="cat-bar-line">
                    <b>{categoryLabel(trip, category)}</b>
                    <span className="num">{formatBRL(cents)}</span>
                  </span>
                  <span className="cat-meter" style={{ '--pct': `${Math.max(2, (cents / summary.total) * 100)}%` } as CSSProperties} aria-hidden="true"><i /></span>
                  <small>{pct}% da viagem</small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="h-share">
        <div className="card-head">
          <h2 id="h-share">Resumo para o grupo</h2>
        </div>
        <div className="seg two" role="group" aria-label="Qual resumo mandar">
          <button type="button" aria-pressed={kind === 'acerto'} onClick={() => setKind('acerto')}>Quem paga quem</button>
          <button type="button" aria-pressed={kind === 'saldos'} onClick={() => setKind('saldos')}>Saldos</button>
        </div>
        <pre className="share-preview" aria-label="Texto que vai ser enviado">{text}</pre>
      </section>

      <div className="share-actions">
        <button type="button" className="btn secondary" onClick={copy}>
          <IconCopy /> Copiar texto
        </button>
        <button type="button" className="btn primary" onClick={send}>
          <IconShare /> Enviar resumo
        </button>
      </div>
    </div>
  );
}
