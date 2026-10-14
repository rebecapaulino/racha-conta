import { useState } from 'react';
import { formatBRL } from '../../core/money';
import { activeExpenses, categoryLabel, TRIP_CATEGORIES, type Expense, type Trip } from '../../core/trip';
import { downloadUrl, fileName } from '../download';
import { IconDownload, IconReceipt } from '../icons';
import { CategoryIcon } from './CategoryIcon';
import { Sheet } from './Sheet';
import { dayLabel } from './tripDates';
import { useReceiptUrl } from './useReceiptUrl';

/** As despesas da viagem que têm foto da nota (para o botão e para o bloco). */
export const withReceipt = (trip: Trip) => activeExpenses(trip).filter((e) => !!e.receipt);

function Thumb({ expense, groupId, onOpen }: { expense: Expense; groupId: string | null; onOpen: () => void }) {
  const url = useReceiptUrl(expense.receipt ?? null, groupId);
  return (
    <button type="button" className="receipt-card" onClick={onOpen} aria-label={`Ver a nota de ${expense.description}, ${formatBRL(expense.cents)}`}>
      <span className="receipt-card-img">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto da nota no aparelho */}
        {url ? <img src={url} alt="" /> : <IconReceipt size={24} />}
      </span>
      <span className="receipt-card-text">
        <b>{expense.description}</b>
        <small>{dayLabel(expense.date)} · <span className="num">{formatBRL(expense.cents)}</span></small>
      </span>
    </button>
  );
}

function Big({ expense, groupId }: { expense: Expense; groupId: string | null }) {
  const url = useReceiptUrl(expense.receipt ?? null, groupId);
  if (!url) return <p className="hint">Baixando a foto…</p>;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto da nota no aparelho */}
      <img className="note-photo-big" src={url} alt={`Nota fiscal de ${expense.description}`} />
      <button type="button" className="btn primary" onClick={() => downloadUrl(url, fileName(expense.description))}>
        <IconDownload /> Baixar nota
      </button>
    </>
  );
}

/** Todas as notas fiscais da viagem num bloco só, separadas por categoria. */
export function ReceiptsSheet({ trip, groupId, open, onClose }: { trip: Trip; groupId: string | null; open: boolean; onClose: () => void }) {
  const [viewing, setViewing] = useState<Expense | null>(null);
  const list = withReceipt(trip);
  const groups = TRIP_CATEGORIES.map((c) => ({ id: c.id, items: list.filter((e) => e.category === c.id) })).filter((g) => g.items.length > 0);
  return (
    <Sheet open={open} onClose={() => (viewing ? setViewing(null) : onClose())} labelledBy="h-receipts">
      <div className="sheet-body receipts-sheet">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-receipts" tabIndex={-1}>{viewing ? viewing.description : 'Notas fiscais'}</h2>
        {viewing ? (
          <>
            <p className="hint">{dayLabel(viewing.date)} · {formatBRL(viewing.cents)}</p>
            <Big expense={viewing} groupId={groupId} />
            <button type="button" className="btn secondary" onClick={() => setViewing(null)}>Voltar para as notas</button>
          </>
        ) : (
          <>
            <p className="hint">
              {list.length === 1 ? '1 nota guardada' : `${list.length} notas guardadas`} nas despesas{groupId ? ', para todo o grupo ver' : ''}.
            </p>
            {groups.map((g) => (
              <section key={g.id} className="receipt-group" aria-labelledby={`h-rc-${g.id}`}>
                <h3 id={`h-rc-${g.id}`} className="receipt-group-head">
                  <span className="cat-tile"><CategoryIcon category={g.id} size={16} /></span>
                  {categoryLabel(trip, g.id)}
                  <small className="num">{formatBRL(g.items.reduce((a, e) => a + e.cents, 0))}</small>
                </h3>
                <div className="receipt-grid">
                  {g.items.map((e) => (
                    <Thumb key={e.id} expense={e} groupId={groupId} onOpen={() => setViewing(e)} />
                  ))}
                </div>
              </section>
            ))}
            <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
