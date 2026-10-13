import { forwardRef, type ReactNode } from 'react';
import { formatBRL } from '../../core/money';
import type { Transfer } from '../../core/settle';
import { accountMembers, accountOf, personStatement, type PairDebt, type SettleMode, type Trip } from '../../core/trip';
import { Avatar, personStyle } from '../Avatar';
import { Signed } from './Signed';
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
  // Quem tem a parte paga por outro acerta pela conta dele (Rebeca → Robin).
  const account = accountOf(trip, person.id);
  const sponsor = account !== person.id ? trip.people.find((p) => p.id === account) : undefined;
  const members = accountMembers(trip, person.id);
  const mine = transfers.filter((t) => t.from === account || t.to === account);
  // O Pix final só bate com a soma das dívidas quando não há nada para compensar.
  const compensated = st.owesTo.length > 0 && st.owedBy.length > 0;
  const rerouted = !sponsor && mine.some((t) => {
    const other = t.from === account ? t.to : t.from;
    const pair = (t.from === account ? st.owesTo : st.owedBy).find((d) => d.other === other);
    return pair?.cents !== t.cents;
  });

  const block = (title: string, debts: PairDebt[], total: number, verb: (other: string) => ReactNode, sign: 1 | -1) =>
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
                    <Signed cents={sign * d.cents} />
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
          <Signed cents={sign * total} />
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
            {block(`${subject} deve para quem pagou`, st.owesTo, st.owesTotal, (o) => <>Para <b>{name(o)}</b></>, -1)}
            {block(`${me ? 'Você tem' : `${person.name} tem`} a receber`, st.owedBy, st.owedTotal, (o) => <>De <b>{name(o)}</b></>, 1)}
            {st.ownShare > 0 && (
              <p className="acc-note">
                {me ? 'Sua parte nas despesas que você pagou' : `Parte de ${person.name} nas despesas que pagou`}: {formatBRL(st.ownShare)}. Já está paga, não entra no acerto.
              </p>
            )}

            <dl className="acc-sum">
              <div><dt>A receber</dt><dd><Signed cents={st.owedTotal} /></dd></div>
              <div><dt>Deve</dt><dd><Signed cents={-st.owesTotal} /></dd></div>
              {st.sent > 0 && <div><dt>Já mandou</dt><dd><Signed cents={st.sent} /></dd></div>}
              {st.received > 0 && <div><dt>Já recebeu</dt><dd><Signed cents={-st.received} /></dd></div>}
              <div className="acc-result">
                <dt>{st.balance > 0 ? 'Recebe' : st.balance < 0 ? 'Paga' : 'Está quite'}</dt>
                <dd>{st.balance !== 0 && <Signed cents={st.balance} />}</dd>
              </div>
            </dl>

            {sponsor && (
              <p className="acc-covered">
                <b>{sponsor.id === meId ? 'Você paga' : `${sponsor.name} paga`} {me ? 'a sua parte' : `a parte de ${person.name}`}.</b>{' '}
                No acerto, esse valor entra na conta {sponsor.id === meId ? 'sua' : `de ${sponsor.name}`}, junto com o resto.
              </p>
            )}
            {members.length > 0 && (
              <p className="acc-covered">
                <b>{me ? 'Você também paga' : `${person.name} também paga`} a parte de {members.map((m) => (m.id === meId ? 'você' : m.name)).join(', ')}.</b>{' '}
                O acerto abaixo já inclui {members.length === 1 ? 'essa parte' : 'essas partes'}.
              </p>
            )}
            {mine.length > 0 && (
              <div className="acc-final">
                <h3 className="field-label">{sponsor ? `No acerto (pela conta ${sponsor.id === meId ? 'sua' : `de ${sponsor.name}`})` : 'No acerto'}</h3>
                <ul>
                  {mine.map((t) => (
                    <li key={`${t.from}-${t.to}`}>
                      {t.from === account ? (
                        <>{sponsor ? name(account).replace(/^v/, 'V') : subject} paga <Signed cents={-t.cents} /> para {name(t.to)}</>
                      ) : (
                        <>{sponsor ? name(account).replace(/^v/, 'V') : subject} recebe <Signed cents={t.cents} /> de {name(t.from)}</>
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
                {!sponsor && (compensated || rerouted) && mode === 'min' && (
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
