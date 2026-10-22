import { useEffect, useRef, useState } from 'react';
import { formatBRL } from '../../core/money';
import { expectedItemsTotal, sumItems } from '../../receipt/parse';
import { defaultReader } from '../../receipt/reader';
import { newId } from '../../state/billState';
import { putPhoto, shrinkPhoto } from '../../state/photos';
import { downloadUrl, fileName } from '../download';
import { IconCamera, IconDownload, IconImage, IconReceipt, IconX } from '../icons';
import { rememberPhotoUrl } from '../usePhotoUrl';
import { Sheet } from './Sheet';
import { useReceiptUrl } from './useReceiptUrl';

interface Props {
  /** Fotos da despesa (ids), na ordem. */
  photos: string[];
  /** Grupo da viagem compartilhada (para baixar a foto que outra pessoa tirou). */
  groupId: string | null;
  /** Mais uma foto (já guardada no aparelho). Nunca troca as que já estão. */
  onAdd: (id: string) => void;
  /** A pessoa tirou esta foto (no X dela). */
  onRemove: (id: string) => void;
  /** Total lido na foto (null: não deu para ler). */
  onTotal: (cents: number | null) => void;
  toast: (msg: string) => void;
  /** Foto que acabou de chegar pelo "Ler nota fiscal": lê o total assim que abre. */
  autoRead?: Blob | null;
}

/** Uma foto da lista: miniatura (abre grande) com o X para tirar. */
function PhotoThumb({ id, groupId, index, onOpen, onRemove }: { id: string; groupId: string | null; index: number; onOpen: (url: string | null) => void; onRemove: () => void }) {
  const url = useReceiptUrl(id, groupId);
  return (
    <span className="photo-thumb-wrap">
      <button type="button" className="receipt-thumb" onClick={() => onOpen(url)} aria-label={`Ver a foto ${index + 1}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- foto da despesa no aparelho */}
        {url ? <img src={url} alt="" /> : <IconReceipt size={22} />}
      </button>
      <button type="button" className="photo-x" onClick={onRemove} aria-label={`Tirar a foto ${index + 1}`}>
        <IconX size={14} />
      </button>
    </span>
  );
}

/**
 * Fotos da despesa: nota fiscal, print da compra (ex.: o carrinho da Amazon), comprovante,
 * extrato. Anexar soma às que já estão; cada uma sai só no X dela. O app tenta ler o total da
 * foto nova (o valor só é preenchido se ainda estiver vazio). Na viagem compartilhada, o grupo todo vê.
 */
export function ReceiptField({ photos, groupId, onAdd, onRemove, onTotal, toast, autoRead = null }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ url: string | null } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let blob: Blob;
    try {
      blob = await shrinkPhoto(file);
    } catch {
      toast('Não deu para abrir essa foto. Tente outra.');
      return;
    }
    const id = newId();
    if (!(await putPhoto(id, blob))) {
      toast('Não deu para guardar a foto neste aparelho.');
      return;
    }
    rememberPhotoUrl(id, blob);
    onAdd(id);
    void read(blob);
  }

  /** Lê o total da nota (no próprio celular). */
  async function read(blob: Blob) {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setReading('Lendo a nota…');
    try {
      const reader = await defaultReader();
      const r = await reader.read(blob, (p) => setReading(`${p.label} ${Math.round(p.fraction * 100)}%`), ctrl.signal);
      const total = r.totalCents ?? (r.items.length ? (expectedItemsTotal(r) ?? sumItems(r.items)) + (r.serviceCents ?? 0) : null);
      onTotal(total && total > 0 ? total : null);
    } catch {
      if (!ctrl.signal.aborted) onTotal(null);
    } finally {
      if (!ctrl.signal.aborted) setReading(null);
    }
  }

  const started = useRef(false);
  useEffect(() => {
    if (!autoRead || started.current) return;
    started.current = true;
    void read(autoRead);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lê uma vez, ao abrir
  }, [autoRead]);

  return (
    <div className="receipt-field">
      <div className="receipt-add">
        <span className="scan-cta-icon" aria-hidden="true"><IconReceipt size={22} /></span>
        <span className="row-main">
          <b>{photos.length ? `Fotos (${photos.length})` : 'Fotos'}</b>
          <small aria-live="polite">{reading ?? 'Nota fiscal, print da compra, comprovante ou extrato.'}</small>
        </span>
        <span className="receipt-add-btns">
          <button type="button" className="icon-btn" onClick={() => cameraRef.current?.click()} aria-label="Tirar foto">
            <IconCamera size={20} />
          </button>
          <button type="button" className="icon-btn" onClick={() => galleryRef.current?.click()} aria-label="Escolher foto ou print da galeria">
            <IconImage size={20} />
          </button>
        </span>
      </div>
      {photos.length > 0 && (
        <div className="photo-strip">
          {photos.map((id, i) => (
            <PhotoThumb
              key={id}
              id={id}
              index={i}
              groupId={groupId}
              onOpen={(url) => setViewing({ url })}
              onRemove={() => {
                abort.current?.abort();
                setReading(null);
                onRemove(id);
              }}
            />
          ))}
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />

      <Sheet open={!!viewing} onClose={() => setViewing(null)} labelledBy="h-receipt-view">
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-receipt-view" tabIndex={-1}>Foto da despesa</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- foto da despesa no aparelho */}
          {viewing?.url ? <img className="note-photo-big" src={viewing.url} alt="Foto da despesa" /> : <p className="hint">Baixando a foto…</p>}
          {viewing?.url && (
            <button type="button" className="btn secondary" onClick={() => downloadUrl(viewing.url!, fileName('foto'))}>
              <IconDownload /> Baixar foto
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => setViewing(null)}>Fechar</button>
        </div>
      </Sheet>
    </div>
  );
}

/** "Total lido: R$ 120,00" para mostrar depois da leitura. */
export const totalText = (cents: number) => `Total lido na foto: ${formatBRL(cents)}`;
