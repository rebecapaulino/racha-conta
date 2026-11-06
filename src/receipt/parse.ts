// Lê o texto de uma nota fiscal ou comanda (vindo do OCR) e separa itens, serviço e total.
// Função pura e testada: serve para qualquer leitor (PaddleOCR ou Tesseract, no celular).

import { MAX_ITEM_NAME, MAX_QTY } from '../core/bill';

export interface ReceiptItem {
  name: string;
  qty: number;
  /** Preço de uma unidade, em centavos. */
  cents: number;
}

export interface ParsedReceipt {
  items: ReceiptItem[];
  /** Percentual de serviço impresso na nota (ex.: 10), se achou. */
  servicePct: number | null;
  serviceCents: number | null;
  subtotalCents: number | null;
  totalCents: number | null;
}

/** Acima disso numa linha só, é quase certo que a leitura errou (ex.: código lido como preço). */
const MAX_LINE_CENTS = 1_000_000;

// "44,00", "1.250,50", "142.00", "R$ 8, 90" (o OCR às vezes põe espaço perto da vírgula).
const MONEY = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d+)\s?[,.]\s?(\d{2})(?![\d])/g;

const SUBTOTAL = /\bSUB\s*-?\s*TOTAL\b|\bTOTAL\s+(?:DOS\s+|DE\s+)?(?:ITENS|PRODUTOS|CONSUMO|PARCIAL)\b|\bVALOR\s+(?:DOS\s+)?ITENS\b/;
const SERVICE = /SERVICO|\bSERV\b|TX\.?\s*SERV|TAXA\s+(?:DE\s+)?SERV|GORJETA|COMISSAO|\bGARCOM\b.*%|^\s*\d{1,2}\s*%/;
const PER_PERSON = /POR\s+PESSOA|P\/\s*PESSOA|DIVIDIDO/;
const TOTAL = /\bTOTAL\b|\bA\s+PAGAR\b/;
const DISCOUNT = /DESCONTO|\bDESC\b|ACRESCIMO/;
// Linhas que não são itens: dados da loja, pagamento, impostos, cabeçalhos.
const IGNORE =
  /\b(?:CNPJ|CPF|INSC|IE|DATA|HORA|EMISSAO|CAIXA|OPERADOR|ATENDENTE|GARCOM|GARCON|TROCO|DINHEIRO|CARTAO|CREDITO|DEBITO|PIX|PAGO|PAGAMENTO|RECEBIDO|TRIBUTOS?|IMPOSTOS?|ICMS|PIS|COFINS|LEI|CHAVE|PROTOCOLO|CONSULTE|SAT|NFC|NFCE|CUPOM|EXTRATO|TEL|FONE|TELEFONE|ENDERECO|RUA|AV|CEP|MESA|COMANDA|CONTA|PESSOAS?|PERMANENCIA|SENHA|OBRIGADO|VOLTE|SITE|WWW|CONFERENCIA|QTD|QTDE|DESCRICAO|ITEM|VL|UNIT|PRECO|COD|CODIGO)\b/;
// Cabeçalho do item na NFC-e: "1 211 - SOPA COM CARNE" (nº, código, nome), com o preço na linha de baixo.
const ITEM_HEAD = /(?:^|[\s_])\d{2,5}\)?\s*[-–—−]\s*(\p{L}.*)$/u;
// O mesmo sem o traço, que o leitor às vezes perde: "2 245 BRIGADEIRO", "À 084 SUCO".
const ITEM_HEAD_LOOSE = /^\W*(?:[\p{L}\d]\s+)?\d{3,5}\s+(\p{L}.*)$/u;
// "3 x R$ 12,50 ... R$ 37,50": a quantidade no começo da linha de preço.
const QTY_PREFIX = /^\W*(\d{1,2})\s*[xX×]/;
const UNIT = /^(?:UN|UND|UNID|UNI|PC|PCS|KG|G|LT|L|ML|X|\*|UNX|UNDX|KGX)$/;

