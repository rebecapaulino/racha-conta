import { useEffect, useRef, useState, type Dispatch } from 'react';
import { MAX_CATEGORY, NOTE_CATEGORIES, type Note, type Person } from '../core/bill';
import { newId, type Action } from '../state/billState';
import { deletePhoto, putPhoto, shrinkPhoto } from '../state/photos';
import { Avatar, personStyle } from './Avatar';
import { IconCamera, IconCheck, IconImage, IconTrash } from './icons';
import { categoryEmoji } from '../core/noteCategory';
import { forgetPhotoUrl, rememberPhotoUrl } from './usePhotoUrl';
import { useReceiptUrl } from './viagem/useReceiptUrl';

/** O que a janela está fazendo: criando uma nota ou editando uma (a da conta de nota só também). */
export type NoteSheetMode = { kind: 'create' } | { kind: 'edit'; note: Note; label: string; items: number; intro?: string };

interface Props {
  mode: NoteSheetMode | null;
  /** Grupo do rolê compartilhado: a foto que outra pessoa tirou vem de lá. */
  groupId?: string | null;
  people: Person[];
  /** Quantas notas a conta tem (a última não pode ser apagada). */
  notesCount: number;
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
  onClose: () => void;
}

type Photo = { kind: 'keep' } | { kind: 'none' } | { kind: 'new'; blob: Blob; url: string };

