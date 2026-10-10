'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

const noop = () => () => {};

/**
 * Mostra o conteúdo só no aparelho, nunca no servidor.
 * O modo solo depende do que está salvo no celular e da data local,
 * que o servidor não conhece.
 */
export function ClientOnly({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  return isClient ? children : null;
}
