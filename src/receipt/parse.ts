// Lê o texto de uma nota fiscal ou comanda (vindo do OCR) e separa itens, serviço e total.
// Função pura e testada: serve para qualquer leitor (Tesseract no celular hoje, IA no futuro).

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
const UNIT = /^(?:UN|UND|UNID|UNI|PC|PCS|KG|G|LT|L|ML|X|\*|UNX|UNDX|KGX)$/;

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
function niceName(raw: string): string {
  const s = raw.toLowerCase().replace(/\s+/g, ' ').trim();
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

  for (const rawLine of text.split(/\r?\n/)) {
    // Pontilhado entre o nome e o preço ("Caipirinha......22,00") vira espaço.
    const line = fixDigits(rawLine.trim().replace(/[.·_]{3,}/g, ' '));
    if (!line) continue;
    const norm = plain(line);
    const money = findMoney(line);
    const last = money.at(-1);

    if (!last) {
      // Nota com o nome numa linha e "2 UN X 6,50 13,00" na de baixo.
      pendingName = !IGNORE.test(norm) && !TOTAL.test(norm) && letters(line) >= 3 ? line : null;
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
    if (TOTAL.test(norm)) {
      out.totalCents = Math.max(out.totalCents ?? 0, last.cents);
      pendingName = null;
      continue;
    }
    if (IGNORE.test(norm)) {
      pendingName = null;
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

  // Serviço sem percentual impresso: calcula a partir do valor, se der um número redondo.
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
