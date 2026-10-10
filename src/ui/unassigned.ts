import { itemTotal, type Item } from '../core/bill';
import { formatBRL } from '../core/money';

/** "Pudim (R$ 21,00)" ou "Pudim (R$ 21,00) e Água (R$ 5,00)". */
export function unassignedList(items: Item[]): string {
  const parts = items.map((it) => `${(it.qty ?? 1) > 1 ? `${it.qty}× ` : ''}${it.name} (${formatBRL(itemTotal(it))})`);
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`;
}

/** Frase completa do aviso de itens sem ninguém marcado. */
export function unassignedText(items: Item[]): string {
  const one = items.length === 1;
  return `${unassignedList(items)} ${one ? 'está' : 'estão'} sem ninguém marcado, então ${one ? 'ficou' : 'ficaram'} fora da divisão e do total.`;
}
