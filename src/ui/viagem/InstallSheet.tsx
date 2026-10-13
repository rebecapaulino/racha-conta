import { useState, type Dispatch } from 'react';
import { formatBRL } from '../../core/money';
import { installmentInfo, MAX_INSTALLMENTS, pairKey, type SettleRow, type Trip } from '../../core/trip';
import type { TripAction } from '../../state/tripState';
import { Avatar } from '../Avatar';
import { IconArrowRight, IconCheck, IconMinus, IconPlus } from '../icons';
import { Sheet } from './Sheet';

interface Props {
  trip: Trip;
  row: SettleRow | null;
  meId: string | null;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string) => void;
  onClose: () => void;
}

const QUICK = [1, 2, 3, 4, 6, 10, 12];

/** Em quantas vezes um pagamento do acerto vai ser pago. Cada parcela vira um "Pagar parcela". */
export function InstallSheet({ row, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!row} onClose={onClose} labelledBy="h-install">
      {row && <InstallForm key={`${row.from}-${row.to}`} row={row} onClose={onClose} {...rest} />}
    </Sheet>
  );
}

function InstallForm({ trip, row, meId, dispatch, toast, onClose }: Props & { row: SettleRow }) {
  const [count, setCount] = useState(trip.installments?.[pairKey(row.from, row.to)] ?? 1);
  const from = trip.people.find((p) => p.id === row.from)!;
  const to = trip.people.find((p) => p.id === row.to)!;
  const called = (id: string) => (id === meId ? 'Você' : trip.people.find((p) => p.id === id)!.name);
  const info = installmentInfo(row.cents, row.paid, count);
  const step = (d: number) => setCount((c) => Math.min(MAX_INSTALLMENTS, Math.max(1, c + d)));

  function save() {
    dispatch({ type: 'setInstallments', from: row.from, to: row.to, count });
    toast(count === 1 ? 'Pagamento de uma vez' : `Parcelado em ${count}x`);
    onClose();
  }

  return (
    <div className="sheet-body">
      <span className="sheet-grip" aria-hidden="true" />
      <h2 id="h-install" tabIndex={-1}>Parcelar pagamento</h2>
      <div className="settle-pair">
        <span className="settle-who"><Avatar person={from} size="lg" /><b>{called(from.id)}</b></span>
        <span className="settle-arrow" aria-hidden="true"><IconArrowRight /></span>
        <span className="settle-who"><Avatar person={to} size="lg" /><b>{called(to.id)}</b></span>
      </div>
      <p className="install-total">
        Total <b className="num">{formatBRL(row.cents)}</b>
        {row.paid > 0 && <> · <span className="amt-pos">já pagou {formatBRL(row.paid)}</span></>}
      </p>

      <div className="note-field">
        <h3 className="field-label" id="h-install-count">Em quantas vezes?</h3>
        <div className="weight-row">
          <div className="stepper" role="group" aria-labelledby="h-install-count">
            <button type="button" onClick={() => step(-1)} disabled={count <= 1} aria-label="Menos parcelas">
              <IconMinus size={18} />
            </button>
            <output aria-live="polite">{count}x</output>
            <button type="button" onClick={() => step(1)} disabled={count >= MAX_INSTALLMENTS} aria-label="Mais parcelas">
              <IconPlus size={18} />
            </button>
          </div>
          <div className="chips weight-presets">
            {QUICK.map((n) => (
              <button key={n} type="button" className="chip" aria-pressed={count === n} onClick={() => setCount(n)}>
                {n === 1 ? 'De uma vez' : `${n}x`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {count > 1 && (
        <ol className="install-list" aria-label="Parcelas">
          {info.parts.map((c, i) => (
            <li key={i} className={i < info.paidCount ? 'is-paid' : undefined}>
              <span>{i + 1}ª parcela</span>
              <b className="num">{formatBRL(c)}</b>
              {i < info.paidCount && <span className="amt-pos install-ok"><IconCheck size={14} /> paga</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="hint">
        O botão vira &quot;Pagar parcela&quot;: cada toque registra uma parcela, e o que falta continua no acerto.
      </p>

      <div className="sheet-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn primary" onClick={save}>Salvar</button>
      </div>
    </div>
  );
}
