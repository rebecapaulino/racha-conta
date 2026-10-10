import { useEffect, useState } from 'react';
import { getPhoto } from '../state/photos';

// Endereço temporário da foto para usar como fundo. Fica em memória enquanto a
// página estiver aberta, para o histórico não reler a mesma foto toda hora.
const cache = new Map<string, string>();

export function rememberPhotoUrl(id: string, blob: Blob): void {
  forgetPhotoUrl(id);
  cache.set(id, URL.createObjectURL(blob));
}

export function forgetPhotoUrl(id: string): void {
  const url = cache.get(id);
  if (url) URL.revokeObjectURL(url);
  cache.delete(id);
}

export function usePhotoUrl(id: string | null): string | null {
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!id || cache.has(id)) return;
    let alive = true;
    getPhoto(id).then((blob) => {
      if (!alive || !blob) return;
      if (!cache.has(id)) cache.set(id, URL.createObjectURL(blob));
      setLoaded({ id, url: cache.get(id)! });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (!id) return null;
  return cache.get(id) ?? (loaded?.id === id ? loaded.url : null);
}
