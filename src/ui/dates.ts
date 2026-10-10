/** "sex · 09 out", sem os pontos de abreviação. */
export function shortDate(ms: number): string {
  const d = new Date(ms);
  return [
    d.toLocaleDateString('pt-BR', { weekday: 'short' }),
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(' de ', ' '),
  ]
    .map((s) => s.replace(/\./g, ''))
    .join(' · ');
}

/** "09 out 2026" para os cartões do histórico. */
export function longDate(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
    .replace(/ de /g, ' ');
}
