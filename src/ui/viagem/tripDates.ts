// Datas da viagem ("AAAA-MM-DD") escritas do jeito que a gente fala.

const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
const local = (iso: string) => {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d);
};
const clean = (s: string) => s.replace(/\./g, '').replace(/ de /g, ' ');

/** "ter, 30 dez" */
export function dayLabel(iso: string): string {
  const d = local(iso);
  return `${clean(d.toLocaleDateString('pt-BR', { weekday: 'short' }))}, ${clean(d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }))}`;
}

/** "30 dez" */
export function shortDay(iso: string): string {
  return clean(local(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }));
}

/** Dias corridos entre duas datas (b − a). */
export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = parts(a);
  const [yb, mb, db] = parts(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/** "Dia 3" da viagem, contando a partir da ida (ou do primeiro gasto). Antes disso, nada. */
export function dayNumber(iso: string, first: string | undefined): number | null {
  if (!first) return null;
  const n = daysBetween(first, iso);
  return n >= 0 ? n + 1 : null;
}

/** "28 dez – 3 jan", "desde 28 dez", "até 3 jan" ou "" sem datas. */
export function tripDates(start?: string, end?: string): string {
  if (start && end) return `${shortDay(start)} – ${shortDay(end)}`;
  if (start) return `desde ${shortDay(start)}`;
  if (end) return `até ${shortDay(end)}`;
  return '';
}

/** Um dia antes ("ontem" de uma data). */
export function dayBefore(iso: string): string {
  const d = local(iso);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
