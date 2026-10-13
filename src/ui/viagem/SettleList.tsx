import { useState, type Dispatch } from 'react';
import { formatBRL } from '../../core/money';
import {
  accountMembers,
  accountOf,
  groupByPayer,
  installmentInfo,
  type SettleRow,
  type Trip,
} from '../../core/trip';
import type { TripAction } from '../../state/tripState';
import { Avatar } from '../Avatar';
import { IconArrowRight, IconCheck } from '../icons';
import { CategoryIcon } from './CategoryIcon';
import type { SettleTarget } from './SettleSheet';
import { Signed } from './Signed';

/** "R$ 1.486,75" sem quebrar a linha entre o "R$" e o número. */
const glued = (cents: number) => formatBRL(cents).replace(' ', ' ');

interface Props {
  trip: Trip;
  rows: SettleRow[];
  meId: string | null;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string, undo?: () => void) => void;
  onSettle: (t: SettleTarget) => void;
  onExplain: (id: string) => void;
}

/**
 * Quem paga quem, com o que já foi pago marcado em verde. Dá para ver todo mundo (agrupado
 * por quem paga) ou escolher uma pessoa e ver quem deve para ela e para quem ela deve.
 */
export function SettleList({ trip, rows, meId, dispatch, toast, onSettle, onExplain }: Props) {
  const [who, setWho] = useState('');
  const person = (id: string) => trip.people.find((p) => p.id === id)!;
  const called = (id: string, lower = false) => (id === meId ? (lower ? 'você' : 'Você') : person(id).name);
  const valid = who && trip.people.some((p) => p.id === who) ? who : '';
  const account = valid ? accountOf(trip, valid) : '';

  /** Desmarca um pagamento feito (com Desfazer, caso tenha sido sem querer). */
  function unpay(r: SettleRow) {
    const paid = trip.settlements.filter(
      (x) => accountOf(trip, x.from) === r.from && accountOf(trip, x.to) === r.to && (x.expenseId ?? '') === (r.expenseId ?? ''),
    );
    for (const x of paid) dispatch({ type: 'unsettle', id: x.id });
    toast(`Pagamento para ${called(r.to, true)} desmarcado`, () => {
      for (const x of paid) dispatch({ type: 'settle', id: x.id, from: x.from, to: x.to, cents: x.cents });
    });
  }

  /** Uma linha: quem paga → quem recebe, o valor, as parcelas e o botão de pago. */
  function row(r: SettleRow, side: 'out' | 'in') {
    const done = r.remaining === 0;
    const inst = r.installments && r.installments > 1 ? installmentInfo(r.cents, r.paid, r.installments) : null;
    const expense = r.expenseId ? trip.expenses.find((e) => e.id === r.expenseId) : undefined;
    const payNow = inst && inst.next > 0 ? inst.next : r.remaining;
    const label = expense && inst ? `${expense.description} · parcela ${inst.paidCount + 1} de ${inst.count}` : undefined;
    return (
      <li key={`${r.from}-${r.to}-${r.expenseId ?? ''}`} className={`pay-item${done ? ' is-paid' : ''}${inst ? ' is-split' : ''}`}>
        {/* Seta vertical ligando ao avatar do alto do cartão: desce para quem recebe, sobe de quem paga. */}
        <span className={`pay-flow pay-flow-${side}`} aria-hidden="true">
          <IconArrowRight size={18} />
          <Avatar person={person(side === 'out' ? r.to : r.from)} size="md" />
        </span>
        <span className="pay-to">
          <span className="pay-line">
            <span className="pay-name">
              {side === 'out' ? (
                <><span className="sr">{called(r.from)} paga </span>para <b>{called(r.to, true)}</b></>
              ) : (
                <><b>{called(r.from)}</b> paga<span className="sr"> para {called(r.to, true)}</span></>
              )}
            </span>
            {done ? (
              <b className="num amt-pos pay-amount">{glued(r.cents)}</b>
            ) : (
              <Signed cents={(side === 'out' ? -1 : 1) * payNow} className="pay-amount" />
            )}
          </span>
          {expense && inst && (
            <span className="pay-expense">
              <span className="cat-tile"><CategoryIcon category={expense.category} size={16} /></span>
              <span>
                <b>{expense.description}</b>
                <small>
                  {done ? (
                    <span className="amt-pos">{inst.count} de {inst.count} parcelas pagas</span>
                  ) : (
                    <>parcela {inst.paidCount + 1} de {inst.count} · faltam {glued(r.remaining)} de {glued(r.cents)}</>
                  )}
                </small>
              </span>
            </span>
          )}
          {!inst && r.paid > 0 && !done && (
            <small className="pay-partial">
              <span className="amt-pos">já pagou {glued(r.paid)}</span> de {glued(r.cents)}
            </small>
          )}
          <span className="pay-actions">
            {done ? (
              <button
                type="button"
                className="btn secondary settle-btn is-paid"
                aria-pressed="true"
                onClick={() => unpay(r)}
                aria-label={`Pago: ${called(r.from)} pagou ${formatBRL(r.cents)} para ${called(r.to, true)}. Toque para desmarcar`}
              >
                <IconCheck size={16} /> Pago
              </button>
            ) : (
              <button
                type="button"
                className="btn secondary settle-btn"
                onClick={() => onSettle({ from: r.from, to: r.to, cents: payNow, ...(r.expenseId ? { expenseId: r.expenseId, label } : {}) })}
                aria-label={`${inst ? `Parcela ${inst.paidCount + 1} de ${inst.count}. ` : ''}Registrar: ${called(r.from)} pagou ${formatBRL(payNow)} para ${called(r.to, true)}`}
              >
                <IconCheck size={16} />{' '}
                {inst ? `Pagar ${inst.paidCount + 1}/${inst.count}` : r.paid > 0 ? 'Pagar o resto' : 'Pago'}
              </button>
            )}
          </span>
        </span>
      </li>
    );
  }

  const groups = groupByPayer(rows, trip);
  const incoming = rows.filter((r) => r.to === account);
  const outgoing = rows.filter((r) => r.from === account);
  const leftOf = (list: SettleRow[]) => list.reduce((a, r) => a + r.remaining, 0);
  const viewed = valid ? person(valid) : null;
  const sponsor = viewed && account !== viewed.id ? person(account) : null;

  return (
    <>
      <label className="filter settle-filter" data-on={!!valid || undefined}>
        <span className="field-label">Ver de quem</span>
        <select value={valid} onChange={(e) => setWho(e.target.value)}>
          <option value="">Todo mundo</option>
          {trip.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === meId ? `${p.name} (você)` : p.name}
            </option>
          ))}
        </select>
      </label>

      {viewed ? (
        <div className="settle-person" aria-live="polite">
          {sponsor && (
            <p className="acc-covered">
              <b>{called(sponsor.id)} paga a parte de {called(viewed.id, true)}.</b> Abaixo, a conta {sponsor.id === meId ? 'sua' : `de ${sponsor.name}`}.
            </p>
          )}
          <section className="pay-group" aria-labelledby="h-incoming">
            <div className="pay-head">
              <Avatar person={person(account)} size="md" />
              <span className="pay-who">
                <b id="h-incoming">Quem deve para {called(account, true)}</b>
                <small className={incoming.length && !leftOf(incoming) ? 'amt-pos' : undefined}>
                  {incoming.length === 0
                    ? 'Ninguém deve nada.'
                    : leftOf(incoming) === 0
                      ? '✓ Já recebeu tudo'
                      : `Falta receber ${glued(leftOf(incoming))}`}
                </small>
              </span>
            </div>
            {incoming.length > 0 && (
              <ul className="pay-items">
                {incoming.map((r) => row(r, 'in'))}
              </ul>
            )}
          </section>
          <section className="pay-group" aria-labelledby="h-outgoing">
            <div className="pay-head">
              <Avatar person={person(account)} size="md" />
              <span className="pay-who">
                <b id="h-outgoing">{called(account)} deve para</b>
                <small className={outgoing.length && !leftOf(outgoing) ? 'amt-pos' : undefined}>
                  {outgoing.length === 0
                    ? 'Não deve nada.'
                    : leftOf(outgoing) === 0
                      ? '✓ Tudo pago'
                      : `Falta pagar ${glued(leftOf(outgoing))}`}
                </small>
              </span>
            </div>
            {outgoing.length > 0 && (
              <ul className="pay-items">
                {outgoing.map((r) => row(r, 'out'))}
              </ul>
            )}
          </section>
          <button type="button" className="link-btn pay-why" onClick={() => onExplain(viewed.id)}>
            Ver a conta de {called(viewed.id, true)}, despesa por despesa
          </button>
        </div>
      ) : (
        <ul className="pay-groups">
          {groups.map((g) => {
            const left = leftOf(g.items);
            const members = accountMembers(trip, g.from);
            return (
              <li key={g.from} className={`pay-group${left === 0 ? ' is-done' : ''}`}>
                <div className="pay-head">
                  <Avatar person={person(g.from)} size="md" />
                  <span className="pay-who">
                    <b>{called(g.from)} paga</b>
                    {members.length > 0 && (
                      <small className="pay-with">com a parte de {members.map((m) => called(m.id, true)).join(', ')}</small>
                    )}
                    <small className={left === 0 ? 'amt-pos' : undefined}>
                      {left === 0
                        ? '✓ Tudo pago'
                        : g.items.length === 1
                          ? 'para 1 pessoa'
                          : `${glued(left)} ${left === g.cents ? 'no total' : 'faltando'}, para ${g.items.length} pessoas`}
                    </small>
                  </span>
                </div>
                <ul className="pay-items">
                  {g.items.map((r) => row(r, 'out'))}
                </ul>
                <button type="button" className="link-btn pay-why" onClick={() => onExplain(g.from)}>
                  Por que {called(g.from, true)} paga isso? Ver a conta
                </button>
              </li>
            );
          })}
        </ul>
      )}

    </>
  );
}
