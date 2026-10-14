import { useEffect, useRef, useState, type Dispatch } from 'react';
import { computeSplit, noteBill, noteLabel, summaryText, type Bill, type Note } from '../core/bill';
import { formatBRL } from '../core/money';
import { newId, type Action } from '../state/billState';
import { getPhoto } from '../state/photos';
import { downloadUrl, fileName } from './download';
import { IconDownload, IconImage, IconPencil, IconPlus, IconReceipt, IconShare, IconX } from './icons';
import { Sheet } from './viagem/Sheet';
import { categoryEmoji } from '../core/noteCategory';
import { NoteSheet, type NoteSheetMode } from './NoteSheet';
import { usePhotoUrl } from './usePhotoUrl';
import { notesWithPhoto, RoleReceiptsSheet } from './RoleReceiptsSheet';

interface Props {
  /** A conta inteira (com todas as notas). */
  bill: Bill;
  /** Nota aberta, ou null quando a conta é de uma nota só. */
  active: Note | null;
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
  /** Muda quando uma nota acabou de ser criada pela leitura da foto: abre a nota para completar. */
  editRequest?: number;
}

/**
 * Notas fiscais da conta (ex.: a do bar e a dos doces): troca a nota aberta em Pedidos e
 * Divisão, cria uma nova e edita a aberta (categoria, quem pagou, quem divide, foto).
 */