/** Nova nota / editar nota: categoria, quem pagou, quem divide e a foto da nota. */
export function NoteSheet({ mode, people, notesCount, groupId = null, dispatch, toast, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const editing = mode?.kind === 'edit' ? mode.note : null;

  const [category, setCategory] = useState('');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [who, setWho] = useState<string[]>([]);
  const [photo, setPhoto] = useState<Photo>({ kind: 'keep' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const savedUrl = useReceiptUrl(editing?.photoId ?? null, groupId);

  // Ao abrir, começa com o que a nota já tem (ou, na nova, com todo mundo dividindo).
  // Abrir/fechar a janela segue o modo; os campos começam do zero a cada abertura.
  const [openedFor, setOpenedFor] = useState<NoteSheetMode | null>(null);
  if (mode !== openedFor) {
    setOpenedFor(mode);
    if (mode) {
      setCategory(editing?.category ?? '');
      setPayerId(editing ? editing.payerId : null);
      setWho(editing ? editing.people : people.map((p) => p.id));
      setPhoto({ kind: 'keep' });
      setConfirmDelete(false);
    }
  }

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (mode && !d.open) {
      d.showModal?.();
      d.querySelector<HTMLElement>('h2')?.focus();
    }
    if (!mode && d.open) d.close();
  }, [mode]);

  // Libera a prévia da foto nova quando ela sai de cena.
  useEffect(() => () => void (photo.kind === 'new' && URL.revokeObjectURL(photo.url)), [photo]);

  function pick(input: HTMLInputElement | null) {
    input?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhoto({ kind: 'new', blob: file, url: URL.createObjectURL(file) });
  }

  const toggle = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const allOn = people.length > 0 && people.every((p) => who.includes(p.id));

  async function save() {
    if (busy || !mode) return;
    setBusy(true);
    try {
      // Foto: só vai para o aparelho na hora de salvar (cancelar não deixa sobra).
      let photoId: string | null | undefined;
      if (photo.kind === 'new') {
        try {
          const blob = await shrinkPhoto(photo.blob);
          const id = newId();
          if (await putPhoto(id, blob)) {
            rememberPhotoUrl(id, blob);
            photoId = id;
          } else {
            toast('Não deu para guardar a foto neste aparelho.');
          }
        } catch {
          toast('Não deu para abrir essa foto. Tente outra.');
        }
      } else if (photo.kind === 'none') {
        photoId = null;
      }
      const old = editing?.photoId ?? null;
      if (old && photoId !== undefined && photoId !== old) {
        forgetPhotoUrl(old);
        deletePhoto(old);
      }

      if (mode.kind === 'create') {
        dispatch({ type: 'addNote', category, payerId, people: who, photoId: photoId ?? null });
        toast(`Nota ${category.trim() || 'nova'} criada. Lance os itens dela.`);
      } else {
        dispatch({ type: 'editNote', id: mode.note.id, category, payerId, people: who, ...(photoId !== undefined ? { photoId } : {}) });
        toast('Nota salva');
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!editing) return;
    if (editing.photoId) {
      forgetPhotoUrl(editing.photoId);
      deletePhoto(editing.photoId);
    }
    dispatch({ type: 'removeNote', id: editing.id });
    toast('Nota apagada');
    onClose();
  }

  const shownPhoto = photo.kind === 'new' ? photo.url : photo.kind === 'keep' ? savedUrl : null;
  const typed = category.trim().toLowerCase();

  return (
    <dialog
      ref={ref}
      className="sheet note-sheet"
      aria-labelledby="h-note"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet-body">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-note" tabIndex={-1}>{mode?.kind === 'edit' ? `Editar ${mode.label.charAt(0).toLowerCase()}${mode.label.slice(1)}` : 'Nova nota fiscal'}</h2>
        {mode?.kind === 'create' && <p>Cada nota tem quem pagou e quem divide. No fim, o app soma tudo por pessoa.</p>}
        {mode?.kind === 'edit' && mode.intro && <p>{mode.intro}</p>}

        <fieldset className="note-field">
          <legend className="field-label">Categoria</legend>
          <div className="note-cats">
            {NOTE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className="chip note-cat"
                aria-pressed={typed === c.toLowerCase()}
                onClick={() => setCategory(typed === c.toLowerCase() ? '' : c)}
              >
                <span aria-hidden="true">{categoryEmoji(c)}</span> {c}
              </button>
            ))}
          </div>
          <label className="sr" htmlFor="note-category">Ou digite outra categoria</label>
          <input
            id="note-category"
            className="input"
            maxLength={MAX_CATEGORY}
            placeholder="Ou digite outra (ex.: Presente)"
            autoComplete="off"
            autoCapitalize="sentences"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </fieldset>

        {people.length === 0 ? (
          <p className="hint">Adicione as pessoas na etapa Mesa para escolher quem pagou e quem divide.</p>
        ) : (
          <>
            <div className="note-field">
              <h3 className="field-label" id="h-note-payer">Quem pagou esta nota?</h3>
              <div className="picker" role="radiogroup" aria-labelledby="h-note-payer">
                <button type="button" role="radio" aria-checked={!payerId} className="pick" onClick={() => setPayerId(null)}>
                  <span className="avatar avatar-md avatar-none" aria-hidden="true">
                    —{!payerId && <span className="avatar-check"><IconCheck size={10} /></span>}
                  </span>
                  <span className="pick-name">Ninguém</span>
                </button>
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={p.id === payerId}
                    className="pick"
                    style={personStyle(p)}
                    onClick={() => setPayerId(p.id)}
                  >
                    <Avatar person={p} size="md" checked={p.id === payerId} />
                    <span className="pick-name">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="note-field">
              <h3 className="field-label" id="h-note-who">Quem divide esta nota?</h3>
              <div className="chips" role="group" aria-labelledby="h-note-who">
                {people.map((p) => {
                  const on = who.includes(p.id);
                  return (
                    <button key={p.id} type="button" className="chip" style={personStyle(p)} aria-pressed={on} onClick={() => toggle(p.id)}>
                      <Avatar person={p} size="xs" checked={on} />
                      {p.name}
                    </button>
                  );
                })}
                <button type="button" className="chip chip-all" onClick={() => setWho(allOn ? [] : people.map((p) => p.id))}>
                  {allOn ? 'Limpar' : 'Todos'}
                </button>
              </div>
              {payerId && !who.includes(payerId) && (
                <p className="hint">{people.find((p) => p.id === payerId)?.name} pagou e não divide: recebe tudo dos outros.</p>
              )}
            </div>
          </>
        )}

        <div className="note-field">
          <h3 className="field-label">Foto da nota</h3>
          {shownPhoto ? (
            <div className="note-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto local da nota */}
              <img src={shownPhoto} alt="Foto da nota fiscal" />
              <div className="sheet-actions">
                <button type="button" className="btn secondary" onClick={() => pick(galleryRef.current)}>
                  <IconImage /> Trocar
                </button>
                <button type="button" className="btn secondary danger" onClick={() => setPhoto({ kind: 'none' })}>
                  <IconTrash /> Remover
                </button>
              </div>
            </div>
          ) : (
            <div className="sheet-actions">
              <button type="button" className="btn secondary" onClick={() => pick(cameraRef.current)}>
                <IconCamera /> Tirar foto
              </button>
              <button type="button" className="btn secondary" onClick={() => pick(galleryRef.current)}>
                <IconImage /> Da galeria
              </button>
            </div>
          )}
          <p className="hint">Fica guardada só neste celular.</p>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />
        </div>

        {editing && notesCount > 1 && (
          confirmDelete ? (
            <div className="confirm" role="group" aria-labelledby="h-note-del">
              <p id="h-note-del">
                <b>Apagar esta nota?</b>{' '}
                {mode?.kind !== 'edit' || mode.items === 0
                  ? 'Ela sai da conta.'
                  : mode.items === 1
                    ? 'O item dela também sai.'
                    : `Os ${mode.items} itens dela também saem.`}
              </p>
              <div className="sheet-actions">
                <button type="button" className="btn secondary" onClick={() => setConfirmDelete(false)} autoFocus>Cancelar</button>
                <button type="button" className="btn primary danger" onClick={remove}>Apagar</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn ghost note-delete" onClick={() => setConfirmDelete(true)}>
              <IconTrash /> Apagar nota
            </button>
          )
        )}

        <div className="sheet-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" onClick={save} disabled={busy}>
            {mode?.kind === 'create' ? 'Criar nota' : 'Salvar'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
