import { useState } from 'react';
import type { Person } from '../../core/bill';
import { formatBRL, parseBRL } from '../../core/money';
import type { Transfer } from '../../core/settle';
import { Avatar } from '../Avatar';
import { IconArrowRight } from '../icons';
import { Sheet } from './Sheet';

/** Um pagamento a registrar. De despesa parcelada: abate só dela. Sem `to`: paga no caixa (Rolê). */
export type SettleTarget = Omit<Transfer, 'to'> & { to: string | null; expenseId?: string; label?: string };

interface Props {
  /** Pessoas da viagem ou do rolê. */
  people: Person[];
  /** O pagamento sugerido pelo acerto (dá para registrar só uma parte). */
  transfer: SettleTarget | null;
  /** Registra o valor digitado. */
  onPay: (t: SettleTarget, cents: number) => void;
  /** O que acontece quando pagam a mais (padrão: o app refaz o acerto). */
  overHint?: string;
  onClose: () => void;
}

/** Registrar um pagamento real entre duas pessoas: o valor todo ou uma parte (ex.: uma parcela). */
export function SettleSheet({ transfer, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!transfer} onClose={onClose} labelledBy="h-settle" focus="#settle-amount">
      {transfer && <SettleForm key={`${transfer.from}-${transfer.to}-${transfer.expenseId ?? ''}`} transfer={transfer} onClose={onClose} {...rest} />}
    </Sheet>
  );
}

function SettleForm({ people, transfer, onPay, overHint = 'o app refaz a conta de quem paga quem', onClose }: Props & { transfer: SettleTarget }) {
  const [amount, setAmount] = useState(formatBRL(transfer.cents).replace(/^R\$\s?/, ''));
  const [error, setError] = useState('');
  const from = people.find((p) => p.id === transfer.from)!;
  const to = people.find((p) => p.id === transfer.to);
  const cents = parseBRL(amount);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!cents) {
      setError('Digite quanto foi pago.');
      return;
    }
    onPay(transfer, cents);
    onClose();
  }

  return (
    <form className="sheet-body" onSubmit={save}>
      <span className="sheet-grip" aria-hidden="true" />
      <h2 id="h-settle" tabIndex={-1}>{transfer.label ? 'Pagar parcela' : 'Registrar pagamento'}</h2>
      {transfer.label && <p className="settle-label">{transfer.label}</p>}
      <div className="settle-pair">
        <span className="settle-who"><Avatar person={from} size="lg" /><b>{from.name}</b></span>
        {to && (
          <>
            <span className="settle-arrow" aria-hidden="true"><IconArrowRight /></span>
            <span className="settle-who"><Avatar person={to} size="lg" /><b>{to.name}</b></span>
          </>
        )}
      </div>
      <p className="sr">{to ? `${from.name} pagou para ${to.name}` : `${from.name} pagou no caixa`}</p>

      <div className="money big-money">
        <span aria-hidden="true">R$</span>
        <label className="sr" htmlFor="settle-amount">Quanto {from.name} pagou</label>
        <input
          id="settle-amount"
          className="input"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          aria-invalid={amount.trim() !== '' && !cents}
          onChange={(e) => {
            setAmount(e.target.value);
            setError('');
          }}
        />
      </div>
      <p className="hint" aria-live="polite">
        {cents && cents < transfer.cents
          ? `Pagamento parcial: depois dele, faltam ${formatBRL(transfer.cents - cents)}.`
          : cents && cents > transfer.cents
            ? `É ${formatBRL(cents - transfer.cents)} a mais do que este acerto: ${overHint}.`
            : 'Pode ser só uma parte, como uma parcela. O resto continua no acerto.'}
      </p>
      <p className="field-error" role="alert">{error}</p>

      <div className="sheet-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn primary">Registrar</button>
      </div>
    </form>
  );
}
