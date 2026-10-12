import { useRef, useState, type Dispatch } from 'react';
import { computeSplit, noteBill, noteLabel, type Bill, type Note } from '../core/bill';
import { formatBRL } from '../core/money';
import { newId, type Action } from '../state/billState';
import { IconImage, IconPencil, IconPlus } from './icons';
import { categoryEmoji } from './noteCategory';
import { NoteSheet, type NoteSheetMode } from './NoteSheet';
import { usePhotoUrl } from './usePhotoUrl';

interface Props {
  /** A conta inteira (com todas as notas). */
  bill: Bill;
  /** Nota aberta, ou null quando a conta é de uma nota só. */
  active: Note | null;
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
}

/**
 * Notas fiscais da conta (ex.: a do bar e a dos doces): troca a nota aberta em Pedidos e
 * Divisão, cria uma nova e edita a aberta (categoria, quem pagou, quem divide, foto).
 */
export function NotesBar({ bill, active, dispatch, toast }: Props) {
  const [mode, setMode] = useState<NoteSheetMode | null>(null);
  const photoRef = useRef<HTMLDialogElement>(null);
  const notes = bill.notes ?? [];
  // Conta de uma nota só: ela aparece como "Nota 1" e vira nota de verdade ao ser editada.
  const shown: Note[] = notes.length
    ? notes
    : [{ id: '', category: '', servicePct: bill.servicePct, payerId: bill.payerId, people: bill.people.map((p) => p.id), photoId: null }];
  const current = active ?? shown[0];
  const index = Math.max(0, shown.findIndex((n) => n.id === current.id));
  const label = noteLabel(current, index);
  // "Nota Doces", mas "Nota 2" (e não "Nota Nota 2").
  const named = current.category.trim() ? `Nota ${label}` : label;
  const photoUrl = usePhotoUrl(current.photoId);

  const payer = bill.people.find((p) => p.id === current.payerId);
  const meta: string[] = [];
  if (payer) meta.push(`paga por ${payer.name}`);
  if (bill.people.length) {
    const n = current.people.length;
    meta.push(n === bill.people.length ? 'todos dividem' : n === 0 ? 'ninguém divide' : `${n} de ${bill.people.length} dividem`);
  }

  function edit() {
    const items = noteBill(bill, current.id || null).items.length;
    setMode({ kind: 'edit', note: current.id ? current : { ...current, id: newId() }, label: named, items });
  }

  return (
    <section className="notes-bar" aria-label="Notas fiscais da conta">
      <div className="notes-strip">
        {shown.map((n, i) => {
          const total = computeSplit(noteBill(bill, n.id || null));
          const on = n.id === current.id;
          return (
            <button
              key={n.id || 'unica'}
              type="button"
              className="note-chip"
              aria-pressed={on}
              onClick={() => !on && dispatch({ type: 'selectNote', id: n.id })}
            >
              <span className="note-emoji" aria-hidden="true">{categoryEmoji(n.category)}</span>
              <span className="note-chip-text">
                <b>{noteLabel(n, i)}</b>
                <small className="num">{formatBRL(total.total + total.unassigned)}</small>
              </span>
            </button>
          );
        })}
        <button type="button" className="note-chip note-add" onClick={() => setMode({ kind: 'create' })}>
          <IconPlus size={18} /> {notes.length > 1 ? 'Nota' : 'Outra nota'}
        </button>
      </div>

      <div className="notes-meta">
        <span className="notes-meta-text">{meta.join(' · ')}</span>
        {photoUrl && (
          <button type="button" className="note-thumb" onClick={() => photoRef.current?.showModal?.()} aria-label={`Ver a foto: ${named}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto local da nota */}
            <img src={photoUrl} alt="" />
          </button>
        )}
        <button type="button" className="link-btn notes-edit" onClick={edit} aria-label={`Editar ${named}`}>
          <IconPencil size={16} /> Editar
        </button>
      </div>

      <NoteSheet
        mode={mode}
        people={bill.people}
        notesCount={notes.length}
        dispatch={dispatch}
        toast={toast}
        onClose={() => setMode(null)}
      />

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
          <button type="button" className="btn ghost" onClick={() => photoRef.current?.close()}>Fechar</button>
        </div>
      </dialog>
    </section>
  );
}
