import { useState, type Dispatch } from 'react';
import { formatBRL, parseBRL } from '../../core/money';
import type { Transfer } from '../../core/settle';
import type { Trip } from '../../core/trip';
import { newId } from '../../state/billState';
import type { TripAction } from '../../state/tripState';
import { Avatar } from '../Avatar';
import { IconArrowRight } from '../icons';
import { Sheet } from './Sheet';

interface Props {
  trip: Trip;
  /** O pagamento sugerido pelo acerto (dá para registrar só uma parte). */
  transfer: Transfer | null;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string, undo?: () => void) => void;
  onClose: () => void;
}

/** Registrar um pagamento real entre duas pessoas: o valor todo ou uma parte (ex.: uma parcela). */
export function SettleSheet({ transfer, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!transfer} onClose={onClose} labelledBy="h-settle" focus="#settle-amount">
      {transfer && <SettleForm key={`${transfer.from}-${transfer.to}`} transfer={transfer} onClose={onClose} {...rest} />}
    </Sheet>
  );
}

function SettleForm({ trip, transfer, dispatch, toast, onClose }: Props & { transfer: Transfer }) {
  const [amount, setAmount] = useState(formatBRL(transfer.cents).replace(/^R\$\s?/, ''));
  const [error, setError] = useState('');
  const from = trip.people.find((p) => p.id === transfer.from)!;
  const to = trip.people.find((p) => p.id === transfer.to)!;
  const cents = parseBRL(amount);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!cents) {
      setError('Digite quanto foi pago.');
      return;
    }
    const id = newId();
    dispatch({ type: 'settle', id, from: from.id, to: to.id, cents });
    toast(`${from.name} pagou ${formatBRL(cents)} para ${to.name}`, () => dispatch({ type: 'unsettle', id }));
    onClose();
  }

  return (
    <form className="sheet-body" onSubmit={save}>
      <span className="sheet-grip" aria-hidden="true" />
      <h2 id="h-settle" tabIndex={-1}>Registrar pagamento</h2>
      <div className="settle-pair">
        <span className="settle-who"><Avatar person={from} size="lg" /><b>{from.name}</b></span>
        <span className="settle-arrow" aria-hidden="true"><IconArrowRight /></span>
        <span className="settle-who"><Avatar person={to} size="lg" /><b>{to.name}</b></span>
      </div>
      <p className="sr">{from.name} pagou para {to.name}</p>

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
            ? `É ${formatBRL(cents - transfer.cents)} a mais do que este acerto: o app refaz a conta de quem paga quem.`
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
