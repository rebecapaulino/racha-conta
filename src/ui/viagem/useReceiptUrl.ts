import { useEffect, useState } from 'react';
import { putPhoto } from '../../state/photos';
import { downloadReceipt, markSent } from '../../sync/receipts';
import { rememberPhotoUrl, usePhotoUrl } from '../usePhotoUrl';

/** Espera antes de cada tentativa de baixar (a foto pode ainda estar subindo do outro aparelho). */
const TRIES_MS = [400, 5000, 15000, 30000, 60000, 120000];

/**
 * Endereço da foto (nota ou cartão): a do aparelho; se não tiver aqui (foi outra pessoa do grupo
 * que tirou), baixa do grupo e guarda no aparelho. Se ainda não chegou lá, tenta de novo.
 */
export function useReceiptUrl(id: string | null, groupId: string | null): string | null {
  const local = usePhotoUrl(id);
  const [fetched, setFetched] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!id || !groupId || local) return;
    let alive = true;
    let timer = 0;
    const attempt = (n: number) => {
      // Dá um tempo para a foto local carregar (e, depois, para a do grupo terminar de subir).
      timer = window.setTimeout(() => {
        downloadReceipt(groupId, id)
          .catch(() => null)
          .then(async (blob) => {
            if (!alive) return;
            if (!blob) {
              if (n + 1 < TRIES_MS.length) attempt(n + 1);
              return;
            }
            await putPhoto(id, blob);
            markSent(groupId, id);
            rememberPhotoUrl(id, blob);
            if (alive) setFetched({ id, url: URL.createObjectURL(blob) });
          });
      }, TRIES_MS[n]);
    };
    attempt(0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [id, groupId, local]);

  if (!id) return null;
  return local ?? (fetched?.id === id ? fetched.url : null);
}
