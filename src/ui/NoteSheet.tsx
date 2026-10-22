import { useEffect, useRef, useState, type Dispatch } from 'react';
import { MAX_CATEGORY, NOTE_CATEGORIES, notePhotos, type Note, type Person } from '../core/bill';
import { newId, type Action } from '../state/billState';
import { deletePhoto, putPhoto, shrinkPhoto } from '../state/photos';
import { Avatar, personStyle } from './Avatar';
import { IconCamera, IconCheck, IconImage, IconReceipt, IconTrash, IconX } from './icons';
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

/** Foto nova escolhida nesta janela (só vai para o aparelho ao salvar). */
type NewPhoto = { key: number; blob: Blob; url: string };
let photoSeq = 0;

/** Foto que a nota já tem: miniatura com o X para tirar. */
function SavedThumb({ id, groupId, index, onRemove }: { id: string; groupId: string | null; index: number; onRemove: () => void }) {
  const url = useReceiptUrl(id, groupId);
  return (
    <span className="photo-thumb-wrap">
      <span className="receipt-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto local da nota */}
        {url ? <img src={url} alt={`Foto ${index + 1} da nota`} /> : <IconReceipt size={22} />}
      </span>
      <button type="button" className="photo-x" onClick={onRemove} aria-label={`Tirar a foto ${index + 1}`}>
        <IconX size={14} />
      </button>
    </span>
  );
}

/** Nova nota / editar nota: categoria, quem pagou, quem divide e a foto da nota. */
export function NoteSheet({ mode, people, notesCount, groupId = null, dispatch, toast, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const editing = mode?.kind === 'edit' ? mode.note : null;

  const [category, setCategory] = useState('');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [who, setWho] = useState<string[]>([]);
  // Fotos: as que a nota já tem (e continuam) e as novas. Anexar soma; cada uma sai no X dela.
  const [kept, setKept] = useState<string[]>([]);
  const [added, setAdded] = useState<NewPhoto[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // Ao abrir, começa com o que a nota já tem (ou, na nova, com todo mundo dividindo).
  // Abrir/fechar a janela segue o modo; os campos começam do zero a cada abertura.
  const [openedFor, setOpenedFor] = useState<NoteSheetMode | null>(null);
  if (mode !== openedFor) {
    setOpenedFor(mode);
    if (mode) {
      setCategory(editing?.category ?? '');
      setPayerId(editing ? editing.payerId : null);
      setWho(editing ? editing.people : people.map((p) => p.id));
      setKept(editing ? notePhotos(editing) : []);
      setAdded([]);
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

  // Libera as prévias das fotos novas quando a janela fecha.
  const addedRef = useRef(added);
  useEffect(() => {
    addedRef.current = added;
  });
  useEffect(() => () => addedRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function pick(input: HTMLInputElement | null) {
    input?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAdded((l) => [...l, { key: ++photoSeq, blob: file, url: URL.createObjectURL(file) }]);
  }

  const toggle = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const allOn = people.length > 0 && people.every((p) => who.includes(p.id));

  async function save() {
    if (busy || !mode) return;
    setBusy(true);
    try {
      // Fotos novas: só vão para o aparelho na hora de salvar (cancelar não deixa sobra).
      const fresh: string[] = [];
      for (const p of added) {
        try {
          const blob = await shrinkPhoto(p.blob);
          const id = newId();
          if (await putPhoto(id, blob)) {
            rememberPhotoUrl(id, blob);
            fresh.push(id);
          } else {
            toast('Não deu para guardar a foto neste aparelho.');
          }
        } catch {
          toast('Não deu para abrir essa foto. Tente outra.');
        }
      }
      const photos = [...kept, ...fresh];
      const before = editing ? notePhotos(editing) : [];
      // Só apaga do aparelho as fotos que a pessoa tirou no X.
      for (const id of before.filter((x) => !photos.includes(x))) {
        forgetPhotoUrl(id);
        deletePhoto(id);
      }
      const changed = photos.join() !== before.join();

      if (mode.kind === 'create') {
        dispatch({ type: 'addNote', category, payerId, people: who, photoId: photos[0] ?? null, photos });
        toast(`Nota ${category.trim() || 'nova'} criada. Lance os itens dela.`);
      } else {
        dispatch({ type: 'editNote', id: mode.note.id, category, payerId, people: who, ...(changed ? { photos } : {}) });
        toast('Nota salva');
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!editing) return;
    for (const id of notePhotos(editing)) {
      forgetPhotoUrl(id);
      deletePhoto(id);
    }
    dispatch({ type: 'removeNote', id: editing.id });
    toast('Nota apagada');
    onClose();
  }

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
          <h3 className="field-label">Fotos da nota</h3>
          {kept.length + added.length > 0 && (
            <div className="photo-strip">
              {kept.map((id, i) => (
                <SavedThumb key={id} id={id} index={i} groupId={groupId} onRemove={() => setKept((l) => l.filter((x) => x !== id))} />
              ))}
              {added.map((p, i) => (
                <span key={p.key} className="photo-thumb-wrap">
                  <span className="receipt-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- prévia da foto nova */}
                    <img src={p.url} alt={`Foto nova ${i + 1}`} />
                  </span>
                  <button
                    type="button"
                    className="photo-x"
                    aria-label={`Tirar a foto nova ${i + 1}`}
                    onClick={() => {
                      URL.revokeObjectURL(p.url);
                      setAdded((l) => l.filter((x) => x.key !== p.key));
                    }}
                  >
                    <IconX size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => pick(cameraRef.current)}>
              <IconCamera /> Tirar foto
            </button>
            <button type="button" className="btn secondary" onClick={() => pick(galleryRef.current)}>
              <IconImage /> Da galeria
            </button>
          </div>
          <p className="hint">Nota fiscal, print da compra, comprovante. Anexar não apaga as outras; o X tira só aquela.</p>
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
