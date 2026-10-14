import { useState } from 'react';
import { computeSplit, noteBill, noteLabel, type Bill, type Note } from '../core/bill';
import { formatBRL } from '../core/money';
import { categoryEmoji } from '../core/noteCategory';
import { downloadUrl, fileName } from './download';
import { IconDownload, IconReceipt } from './icons';
import { useReceiptUrl } from './viagem/useReceiptUrl';
import { Sheet } from './viagem/Sheet';

/** Notas do rolê que têm foto. */
export const notesWithPhoto = (bill: Bill) => (bill.notes ?? []).filter((n) => !!n.photoId);

function Card({ bill, note, index, groupId, onOpen }: { bill: Bill; note: Note; index: number; groupId: string | null; onOpen: () => void }) {
  const url = useReceiptUrl(note.photoId, groupId);
  const total = computeSplit(noteBill(bill, note.id)).total;
  return (
    <button type="button" className="receipt-card" onClick={onOpen} aria-label={`Ver a nota ${noteLabel(note, index)}, ${formatBRL(total)}`}>
      <span className="receipt-card-img">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto da nota no aparelho */}
        {url ? <img src={url} alt="" /> : <IconReceipt size={24} />}
      </span>
      <span className="receipt-card-text">
        <b>{noteLabel(note, index)}</b>
        <small className="num">{formatBRL(total)}</small>
      </span>
    </button>
  );
}

function Big({ note, label, groupId }: { note: Note; label: string; groupId: string | null }) {
  const url = useReceiptUrl(note.photoId, groupId);
  if (!url) return <p className="hint">Carregando a foto…</p>;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto da nota no aparelho */}
      <img className="note-photo-big" src={url} alt={`Nota fiscal ${label}`} />
      <button type="button" className="btn primary" onClick={() => downloadUrl(url, fileName(label))}>
        <IconDownload /> Baixar nota
      </button>
    </>
  );
}

/** Todas as notas fiscais do rolê num bloco só, separadas por categoria (como na Viagem). */
export function RoleReceiptsSheet({ bill, open, groupId = null, onClose }: { bill: Bill; open: boolean; groupId?: string | null; onClose: () => void }) {
  const [viewing, setViewing] = useState<{ note: Note; label: string } | null>(null);
  const all = bill.notes ?? [];
  const list = notesWithPhoto(bill);
  const cats = [...new Set(list.map((n) => n.category.trim() || 'Sem categoria'))];
  return (
    <Sheet open={open} onClose={() => (viewing ? setViewing(null) : onClose())} labelledBy="h-role-receipts">
      <div className="sheet-body receipts-sheet">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-role-receipts" tabIndex={-1}>{viewing ? `Nota ${viewing.label}` : 'Notas fiscais'}</h2>
        {viewing ? (
          <>
            <Big note={viewing.note} label={viewing.label} groupId={groupId} />
            <button type="button" className="btn secondary" onClick={() => setViewing(null)}>Voltar para as notas</button>
          </>
        ) : list.length === 0 ? (
          <>
            <p className="hint">Nenhuma nota com foto ainda. Use “Ler nota fiscal” em Pedidos: a foto fica guardada na nota.</p>
            <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
          </>
        ) : (
          <>
            <p className="hint">{list.length === 1 ? '1 nota guardada' : `${list.length} notas guardadas`} neste rolê.</p>
            {cats.map((c) => {
              const items = list.filter((n) => (n.category.trim() || 'Sem categoria') === c);
              return (
                <section key={c} className="receipt-group" aria-label={c}>
                  <h3 className="receipt-group-head">
                    <span aria-hidden="true">{categoryEmoji(c)}</span> {c}
                  </h3>
                  <div className="receipt-grid">
                    {items.map((n) => {
                      const i = all.findIndex((x) => x.id === n.id);
                      return <Card key={n.id} bill={bill} note={n} index={i} groupId={groupId} onOpen={() => setViewing({ note: n, label: noteLabel(n, i) })} />;
                    })}
                  </div>
                </section>
              );
            })}
            <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
