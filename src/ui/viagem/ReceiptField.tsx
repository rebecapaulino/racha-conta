import { useEffect, useRef, useState } from 'react';
import { formatBRL } from '../../core/money';
import { expectedItemsTotal, sumItems } from '../../receipt/parse';
import { defaultReader } from '../../receipt/reader';
import { newId } from '../../state/billState';
import { putPhoto, shrinkPhoto } from '../../state/photos';
import { IconCamera, IconImage, IconReceipt, IconX } from '../icons';
import { rememberPhotoUrl } from '../usePhotoUrl';
import { Sheet } from './Sheet';
import { useReceiptUrl } from './useReceiptUrl';

interface Props {
  /** Foto da nota na despesa (id), ou null. */
  receipt: string | null;
  /** Grupo da viagem compartilhada (para baixar a foto que outra pessoa tirou). */
  groupId: string | null;
  onChange: (id: string | null) => void;
  /** Total lido na nota (null: não deu para ler). */
  onTotal: (cents: number | null) => void;
  toast: (msg: string) => void;
}

/**
 * Foto da nota fiscal na despesa: tira (ou escolhe) a foto, o app lê o total e a nota fica
 * guardada na despesa. Na viagem compartilhada, o grupo todo vê.
 */
export function ReceiptField({ receipt, groupId, onChange, onTotal, toast }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const url = useReceiptUrl(receipt, groupId);
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
    onChange(id);
    // Lê o total da nota (no próprio celular).
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

  return (
    <div className="receipt-field">
      {receipt ? (
        <div className="receipt-chip">
          <button type="button" className="receipt-thumb" onClick={() => setViewing(true)} aria-label="Ver a foto da nota fiscal">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto da nota no aparelho */}
            {url ? <img src={url} alt="" /> : <IconReceipt size={22} />}
          </button>
          <span className="row-main">
            <b>Nota fiscal</b>
            <small aria-live="polite">{reading ?? 'Guardada nesta despesa.'}</small>
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Tirar a foto da nota"
            onClick={() => {
              abort.current?.abort();
              setReading(null);
              onChange(null);
            }}
          >
            <IconX size={18} />
          </button>
        </div>
      ) : (
        <div className="receipt-add">
          <span className="scan-cta-icon" aria-hidden="true"><IconReceipt size={22} /></span>
          <span className="row-main">
            <b>Nota fiscal</b>
            <small>O app lê o total e guarda a nota na despesa.</small>
          </span>
          <span className="receipt-add-btns">
            <button type="button" className="icon-btn" onClick={() => cameraRef.current?.click()} aria-label="Tirar foto da nota">
              <IconCamera size={20} />
            </button>
            <button type="button" className="icon-btn" onClick={() => galleryRef.current?.click()} aria-label="Escolher foto da nota">
              <IconImage size={20} />
            </button>
          </span>
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />

      <Sheet open={viewing} onClose={() => setViewing(false)} labelledBy="h-receipt-view">
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-receipt-view" tabIndex={-1}>Nota fiscal</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- foto da nota no aparelho */}
          {url ? <img className="note-photo-big" src={url} alt="Foto da nota fiscal" /> : <p className="hint">Baixando a foto…</p>}
          <button type="button" className="btn ghost" onClick={() => setViewing(false)}>Fechar</button>
        </div>
      </Sheet>
    </div>
  );
}

/** "Total lido: R$ 120,00" para mostrar depois da leitura. */
export const totalText = (cents: number) => `Total lido na nota: ${formatBRL(cents)}`;
