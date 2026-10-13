import type { TripCategory } from '../../core/trip';

// Ícones das categorias da viagem: traço simples, na cor do texto (neutros, como pede o briefing).
const PATHS: Record<TripCategory, React.ReactNode> = {
  hospedagem: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" />,
  alimentacao: <path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17.5 21V3c-2.2 1.2-3.5 4-3.5 7.5V14h3.5" />,
  mercado: (
    <>
      <path d="M3 4h2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.1h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </>
  ),
  transporte: (
    <>
      <rect x="5" y="3.5" width="14" height="14" rx="3" />
      <path d="M5 11h14M8.5 17.5V20M15.5 17.5V20M8.5 14.5h.01M15.5 14.5h.01" />
    </>
  ),
  combustivel: <path d="M5 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M3.5 20h13M5 10h10M15 7.5l3.5 3V17a1.5 1.5 0 0 0 3 0v-6.5l-3-3" />,
  passeios: <path d="M12 4a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8zM12 12v6.5a2 2 0 0 0 4 0M12 2.5V4" />,
  compras: <path d="M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8" />,
  outros: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </>
  ),
};

export function CategoryIcon({ category, size = 20 }: { category: TripCategory; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[category]}
    </svg>
  );
}
