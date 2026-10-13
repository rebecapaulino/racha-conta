import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** id do título da janela (o h2 de dentro). */
  labelledBy: string;
  className?: string;
  /** Seletor do campo que recebe o foco ao abrir (padrão: o título). */
  focus?: string;
  children: ReactNode;
}

/**
 * Janela que sobe de baixo (no computador, no meio). O conteúdo só existe enquanto ela está
 * aberta: cada abertura começa do zero, sem sobra da anterior. Esc ou tocar fora fecha.
 */
export function Sheet({ open, onClose, labelledBy, className = '', focus = 'h2', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal?.();
      (d.querySelector<HTMLElement>(focus) ?? d.querySelector<HTMLElement>('h2'))?.focus();
    }
    if (!open && d.open) d.close();
  }, [open, focus]);

  return (
    <dialog
      ref={ref}
      className={`sheet ${className}`.trim()}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && children}
    </dialog>
  );
}
