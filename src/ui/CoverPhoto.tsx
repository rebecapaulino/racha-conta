import { useRef, useState } from 'react';
import { newId } from '../state/billState';
import { deletePhoto, putPhoto, shrinkPhoto } from '../state/photos';
import { IconCamera, IconImage, IconTrash } from './icons';
import { forgetPhotoUrl, rememberPhotoUrl } from './usePhotoUrl';

interface Props {
  noun: 'rolê' | 'viagem';
  photoId: string | null;
  /** Endereço da foto já carregada (para saber se tem foto e mostrar "Remover"). */
  photoUrl: string | null;
  onPhoto: (photoId: string | null) => void;
  toast: (msg: string) => void;
  onBusy?: (busy: boolean) => void;
}

/** Botão da câmera no cartão do topo (Rolê e Viagem): tira, escolhe ou remove a foto do fundo. */
export function CoverPhoto({ noun, photoId, photoUrl, onPhoto, toast, onBusy }: Props) {
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const of = noun === 'rolê' ? 'do rolê' : 'da viagem';

  function working(v: boolean) {
    setBusy(v);
    onBusy?.(v);
  }

  function pick(input: HTMLInputElement | null) {
    sheetRef.current?.close();
    input?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher a mesma foto de novo
    if (!file) return;
    working(true);
    try {
      const blob = await shrinkPhoto(file);
      const id = newId();
      if (!(await putPhoto(id, blob))) {
        toast('Não deu para guardar a foto neste aparelho.');
        return;
      }
      rememberPhotoUrl(id, blob);
      if (photoId) {
        forgetPhotoUrl(photoId);
        deletePhoto(photoId);
      }
      onPhoto(id);
      toast('Foto adicionada');
    } catch {
      toast('Não deu para abrir essa foto. Tente outra.');
    } finally {
      working(false);
    }
  }

  function remove() {
    sheetRef.current?.close();
    if (!photoId) return;
    forgetPhotoUrl(photoId);
    deletePhoto(photoId);
    onPhoto(null);
    toast('Foto removida');
  }

  return (
    <>
      <button
        type="button"
        className="hero-photo-btn"
        onClick={() => sheetRef.current?.showModal?.()}
        aria-label={`${photoUrl ? 'Trocar' : 'Adicionar'} foto ${of}`}
        title={photoUrl ? 'Trocar foto' : 'Adicionar foto'}
        disabled={busy}
      >
        <IconCamera size={20} />
      </button>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />

      <dialog
        ref={sheetRef}
        className="sheet"
        aria-labelledby={`h-photo-${noun === 'rolê' ? 'role' : 'viagem'}`}
        onClick={(e) => e.target === e.currentTarget && sheetRef.current?.close()}
      >
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id={`h-photo-${noun === 'rolê' ? 'role' : 'viagem'}`}>Foto {of}</h2>
          <p>{noun === 'rolê' ? 'Fica no fundo do cartão e no histórico, para lembrar quem estava.' : 'Fica no fundo do cartão da viagem, para todo mundo do grupo ver.'}</p>
          <div className="sheet-list">
            <button type="button" className="btn secondary" onClick={() => pick(cameraRef.current)}>
              <IconCamera /> Tirar foto agora
            </button>
            <button type="button" className="btn secondary" onClick={() => pick(galleryRef.current)}>
              <IconImage /> Escolher da galeria
            </button>
            {photoUrl && (
              <button type="button" className="btn secondary danger" onClick={remove}>
                <IconTrash /> Remover foto
              </button>
            )}
            <button type="button" className="btn ghost" onClick={() => sheetRef.current?.close()}>
              Cancelar
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