/** Distância de edição até 1: a palavra é `word` com no máximo uma letra trocada, a mais ou a menos. */
function nearWord(token: string, word: string): boolean {
  if (Math.abs(token.length - word.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < token.length && j < word.length) {
    if (token[i] === word[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (token.length > word.length) i++;
    else if (token.length < word.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (token.length - i) + (word.length - j) <= 1;
}

const wordsOf = (norm: string) => norm.split(/[^A-Z0-9]+/).filter(Boolean);
/** "TOTAL" com uma letra trocada pelo leitor ("TUTAL", "T0TAL", "LOTAL"). */
const hasTotalWord = (norm: string) => wordsOf(norm).some((w) => nearWord(w, 'TOTAL'));
/** Linha que começa com "VALOR" ("UALOR PAGO", "VALOR PASO"): é resumo da nota, nunca item. */
const startsWithValor = (norm: string) => nearWord(wordsOf(norm)[0] ?? '', 'VALOR');

/** Sem acento e em maiúsculas, só para comparar palavras. */
function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

/** Corrige trocas comuns do OCR dentro de números: "44,O0" → "44,00", "l2,50" → "12,50". */
function fixDigits(line: string): string {
  return line
    .split(/(\s+)/)
    .map((tok) =>
      /\d/.test(tok) && /[,.]/.test(tok) && /^[\dOoIl|S$R.,]+$/.test(tok)
        ? tok.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S(?=\d)/g, '5')
        : tok,
    )
    .join('');
}

interface Money {
  cents: number;
  index: number;
  end: number;
}

function findMoney(line: string): Money[] {
  const out: Money[] = [];
  for (const m of line.matchAll(MONEY)) {
    const cents = Number(m[1].replace(/\./g, '')) * 100 + Number(m[2]);
    if (Number.isSafeInteger(cents)) out.push({ cents, index: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

function pctOf(norm: string): number | null {
  const m = norm.match(/(\d{1,2})(?:[,.]\d+)?\s*%/);
  return m ? Number(m[1]) : null;
}

/** "PICANHA NA CHAPA" → "Picanha na chapa". */
export function niceName(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // Zero solto no meio da palavra é a letra "o" ("ch0pp", "queij0"); "300ml" continua igual.
    .replace(/(?<=\p{L})0(?!\d)|(?<![\p{L}\d])0(?=\p{L})/gu, 'o')
    .trim();
  return (s.charAt(0).toUpperCase() + s.slice(1)).slice(0, MAX_ITEM_NAME).trim();
}

interface NamePart {
  name: string;
  qty: number | null;
  /** Quantidade com vírgula (peso, ex.: 0,452 KG): não vira unidades. */
  weighted: boolean;
}

/** Separa o nome do item da quantidade e dos códigos que vêm antes do preço. */
function splitName(pre: string, pendingOk = false): NamePart {
  const tokens = pre
    .replace(/R\$/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let qty: number | null = null;
  let weighted = false;

  // Códigos no começo: "001", "7891234567890" (3+ dígitos ou começando com zero).
  while (tokens.length && /^\d+$/.test(tokens[0]) && (tokens[0].length >= 3 || tokens[0].startsWith('0'))) tokens.shift();

  // Quantidade no começo: "2 CAIPIRINHA", "2X CHOPP", "3x Chopp".
  const lead = tokens[0]?.match(/^(\d{1,2})[Xx*]?$/);
  if (lead && tokens.length > 1 && Number(lead[1]) >= 1) {
    qty = Number(lead[1]);
    tokens.shift();
  }

  // Quantidade no fim: "... 2 UN X", "... 3 X", "... 0,452 KG X", "... 1 UN".
  for (;;) {
    const last = tokens.at(-1);
    if (!last) break;
    const u = plain(last);
    if (UNIT.test(u)) {
      tokens.pop();
      continue;
    }
    // "2", "2UN", "2X", "2UNX" (o OCR às vezes junta) ou peso "0,452".
    // Inteiro com 3 dígitos (ex.: "CHOPP 300") é parte do nome.
    const n = last.match(/^(?:(\d{1,2})|(\d{1,3})[,.](\d{1,3}))(?:UN|UND|UNID|PC|PCS|KG|LT)?X?$/i);
    if (n && (tokens.length > 1 || pendingOk) && qty === null) {
      const prev = plain(tokens.at(-2) ?? '');
      if (n[3] !== undefined) weighted = Number(n[3]) > 0 || Number(n[2]) !== 1;
      else qty = Number(n[1]);
      tokens.pop();
      if (UNIT.test(prev)) tokens.pop();
      continue;
    }
    break;
  }

  const name = tokens
    .join(' ')
    .replace(/^[-–*#:.\s]+|[-–*#:.=\s]+$/g, '')
    .trim();
  return { name, qty, weighted };
}

function letters(s: string): number {
  return (s.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
}

/** Lê o texto da nota. Linhas que não entende são ignoradas (a pessoa revisa depois). */
export function parseReceipt(text: string): ParsedReceipt {
  const out: ParsedReceipt = { items: [], servicePct: null, serviceCents: null, subtotalCents: null, totalCents: null };
  let pendingName: string | null = null;
  // O nome pendente veio de um cabeçalho de item: vale mais que o texto da linha de preço.
  let headName = false;
  // Depois do total só vêm pagamento, tributos e dados da nota: nada disso é item.
  let afterTotal = false;

  for (const rawLine of text.split(/\r?\n/)) {
    // Pontilhado entre o nome e o preço ("Caipirinha......22,00") vira espaço.
    const line = fixDigits(rawLine.trim().replace(/[.·_]{3,}/g, ' ').replace(/×/g, 'x'));
    if (!line) continue;
    const norm = plain(line);
    const money = findMoney(line);
    const last = money.at(-1);

    if (!last) {
      // Nota com o nome numa linha e "2 UN X 6,50 13,00" na de baixo.
      pendingName = !IGNORE.test(norm) && !TOTAL.test(norm) && letters(line) >= 3 ? line : null;
      // O OCR deixa sujeira depois de 2+ espaços ("SOPA COM CARNE       À").
      // ... e o nome é o maior pedaço ("t 21 1 − s  SOPA COM CARNE").
      const head = (line.match(ITEM_HEAD) ?? line.match(ITEM_HEAD_LOOSE))?.[1]
        .split(/\s{2,}/)
        .reduce((a, b) => (b.length > a.length ? b : a))
        .replace(/[^\p{L}\p{N})]+$/u, '');
      headName = !!head && !afterTotal && letters(head) >= 3 && !IGNORE.test(plain(head));
      if (headName) pendingName = head!;
      continue;
    }

    if (SUBTOTAL.test(norm)) {
      out.subtotalCents = last.cents;
      pendingName = null;
      continue;
    }
    if (SERVICE.test(norm) && !PER_PERSON.test(norm)) {
      out.serviceCents = last.cents;
      out.servicePct = pctOf(norm) ?? out.servicePct;
      pendingName = null;
      continue;
    }
    if (PER_PERSON.test(norm) || DISCOUNT.test(norm)) {
      pendingName = null;
      continue;
    }
    if (TOTAL.test(norm) || hasTotalWord(norm)) {
      out.totalCents = Math.max(out.totalCents ?? 0, last.cents);
      afterTotal = out.items.length > 0;
      pendingName = null;
      continue;
    }
    if (afterTotal || startsWithValor(norm) || (IGNORE.test(norm) && !headName)) {
      pendingName = null;
      continue;
    }
    if (headName && pendingName) {
      const name = niceName(pendingName);
      pendingName = null;
      headName = false;
      const prefix = line.match(QTY_PREFIX);
      const n = prefix ? Number(prefix[1]) : 0;
      const unit = money.length > 1 ? money.at(-2)!.cents : 0;
      if (n >= 1 && n <= MAX_QTY && money.length === 1 && last.index - prefix![0].length <= 5) {
        // Só o preço da unidade saiu legível ("3 x R$ 12,50 ... (borrado)").
        out.items.push({ name, qty: n, cents: last.cents });
      } else if (n >= 1 && n <= MAX_QTY && last.cents % n === 0) {
        out.items.push({ name, qty: n, cents: last.cents / n });
      } else if (unit > 0 && last.cents % unit === 0 && last.cents / unit <= MAX_QTY) {
        out.items.push({ name, qty: last.cents / unit, cents: unit });
      } else {
        out.items.push({ name, qty: 1, cents: last.cents });
      }
      continue;
    }

    // Item: o último valor é o total da linha; o de antes (se houver) é o preço da unidade.
    const lineTotal = last.cents;
    const unit = money.length > 1 ? money.at(-2)!.cents : null;
    const first = money.length > 1 ? money.at(-2)! : last;
    // pendingOk: a linha pode ser só "2UNX 68,90 137,80", com o nome na linha de cima.
    let part = splitName(line.slice(0, first.index), !!pendingName);
    if (letters(part.name) < 2 && pendingName) part = { ...splitName(pendingName), qty: part.qty, weighted: part.weighted };
    pendingName = null;
    if (letters(part.name) < 2 || lineTotal <= 0 || lineTotal > MAX_LINE_CENTS) continue;

    let qty = 1;
    let cents = lineTotal;
    if (unit && unit > 0 && lineTotal % unit === 0 && lineTotal / unit >= 1 && lineTotal / unit <= MAX_QTY && !part.weighted) {
      qty = lineTotal / unit;
      cents = unit;
    } else if (!part.weighted && part.qty && part.qty > 1 && part.qty <= MAX_QTY && lineTotal % part.qty === 0) {
      qty = part.qty;
      cents = lineTotal / part.qty;
    }

    const name = niceName(part.name.replace(new RegExp(`\\s+${qty}$`), ''));
    if (letters(name) < 2) continue;
    out.items.push({ name, qty, cents });
  }

  return cleanReceipt(dropTotalsReadAsItems(out));
}

/**
 * Uma "linha de item" que vale exatamente a soma de todas as de antes é o total da nota, com a
 * palavra ilegível (nenhum item custa isso por acaso). Ela e o que vem depois saem da lista.
 */
function dropTotalsReadAsItems(r: ParsedReceipt): ParsedReceipt {
  let sum = 0;
  for (let i = 0; i < r.items.length; i++) {
    const line = r.items[i].cents * r.items[i].qty;
    if (i >= 2 && line === sum) return { ...r, items: r.items.slice(0, i), totalCents: r.totalCents ?? sum };
    sum += line;
  }
  return r;
}

const posCents = (v: number | null) => (v !== null && Number.isSafeInteger(v) && v > 0 && v <= MAX_LINE_CENTS * 100 ? v : null);

/**
 * Passo final de qualquer leitura: descarta item inválido e, se a nota
 * trouxe o serviço sem o percentual, calcula o percentual quando der um número redondo.
 */
export function cleanReceipt(r: ParsedReceipt): ParsedReceipt {
  const items = r.items
    .map((i) => ({ name: i.name.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_NAME).trim(), qty: i.qty, cents: i.cents }))
    .filter(
      (i) =>
        letters(i.name) >= 2 &&
        Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= MAX_QTY &&
        Number.isSafeInteger(i.cents) && i.cents > 0 && i.cents * i.qty <= MAX_LINE_CENTS,
    );
  const out: ParsedReceipt = {
    items,
    servicePct: r.servicePct !== null && Number.isInteger(r.servicePct) && r.servicePct > 0 && r.servicePct <= 30 ? r.servicePct : null,
    serviceCents: posCents(r.serviceCents),
    subtotalCents: posCents(r.subtotalCents),
    totalCents: posCents(r.totalCents),
  };
  const base = out.subtotalCents ?? sumItems(out.items);
  if (out.servicePct === null && out.serviceCents && base > 0) {
    const pct = Math.round((out.serviceCents * 100) / base);
    if (Math.abs(Math.round((base * pct) / 100) - out.serviceCents) <= 1) out.servicePct = pct;
  }
  return out;
}

export function sumItems(items: ReceiptItem[]): number {
  return items.reduce((s, i) => s + i.cents * i.qty, 0);
}

/** Valor dos itens impresso na nota, para conferir com a soma lida. */
export function expectedItemsTotal(r: Pick<ParsedReceipt, 'subtotalCents' | 'totalCents' | 'serviceCents'>): number | null {
  if (r.subtotalCents) return r.subtotalCents;
  if (r.totalCents && r.serviceCents) return r.totalCents - r.serviceCents;
  return r.totalCents;
}
