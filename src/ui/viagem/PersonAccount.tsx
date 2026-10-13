import { forwardRef, type ReactNode } from 'react';
import { formatBRL } from '../../core/money';
import type { Transfer } from '../../core/settle';
import { personStatement, type PairDebt, type SettleMode, type Trip } from '../../core/trip';
import { Avatar, personStyle } from '../Avatar';
import { shortDay } from './tripDates';

interface Props {
  trip: Trip;
  /** Pagamentos do modo escolhido no acerto. */
  transfers: Transfer[];
  mode: SettleMode;
  meId: string | null;
  selected: string;
  onSelect: (id: string) => void;
}

/**
 * Conta de cada um: como um extrato. Mostra, despesa por despesa, quanto a pessoa deve a
 * cada um que pagou e quanto cada um deve a ela. Serve para conferir o acerto na mão.
 */
export const PersonAccount = forwardRef<HTMLElement, Props>(function PersonAccount({ trip, transfers, mode, meId, selected, onSelect }, ref) {
  const person = trip.people.find((p) => p.id === selected) ?? trip.people[0];
  const me = person.id === meId;
  const st = personStatement(trip, person.id);
  const name = (id: string) => (id === meId ? 'você' : trip.people.find((p) => p.id === id)?.name ?? '?');
  const subject = me ? 'Você' : person.name;
  const mine = transfers.filter((t) => t.from === person.id || t.to === person.id);
  // O Pix final só bate com a soma das dívidas quando não há nada para compensar.
  const compensated = st.owesTo.length > 0 && st.owedBy.length > 0;
  const rerouted = mine.some((t) => {
    const other = t.from === person.id ? t.to : t.from;
    const pair = (t.from === person.id ? st.owesTo : st.owedBy).find((d) => d.other === other);
    return pair?.cents !== t.cents;
  });

  const block = (title: string, debts: PairDebt[], total: number, verb: (other: string) => ReactNode) =>
    debts.length > 0 && (
      <div className="acc-block">
        <h3 className="field-label">{title}</h3>
        <ul className="list acc-pairs">
          {debts.map((d) => {
            const other = trip.people.find((p) => p.id === d.other)!;
            return (
              <li key={d.other}>
                <details className="acc-pair">
                  <summary>
                    <Avatar person={other} size="sm" />
                    <span className="acc-pair-text">
                      <span>{verb(d.other)}</span>
                      <small>{d.lines.length} {d.lines.length === 1 ? 'despesa' : 'despesas'} · ver</small>
                    </span>
                    <b className="num">{formatBRL(d.cents)}</b>
                  </summary>
                  <ul className="acc-lines">
                    {d.lines.map((l) => (
                      <li key={l.expense.id}>
                        <span>
                          {l.expense.description}
                          <small>{shortDay(l.expense.date)} · total {formatBRL(l.expense.cents)}</small>
                        </span>
                        <b className="num">{formatBRL(l.cents)}</b>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
        <p className="acc-total">
          <span>Total</span>
          <b className="num">{formatBRL(total)}</b>
        </p>
      </div>
    );

  return (
    <section className="card person-account" aria-labelledby="h-account" ref={ref} tabIndex={-1}>
      <div className="card-head">
        <h2 id="h-account">Conta de cada um</h2>
      </div>
      <p className="hint">Toque num nome para ver, despesa por despesa, de onde vem o valor.</p>
      <div className="chips acc-chips" role="group" aria-label="De quem é a conta">
        {trip.people.map((p) => (
          <button key={p.id} type="button" className="chip" style={personStyle(p)} aria-pressed={p.id === person.id} onClick={() => onSelect(p.id)}>
            <Avatar person={p} size="xs" />
            {p.id === meId ? 'Você' : p.name}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="acc-body">
        {st.owesTo.length === 0 && st.owedBy.length === 0 && st.ownShare === 0 ? (
          <p className="muted">{subject} ainda não entrou em nenhuma despesa.</p>
        ) : (
          <>
            {block(`${subject} deve para quem pagou`, st.owesTo, st.owesTotal, (o) => <>Para <b>{name(o)}</b></>)}
            {block(`${me ? 'Você tem' : `${person.name} tem`} a receber`, st.owedBy, st.owedTotal, (o) => <>De <b>{name(o)}</b></>)}
            {st.ownShare > 0 && (
              <p className="acc-note">
                {me ? 'Sua parte nas despesas que você pagou' : `Parte de ${person.name} nas despesas que pagou`}: {formatBRL(st.ownShare)}. Já está paga, não entra no acerto.
              </p>
            )}

            <dl className="acc-sum">
              <div><dt>A receber</dt><dd className="num">{formatBRL(st.owedTotal)}</dd></div>
              <div><dt>Deve</dt><dd className="num">− {formatBRL(st.owesTotal)}</dd></div>
              {st.sent > 0 && <div><dt>Já mandou</dt><dd className="num">+ {formatBRL(st.sent)}</dd></div>}
              {st.received > 0 && <div><dt>Já recebeu</dt><dd className="num">− {formatBRL(st.received)}</dd></div>}
              <div className="acc-result">
                <dt>{st.balance > 0 ? 'Recebe' : st.balance < 0 ? 'Paga' : 'Está quite'}</dt>
                <dd className="num">{st.balance !== 0 && formatBRL(Math.abs(st.balance))}</dd>
              </div>
            </dl>

            {mine.length > 0 && (
              <div className="acc-final">
                <h3 className="field-label">No acerto</h3>
                <ul>
                  {mine.map((t) => (
                    <li key={`${t.from}-${t.to}`}>
                      {t.from === person.id ? (
                        <>{subject} paga <b className="num">{formatBRL(t.cents)}</b> para {name(t.to)}</>
                      ) : (
                        <>{name(t.from).replace(/^v/, 'V')} paga <b className="num">{formatBRL(t.cents)}</b> para {me ? 'você' : person.name}</>
                      )}
                    </li>
                  ))}
                </ul>
                {rerouted && mode === 'direct' && (
                  <p className="acc-why">
                    <b>Por que não é a soma de cada dívida?</b> Entre duas pessoas, o app desconta uma dívida da outra
                    {st.sent || st.received ? ' e os pagamentos já feitos' : ''}. Se {me ? 'você deve' : `${person.name} deve`} R$ 100
                    para alguém e essa pessoa {me ? 'te deve' : 'deve'} R$ 60, o Pix é só de R$ 40.
                  </p>
                )}
                {(compensated || rerouted) && mode === 'min' && (
                  <p className="acc-why">
                    <b>Por que não é a soma de cada dívida?</b> No modo Menos Pix, o app junta todas as contas da viagem: o que{' '}
                    {me ? 'te devem' : 'devem'} desconta do que {me ? 'você deve' : 'deve'}, e às vezes o Pix vai para outra pessoa.
                    O total de cada um é o mesmo. Para pagar cada um direto, escolha &quot;Direto para quem pagou&quot;.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
});
