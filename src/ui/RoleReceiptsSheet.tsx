import { useState } from 'react';
import { computeSplit, noteBill, noteLabel, notePhotos, type Bill, type Note } from '../core/bill';
import { formatBRL } from '../core/money';
import { categoryEmoji } from '../core/noteCategory';
import { downloadUrl, fileName } from './download';
import { IconDownload, IconReceipt } from './icons';
import { useReceiptUrl } from './viagem/useReceiptUrl';
import { Sheet } from './viagem/Sheet';

/** Notas do rolê que têm foto (nota fiscal, print, comprovante). */
export const notesWithPhoto = (bill: Bill) => (bill.notes ?? []).filter((n) => notePhotos(n).length > 0);
/** Quantas fotos o rolê tem, somando as de todas as notas. */
export const photosCount = (bill: Bill) => notesWithPhoto(bill).reduce((t, n) => t + notePhotos(n).length, 0);

function Card({ bill, note, photo, index, groupId, onOpen }: { bill: Bill; note: Note; photo: string; index: number; groupId: string | null; onOpen: () => void }) {
  const url = useReceiptUrl(photo, groupId);
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

function Big({ photo, label, groupId }: { photo: string; label: string; groupId: string | null }) {
  const url = useReceiptUrl(photo, groupId);
  if (!url) return <p className="hint">Carregando a foto…</p>;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto da nota no aparelho */}
      <img className="note-photo-big" src={url} alt={`Foto da nota ${label}`} />
      <button type="button" className="btn primary" onClick={() => downloadUrl(url, fileName(label))}>
        <IconDownload /> Baixar foto
      </button>
    </>
  );
}

/** Todas as notas e fotos do rolê num bloco só, separadas por categoria (como na Viagem). */
export function RoleReceiptsSheet({ bill, open, groupId = null, onClose }: { bill: Bill; open: boolean; groupId?: string | null; onClose: () => void }) {
  const [viewing, setViewing] = useState<{ photo: string; label: string } | null>(null);
  const all = bill.notes ?? [];
  const list = notesWithPhoto(bill);
  const cats = [...new Set(list.map((n) => n.category.trim() || 'Sem categoria'))];
  return (
    <Sheet open={open} onClose={() => (viewing ? setViewing(null) : onClose())} labelledBy="h-role-receipts">
      <div className="sheet-body receipts-sheet">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-role-receipts" tabIndex={-1}>{viewing ? `Nota ${viewing.label}` : 'Notas e fotos'}</h2>
        {viewing ? (
          <>
            <Big photo={viewing.photo} label={viewing.label} groupId={groupId} />
            <button type="button" className="btn secondary" onClick={() => setViewing(null)}>Voltar para as fotos</button>
          </>
        ) : list.length === 0 ? (
          <>
            <p className="hint">Nenhuma foto ainda. Use “Ler nota fiscal” em Pedidos: a foto fica guardada na nota.</p>
            <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
          </>
        ) : (
          <>
            <p className="hint">{photosCount(bill) === 1 ? '1 foto guardada' : `${photosCount(bill)} fotos guardadas`} neste rolê.</p>
            {cats.map((c) => {
              const items = list.filter((n) => (n.category.trim() || 'Sem categoria') === c);
              return (
                <section key={c} className="receipt-group" aria-label={c}>
                  <h3 className="receipt-group-head">
                    <span aria-hidden="true">{categoryEmoji(c)}</span> {c}
                  </h3>
                  <div className="receipt-grid">
                    {items.flatMap((n) => {
                      const i = all.findIndex((x) => x.id === n.id);
                      return notePhotos(n).map((photo) => (
                        <Card key={`${n.id}-${photo}`} bill={bill} note={n} photo={photo} index={i} groupId={groupId} onOpen={() => setViewing({ photo, label: noteLabel(n, i) })} />
                      ));
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
