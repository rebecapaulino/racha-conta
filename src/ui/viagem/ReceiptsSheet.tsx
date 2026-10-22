import { useState } from 'react';
import { formatBRL } from '../../core/money';
import { activeExpenses, categoryLabel, expensePhotos, TRIP_CATEGORIES, type Expense, type Trip } from '../../core/trip';
import { downloadUrl, fileName } from '../download';
import { IconDownload, IconReceipt } from '../icons';
import { CategoryIcon } from './CategoryIcon';
import { Sheet } from './Sheet';
import { dayLabel } from './tripDates';
import { useReceiptUrl } from './useReceiptUrl';

/** As despesas da viagem que têm foto (nota, print, comprovante), para o botão e para o bloco. */
export const withReceipt = (trip: Trip) => activeExpenses(trip).filter((e) => expensePhotos(e).length > 0);

/** Uma foto do bloco: a despesa e qual das fotos dela. */
type Shown = { expense: Expense; photo: string };

function Thumb({ expense, photo, groupId, onOpen }: { expense: Expense; photo: string; groupId: string | null; onOpen: () => void }) {
  const url = useReceiptUrl(photo, groupId);
  return (
    <button type="button" className="receipt-card" onClick={onOpen} aria-label={`Ver a foto de ${expense.description}, ${formatBRL(expense.cents)}`}>
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

function Big({ expense, photo, groupId }: { expense: Expense; photo: string; groupId: string | null }) {
  const url = useReceiptUrl(photo, groupId);
  if (!url) return <p className="hint">Baixando a foto…</p>;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto da despesa no aparelho */}
      <img className="note-photo-big" src={url} alt={`Foto de ${expense.description}`} />
      <button type="button" className="btn primary" onClick={() => downloadUrl(url, fileName(expense.description))}>
        <IconDownload /> Baixar foto
      </button>
    </>
  );
}

/** Todas as notas e fotos da viagem num bloco só, separadas por categoria (cada foto da despesa aparece). */
export function ReceiptsSheet({ trip, groupId, open, onClose }: { trip: Trip; groupId: string | null; open: boolean; onClose: () => void }) {
  const [viewing, setViewing] = useState<Shown | null>(null);
  const list = withReceipt(trip);
  const groups = TRIP_CATEGORIES.map((c) => ({ id: c.id, items: list.filter((e) => e.category === c.id) })).filter((g) => g.items.length > 0);
  return (
    <Sheet open={open} onClose={() => (viewing ? setViewing(null) : onClose())} labelledBy="h-receipts">
      <div className="sheet-body receipts-sheet">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-receipts" tabIndex={-1}>{viewing ? viewing.expense.description : 'Notas e fotos'}</h2>
        {viewing ? (
          <>
            <p className="hint">{dayLabel(viewing.expense.date)} · {formatBRL(viewing.expense.cents)}</p>
            <Big expense={viewing.expense} photo={viewing.photo} groupId={groupId} />
            <button type="button" className="btn secondary" onClick={() => setViewing(null)}>Voltar para as fotos</button>
          </>
        ) : (
          <>
            <p className="hint">
              {(() => {
                const n = list.reduce((t, e) => t + expensePhotos(e).length, 0);
                return n === 1 ? '1 foto guardada' : `${n} fotos guardadas`;
              })()} nas despesas{groupId ? ', para todo o grupo ver' : ''}.
            </p>
            {groups.map((g) => (
              <section key={g.id} className="receipt-group" aria-labelledby={`h-rc-${g.id}`}>
                <h3 id={`h-rc-${g.id}`} className="receipt-group-head">
                  <span className="cat-tile"><CategoryIcon category={g.id} size={16} /></span>
                  {categoryLabel(trip, g.id)}
                  <small className="num">{formatBRL(g.items.reduce((a, e) => a + e.cents, 0))}</small>
                </h3>
                <div className="receipt-grid">
                  {g.items.flatMap((e) =>
                    expensePhotos(e).map((photo) => (
                      <Thumb key={`${e.id}-${photo}`} expense={e} photo={photo} groupId={groupId} onOpen={() => setViewing({ expense: e, photo })} />
                    )),
                  )}
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
