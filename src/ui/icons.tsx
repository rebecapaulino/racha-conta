// Ícones em linha, herdando a cor do texto (currentColor).

type P = { size?: number };

const stroke = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
});

/** Logo: moeda partida. Metade cheia, metade só contorno. */
export function Logo({ size = 32 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="logo">
      <path d="M16 3a13 13 0 0 0 0 26z" fill="currentColor" />
      <path d="M18 3a13 13 0 0 1 0 26z" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export const IconPlus = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconX = ({ size = 16 }: P) => (
  <svg {...stroke(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconCheck = ({ size = 14 }: P) => (
  <svg {...stroke(size)} strokeWidth={3}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
/** Três pontinhos (mais opções). */
export const IconDots = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
);
export const IconTrash = ({ size = 18 }: P) => (
  <svg {...stroke(size)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
export const IconCopy = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>
);
export const IconChat = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5z" /></svg>
);
export const IconArrowRight = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconSparkle = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
);
export const IconAlert = ({ size = 18 }: P) => (
  <svg {...stroke(size)}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>
);
export const IconRefresh = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" /></svg>
);
export const IconUser = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
export const IconUsers = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6" /></svg>
);
export const IconReceipt = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
);
export const IconPie = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></svg>
);
export const IconCamera = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const IconImage = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
);
export const IconHistory = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
);
export const IconArrowLeft = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const IconMinus = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M5 12h14" /></svg>
);
export const IconShare = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
);
export const IconSquarePlus = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg>
);
export const IconWifiOff = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M3 3l18 18" /><path d="M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.5M14.8 10.4A10 10 0 0 1 19 12.9M1.5 9.3a15 15 0 0 1 4.3-2.8M10.3 4.6A15 15 0 0 1 22.5 9.3" /><path d="M12 20h.01" /></svg>
);
export const IconChevron = ({ size = 20 }: P) => (
  <svg {...stroke(size)} className="chevron"><path d="M6 9l6 6 6-6" /></svg>
);
export const IconPencil = ({ size = 18 }: P) => (
  <svg {...stroke(size)}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
);
export const IconSuitcase = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><rect x="3.5" y="7" width="17" height="13" rx="2.5" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M8 11v5M16 11v5" /></svg>
);
export const IconBook = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><rect x="5" y="3" width="15" height="18" rx="2" /><path d="M3 7h3M3 12h3M3 17h3M10 8h6M10 12h6" /></svg>
);
export const IconScale = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M12 4v16M8 20h8M5 7h14M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" /></svg>
);
export const IconFilter = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
);
export const IconBulb = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" /></svg>
);
export const IconSun = ({ size = 20 }: P) => (
  <svg {...stroke(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const IconMoon = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" /></svg>
);
export const IconDownload = ({ size = 20 }: P) => (
  <svg {...stroke(size)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
);
