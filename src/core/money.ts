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

// ---------- Centavo que sobra para quem está mais atrás ----------
//
// Dividir R$ 100,00 entre 3 deixa 1 centavo sobrando. Se cada item (ou despesa) dá esse
// centavo para alguém sem olhar os anteriores, os centavos se juntam na mesma pessoa e três
// pessoas que consumiram igual acabam pagando R$ 37,16, R$ 37,15 e R$ 37,14. Aqui cada um tem
// um "saldo de centavos" exato (o que recebeu menos a parte justa, em fração) e o centavo que
// sobra vai para quem está mais atrás. Assim ninguém fica a 1 centavo ou mais da parte justa,
// e quem consumiu igual paga igual sempre que o total divide certinho.

/** Fração exata [numerador, denominador > 0], em centavos. */
export type Frac = [bigint, bigint];
/** Quanto cada pessoa recebeu acima (+) ou abaixo (−) da parte justa, em centavos. */
export type CentDrift = Map<string, Frac>;

const ZERO = BigInt(0);
const ONE = BigInt(1);
const big = (n: number) => BigInt(n);

function gcd(a: bigint, b: bigint): bigint {
  a = a < ZERO ? -a : a;
  b = b < ZERO ? -b : b;
  while (b !== ZERO) [a, b] = [b, a % b];
  return a;
}
function frac(n: bigint, d: bigint): Frac {
  if (d < ZERO) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return g > ONE ? [n / g, d / g] : [n, d];
}
export const fracOf = (n: number, d = 1): Frac => frac(big(n), big(d));
export const fracAdd = (x: Frac, y: Frac): Frac => frac(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
export const fracSub = (x: Frac, y: Frac): Frac => fracAdd(x, [-y[0], y[1]]);
const fracCmp = (x: Frac, y: Frac) => {
  const l = x[0] * y[1];
  const r = y[0] * x[1];
  return l < r ? -1 : l > r ? 1 : 0;
};
/** Maior inteiro ≤ x. */
const fracFloor = ([n, d]: Frac): bigint => (n >= ZERO ? n / d : -((-n + d - ONE) / d));

const driftOf = (drift: CentDrift, id: string): Frac => drift.get(id) ?? [ZERO, ONE];

/**
 * Divide o valor igual entre `ids`: cada um fica com floor(total / n) e os centavos que sobram
 * vão para quem está mais atrás em `drift` (empate: a partir da posição `start`, que gira).
 * Atualiza `drift`. A soma é sempre o total; cada parte é o piso ou o piso + 1.
 */
export function splitEvenFair(total: number, ids: string[], drift: CentDrift, start = 0): number[] {
  const n = ids.length;
  const base = Math.floor(total / n);
  const rem = total % n;
  const s = ((start % n) + n) % n;
  const order = ids
    .map((id, k) => ({ id, k, d: driftOf(drift, id), pos: (k - s + n) % n }))
    .sort((a, b) => fracCmp(a.d, b.d) || a.pos - b.pos);
  const extra = new Set(order.slice(0, rem).map((o) => o.k));
  const parts = ids.map((_, k) => base + (extra.has(k) ? 1 : 0));
  const fair = fracOf(total, n);
  ids.forEach((id, k) => drift.set(id, fracAdd(driftOf(drift, id), fracSub(fracOf(parts[k]), fair))));
  return parts;
}

/**
 * Divide `total` entre `ids` mirando partes justas exatas (`fair`, que somam `total`), com o
 * que cada um já tem de centavo a mais ou a menos em `drift`: quem está atrás recebe o
 * centavo. Ninguém fica com parte negativa. Atualiza `drift`.
 */
export function splitToward(total: number, ids: string[], fair: Frac[], drift: CentDrift): number[] {
  const want = ids.map((id, k) => fracSub(fair[k], driftOf(drift, id)));
  const parts = want.map((w) => {
    const f = fracFloor(w);
    return f < ZERO ? 0 : Number(f);
  });
  const rest = (k: number) => fracSub(want[k], fracOf(parts[k]));
  let left = total - parts.reduce((a, c) => a + c, 0);
  // Faltou: o centavo vai para quem ficou mais longe do que devia receber.
  while (left > 0) {
    const k = ids.map((_, i) => i).sort((a, b) => fracCmp(rest(b), rest(a)) || a - b)[0];
    parts[k]++;
    left--;
  }
  // Passou (só quando alguém não podia ficar negativo): tira de quem recebeu mais do que devia.
  while (left < 0) {
    const k = ids.map((_, i) => i).filter((i) => parts[i] > 0).sort((a, b) => fracCmp(rest(a), rest(b)) || b - a)[0];
    parts[k]--;
    left++;
  }
  ids.forEach((id, k) => drift.set(id, fracAdd(driftOf(drift, id), fracSub(fracOf(parts[k]), fair[k]))));
  return parts;
}
