// Dinheiro sempre em centavos inteiros. Nunca somar reais como float.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos como "R$ 12,50". */
export function formatBRL(cents: number): string {
  // Intl usa espaço não separável depois de "R$"; trocamos por espaço comum
  // para o texto copiado para o WhatsApp ficar previsível.
  return brl.format(cents / 100).replace(/ /g, ' ');
}

/**
 * Divide o valor em n partes iguais: cada uma fica com floor(total / n) e os centavos que
 * sobram vão 1 por parte, a partir da posição `start`. Quem chama gira o `start` de uma
 * despesa para outra, para o centavo extra não cair sempre na mesma pessoa.
 * A soma das partes é sempre o total.
 */
export function splitEven(total: number, n: number, start = 0): number[] {
  const base = Math.floor(total / n);
  const rem = total % n;
  const s = ((start % n) + n) % n;
  return Array.from({ length: n }, (_, k) => base + ((k - s + n) % n < rem ? 1 : 0));
}

/**
 * Divide o valor proporcionalmente aos pesos (inteiros ≥ 0) pelo método do maior resto:
 * cada parte fica com o piso da sua proporção e os centavos que faltam vão para os maiores
 * restos. Empate é decidido pela posição a partir de `start`. A soma é sempre o total.
 * Retorna null quando todos os pesos são zero (não há como dividir).
 */
export function splitWeighted(total: number, weights: number[], start = 0): number[] | null {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum <= 0) return null;
  const n = weights.length;
  const s = ((start % n) + n) % n;
  const out: number[] = [];
  const rest: { k: number; frac: number; pos: number }[] = [];
  weights.forEach((w, k) => {
    // Só inteiros: a divisão abaixo é exata porque tira o resto antes.
    const num = total * w;
    const frac = num % sum;
    out.push((num - frac) / sum);
    rest.push({ k, frac, pos: (k - s + n) % n });
  });
  rest.sort((a, b) => b.frac - a.frac || a.pos - b.pos);
  let left = total - out.reduce((a, c) => a + c, 0);
  for (let i = 0; left > 0; i++, left--) out[rest[i].k]++;
  return out;
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
