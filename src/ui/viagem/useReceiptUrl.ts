import { useEffect, useState } from 'react';
import { putPhoto } from '../../state/photos';
import { downloadReceipt, markSent } from '../../sync/receipts';
import { rememberPhotoUrl, usePhotoUrl } from '../usePhotoUrl';

/**
 * Endereço da foto da nota: a do aparelho; se não tiver aqui (foi outra pessoa do grupo que
 * tirou), baixa do grupo uma vez e guarda no aparelho.
 */
export function useReceiptUrl(id: string | null, groupId: string | null): string | null {
  const local = usePhotoUrl(id);
  const [fetched, setFetched] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!id || !groupId || local) return;
    let alive = true;
    // Dá um tempo para a foto local carregar antes de ir à internet.
    const t = window.setTimeout(() => {
      downloadReceipt(groupId, id).then(async (blob) => {
        if (!alive) return;
        if (!blob) return;
        await putPhoto(id, blob);
        markSent(groupId, id);
        rememberPhotoUrl(id, blob);
        if (alive) setFetched({ id, url: URL.createObjectURL(blob) });
      });
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [id, groupId, local]);

  if (!id) return null;
  return local ?? (fetched?.id === id ? fetched.url : null);
}
