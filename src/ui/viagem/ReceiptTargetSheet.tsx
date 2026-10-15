import { formatBRL } from '../../core/money';
import { activeExpenses, type Expense, type Trip } from '../../core/trip';
import { IconPlus, IconReceipt } from '../icons';
import { CategoryIcon } from './CategoryIcon';
import { Sheet } from './Sheet';
import { shortDay } from './tripDates';

interface Props {
  open: boolean;
  trip: Trip;
  meId: string | null;
  /** Lança uma despesa nova com a foto (lê o total). */
  onNew: () => void;
  /** Guarda a foto numa despesa que já existe. */
  onPick: (e: Expense) => void;
  onCancel: () => void;
}

/**
 * Depois da foto do "Ler nota fiscal": criar uma despesa nova com ela, ou só guardar numa
 * despesa que já existe (a nota que chegou depois, um comprovante, um print do extrato).
 * As despesas que você pagou vêm primeiro; dentro de cada parte, a mais nova em cima.
 */
export function ReceiptTargetSheet({ open, trip, meId, onNew, onPick, onCancel }: Props) {
  const newest = [...activeExpenses(trip)].sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq);
  const mine = newest.filter((e) => e.payerId === meId);
  const others = newest.filter((e) => e.payerId !== meId);
  const name = (id: string) => (id === meId ? 'Você' : trip.people.find((p) => p.id === id)?.name ?? '?');

  const list = (items: Expense[], title: string) =>
    items.length > 0 && (
      <section className="receipt-target-group" aria-label={title}>
        <h3>{title}</h3>
        <ul className="day-lines receipt-target-list">
          {items.map((e) => (
            <li key={e.id}>
              <button type="button" className="line" onClick={() => onPick(e)}>
                <span className="cat-tile"><CategoryIcon category={e.category} /></span>
                <span className="row-main">
                  <b>{e.description}</b>
                  <small>
                    <span>{shortDay(e.date)}</span>
                    {' · '}
                    <span><span className="payer">{name(e.payerId)}</span> pagou</span>
                    {e.receipt && <> · <span className="receipt-tag"><IconReceipt size={13} /> troca a foto atual</span></>}
                  </small>
                </span>
                <span className="line-end"><b className="num">{formatBRL(e.cents)}</b></span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <Sheet open={open} onClose={onCancel} labelledBy="h-receipt-target">
      <div className="sheet-body">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-receipt-target" tabIndex={-1}>Onde guardar esta foto?</h2>
        <p>Lance uma despesa nova com ela, ou só guarde numa despesa que já existe (a nota que chegou depois, um comprovante, um print do extrato).</p>
        <button type="button" className="btn primary big" onClick={onNew}>
          <IconPlus /> Criar uma despesa nova
        </button>
        {list(mine, 'Despesas que você pagou')}
        {list(others, mine.length ? 'Outras despesas' : 'Despesas da viagem')}
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </Sheet>
  );
}
