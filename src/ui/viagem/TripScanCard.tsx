import { useRef, useState } from 'react';
import { shrinkPhoto } from '../../state/photos';
import { IconCamera, IconChevron, IconImage, IconReceipt } from '../icons';
import { Sheet } from './Sheet';

/**
 * "Ler nota fiscal" na caderneta (como no Rolê): tira ou escolhe a foto, e abre a despesa nova
 * com a nota guardada e o total lido.
 */
export function TripScanCard({ onPhoto, toast }: { onPhoto: (blob: Blob) => void; toast: (msg: string) => void }) {
  const [choosing, setChoosing] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setChoosing(false);
    if (!file) return;
    try {
      onPhoto(await shrinkPhoto(file));
    } catch {
      toast('Não deu para abrir essa foto. Tente outra.');
    }
  }

  return (
    <>
      <button type="button" className="card scan-cta" onClick={() => setChoosing(true)}>
        <span className="scan-cta-icon" aria-hidden="true"><IconReceipt size={24} /></span>
        <span className="row-main">
          <b>Ler nota fiscal</b>
          <small>Tire uma foto e o app lança a despesa com o total.</small>
        </span>
        <span className="scan-cta-go" aria-hidden="true"><IconChevron size={20} /></span>
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />
      <Sheet open={choosing} onClose={() => setChoosing(false)} labelledBy="h-trip-scan">
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-trip-scan" tabIndex={-1}>Ler nota fiscal</h2>
          <p>A nota fica guardada na despesa{' '}e o app lê o total. Depois é só conferir e escolher quem pagou.</p>
          <button type="button" className="btn primary big" onClick={() => cameraRef.current?.click()}>
            <IconCamera /> Tirar foto
          </button>
          <button type="button" className="btn secondary" onClick={() => galleryRef.current?.click()}>
            <IconImage /> Escolher da galeria
          </button>
          <button type="button" className="btn ghost" onClick={() => setChoosing(false)}>Cancelar</button>
        </div>
      </Sheet>
    </>
  );
}