export function NotesBar({ bill, active, dispatch, toast, editRequest }: Props) {
  const [mode, setMode] = useState<NoteSheetMode | null>(null);
  // Nota a apagar (pelo X em cima dela), esperando a confirmação.
  const [deleting, setDeleting] = useState<{ id: string; label: string; items: number } | null>(null);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const photoRef = useRef<HTMLDialogElement>(null);
  const notes = bill.notes ?? [];
  // Conta de uma nota só: ela aparece como "Nota 1" e vira nota de verdade ao ser editada.
  // Conta vazia (sem nota e sem item): não mostra "Nota 1 · R$ 0,00", só o "Adicionar nota".
  const single: Note = { id: '', category: '', servicePct: bill.servicePct, payerId: bill.payerId, people: bill.people.map((p) => p.id), photoId: null };
  const shown: Note[] = notes.length ? notes : bill.items.length ? [single] : [];
  const current = active ?? shown[0] ?? single;
  const index = Math.max(0, shown.findIndex((n) => n.id === current.id));
  const label = noteLabel(current, index);
  // "Nota Doces", mas "Nota 2" (e não "Nota Nota 2").
  const named = current.category.trim() ? `Nota ${label}` : label;
  const photoUrl = usePhotoUrl(current.photoId);

  // A foto fica pronta antes do toque: o celular só abre o menu de compartilhar logo depois dele.
  const photoBlob = useRef<Blob | null>(null);
  useEffect(() => {
    photoBlob.current = null;
    if (!current.photoId) return;
    let alive = true;
    getPhoto(current.photoId).then((b) => alive && (photoBlob.current = b));
    return () => {
      alive = false;
    };
  }, [current.photoId]);

  const payer = bill.people.find((p) => p.id === current.payerId);
  const meta: string[] = [];
  if (payer) meta.push(`paga por ${payer.name}`);
  if (bill.people.length) {
    const n = current.people.length;
    meta.push(n === bill.people.length ? 'todos dividem' : n === 0 ? 'ninguém divide' : `${n} de ${bill.people.length} dividem`);
  }

  async function share() {
    const text = summaryText(noteBill(bill, current.id || null));
    const blob = photoBlob.current;
    const file = blob ? new File([blob], `nota-${label.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}.jpg`, { type: blob.type || 'image/jpeg' }) : null;
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
      } catch (e) {
        if ((e as DOMException).name === 'NotAllowedError') toast('Toque de novo em Compartilhar.');
      }
      return;
    }
    // Sem compartilhar arquivos (computador): baixa a foto e copia o resumo.
    if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    navigator.clipboard?.writeText(text).then(
      () => toast(file ? 'Foto baixada e resumo copiado' : 'Resumo copiado'),
      () => toast(file ? 'Foto baixada' : 'Não deu para copiar'),
    );
  }

  function edit(intro?: string) {
    const items = noteBill(bill, current.id || null).items.length;
    setMode({ kind: 'edit', note: current.id ? current : { ...current, id: newId() }, label: named, items, intro });
  }

  // Pedido novo (nota criada pela foto): abre a nota aberta, que é a recém-criada.
  const [seenRequest, setSeenRequest] = useState(editRequest);
  if (editRequest !== seenRequest) {
    setSeenRequest(editRequest);
    const n = noteBill(bill, current.id || null).items.length;
    edit(`${n === 1 ? 'O item da foto foi' : `Os ${n} itens da foto foram`} para esta nota. Diga a categoria, quem pagou e quem divide.`);
  }

  return (
    <section className="notes-bar" aria-label="Notas fiscais da conta">
      <div className="notes-strip">
        {shown.map((n, i) => {
          const total = computeSplit(noteBill(bill, n.id || null));
          const on = n.id === current.id;
          const items = noteBill(bill, n.id || null).items.length;
          const chipLabel = n.category.trim() ? `Nota ${noteLabel(n, i)}` : noteLabel(n, i);
          return (
            <span key={n.id || 'unica'} className="note-chip-wrap">
              <button
                type="button"
                className="note-chip"
                aria-pressed={on}
                onClick={() => {
                  if (!on) dispatch({ type: 'selectNote', id: n.id });
                  // Nota com foto: abre a nota fiscal (para ver, baixar ou compartilhar).
                  if (n.photoId) photoRef.current?.showModal?.();
                }}
              >
                <span className="note-emoji" aria-hidden="true">{categoryEmoji(n.category)}</span>
                <span className="note-chip-text">
                  <b>{noteLabel(n, i)}</b>
                  <small className="num">{formatBRL(total.total + total.unassigned)}</small>
                </span>
              </button>
              {(notes.length > 0 || items > 0) && (
                <button
                  type="button"
                  className="note-x"
                  aria-label={`Apagar ${chipLabel}`}
                  onClick={() => setDeleting({ id: n.id, label: chipLabel, items })}
                >
                  <IconX size={14} />
                </button>
              )}
            </span>
          );
        })}
        <button type="button" className="note-chip note-add" onClick={() => setMode({ kind: 'create' })}>
          <IconPlus size={18} /> {shown.length === 0 ? 'Adicionar nota' : notes.length > 1 ? 'Nota' : 'Outra nota'}
        </button>
      </div>

      {shown.length > 0 && <div className="notes-meta">
        <span className="notes-meta-text">{meta.join(' · ')}</span>
        {photoUrl && (
          <button type="button" className="note-thumb" onClick={() => photoRef.current?.showModal?.()} aria-label={`Ver a foto: ${named}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto local da nota */}
            <img src={photoUrl} alt="" />
          </button>
        )}
        <button type="button" className="link-btn notes-edit" onClick={() => edit()} aria-label={`Editar ${named}`}>
          <IconPencil size={16} /> Editar
        </button>
      </div>}

      <button type="button" className="btn secondary receipts-btn" onClick={() => setReceiptsOpen(true)}>
        <IconReceipt size={18} /> Notas fiscais ({notesWithPhoto(bill).length})
      </button>
      <RoleReceiptsSheet bill={bill} open={receiptsOpen} onClose={() => setReceiptsOpen(false)} />

      <NoteSheet
        mode={mode}
        people={bill.people}
        notesCount={notes.length}
        dispatch={dispatch}
        toast={toast}
        onClose={() => setMode(null)}
      />

      <Sheet open={!!deleting} onClose={() => setDeleting(null)} labelledBy="h-note-del">
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-note-del" tabIndex={-1}>Apagar {deleting?.label}?</h2>
          <p>
            {deleting?.items
              ? `${deleting.items === 1 ? 'O item dela sai' : `Os ${deleting.items} itens dela saem`} da conta.`
              : 'Ela não tem itens.'}{' '}
            {notes.length < 2 ? 'As pessoas da mesa continuam.' : ''}
          </p>
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => setDeleting(null)}>Cancelar</button>
            <button
              type="button"
              className="btn primary danger"
              onClick={() => {
                if (!deleting) return;
                dispatch({ type: 'removeNote', id: deleting.id });
                toast(`${deleting.label} apagada`);
                setDeleting(null);
              }}
            >
              Apagar
            </button>
          </div>
        </div>
      </Sheet>

      <dialog
        ref={photoRef}
        className="sheet"
        aria-labelledby="h-note-photo"
        onClick={(e) => e.target === e.currentTarget && photoRef.current?.close()}
      >
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-note-photo"><IconImage size={20} /> {named}</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- foto local da nota */}
          {photoUrl && <img className="note-photo-big" src={photoUrl} alt={`Foto da ${named.toLowerCase()}`} />}
          <div className="sheet-actions">
            {photoUrl && (
              <button type="button" className="btn secondary" onClick={() => downloadUrl(photoUrl, fileName(label))}>
                <IconDownload /> Baixar
              </button>
            )}
            <button type="button" className="btn primary" onClick={share}>
              <IconShare /> Compartilhar
            </button>
          </div>
          <p className="hint">Vai a foto e quanto cada um paga nesta nota.</p>
          <button type="button" className="btn ghost" onClick={() => photoRef.current?.close()}>Fechar</button>
        </div>
      </dialog>
    </section>
  );
}
