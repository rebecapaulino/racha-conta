// Dinheiro sempre em centavos inteiros. Nunca somar reais como float.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos como "R$ 12,50". */
export function formatBRL(cents: number): string {
  // Intl usa espaço não separável depois de "R$"; trocamos por espaço comum
  // para o texto copiado para o WhatsApp ficar previsível.
  return brl.format(cents / 100).replace(/ /g, ' ');
}

/**
 * Converte o que a pessoa digitou em centavos.
 * Aceita "12,50", "12.50", "1.250,50", "1250", "R$ 8,9".
 * Retorna null se o valor for inválido ou não for maior que zero.
 */
export function parseBRL(input: string): number | null {
  const t = String(input).trim().replace(/[^\d.,]/g, '');
  if (!t) return null;

  let intPart: string;
  let decPart = '';

  if (t.includes(',')) {
    // Formato brasileiro: ponto é milhar, vírgula é decimal.
    if (t.indexOf(',') !== t.lastIndexOf(',')) return null;
    [intPart, decPart] = t.replace(/\./g, '').split(',');
  } else {
    const dots = t.split('.').length - 1;
    const last = t.lastIndexOf('.');
    const after = last === -1 ? '' : t.slice(last + 1);
    if (dots === 1 && after.length <= 2) {
      // "12.50" ou "12.5": ponto como decimal.
      [intPart, decPart] = t.split('.');
    } else {
      // "1.250" ou "1.250.000": pontos como milhar.
      if (dots > 0 && !/^\d{1,3}(\.\d{3})+$/.test(t)) return null;
      intPart = t.replace(/\./g, '');
    }
  }

  if (decPart.length > 2) return null;
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return null;
  if (!intPart && !decPart) return null;

  const cents = Number(intPart || '0') * 100 + Number(decPart.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}
