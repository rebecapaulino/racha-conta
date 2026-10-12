// Emoji de cada categoria pronta de nota; categoria digitada usa o da nota fiscal.
const EMOJI: Record<string, string> = {
  comida: '🍽️',
  bebidas: '🍺',
  doces: '🍬',
  mercado: '🛒',
  transporte: '🚗',
  outros: '🧾',
};

export function categoryEmoji(category: string): string {
  return EMOJI[category.trim().toLowerCase()] ?? '🧾';
}
