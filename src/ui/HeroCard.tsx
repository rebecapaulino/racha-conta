import { useRef, useState, type CSSProperties } from 'react';
import type { Person } from '../core/bill';
import { formatBRL } from '../core/money';
import { newId } from '../state/billState';
import { deletePhoto, putPhoto, shrinkPhoto } from '../state/photos';
import { AvatarStack } from './Avatar';
import { shortDate } from './dates';
import { IconCamera, IconImage, IconTrash } from './icons';
import { Art } from './illustrations';
import { forgetPhotoUrl, rememberPhotoUrl, usePhotoUrl } from './usePhotoUrl';

interface Props {
  title: string;
  startedAt: number;
  total: number;
  servicePct: number;
  people: Person[];
  photoId: string | null;
  fluent: boolean;
  onPhoto: (photoId: string | null) => void;
  toast: (msg: string) => void;
}

/** Cartão do total. Com foto do rolê, a foto vira o fundo (fica como lembrança no histórico). */
export function HeroCard({ title, startedAt, total, servicePct, people, photoId, fluent, onPhoto, toast }: Props) {
  const photoUrl = usePhotoUrl(photoId);
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function pick(input: HTMLInputElement | null) {
    sheetRef.current?.close();
    input?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher a mesma foto de novo
    if (!file) return;
    setBusy(true);
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
      setBusy(false);
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

  const style = photoUrl ? ({ '--photo': `url("${photoUrl}")` } as CSSProperties) : undefined;

  return (
    <section className={`hero${photoUrl ? ' has-photo' : ''}`} style={style} aria-label="Resumo da conta" aria-busy={busy}>
      <div className="hero-top">
        <span className="hero-title">{title.trim() || 'Conta da mesa'}</span>
        <span className="hero-date">{shortDate(startedAt)}</span>
        <button
          type="button"
          className="hero-photo-btn"
          onClick={() => sheetRef.current?.showModal?.()}
          aria-label={photoUrl ? 'Trocar foto do rolê' : 'Adicionar foto do rolê'}
          title={photoUrl ? 'Trocar foto' : 'Adicionar foto'}
          disabled={busy}
        >
          <IconCamera size={20} />
        </button>
      </div>
      {fluent && !photoUrl && <Art kind="money" size={64} className="hero-art" />}
      <span className="hero-label">Total com serviço</span>
      <b className="hero-total">{formatBRL(total)}</b>
      <div className="hero-bottom">
        <span>
          {servicePct ? `${servicePct}% de serviço` : 'sem serviço'}
          {people.length > 0 && ` · ${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'}`}
        </span>
        {people.length > 0 && <AvatarStack people={people} />}
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />

      <dialog
        ref={sheetRef}
        className="sheet"
        aria-labelledby="h-photo"
        onClick={(e) => e.target === e.currentTarget && sheetRef.current?.close()}
      >
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-photo">Foto do rolê</h2>
          <p>Fica no fundo do cartão e no histórico, para lembrar quem estava.</p>
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
    </section>
  );
}
