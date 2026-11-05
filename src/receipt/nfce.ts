// Itens da NFC-e direto da Sefaz: o QR code do cupom leva à consulta pública, que lista
// cada item exatamente como foi registrado (sem erro de leitura). Funções puras e testadas;
// quem busca a página é a rota /api/nfce (o navegador não pode abrir o site da Sefaz direto).

import { MAX_QTY } from '../core/bill';
import { cleanReceipt, niceName, type ParsedReceipt, type ReceiptItem } from './parse';

/**
 * O endereço de consulta lido do QR code, se for de uma NFC-e: https, num site do governo
 * (*.gov.br) e com a chave ("p=..."). Qualquer outro QR code é ignorado.
 */
export function nfceUrl(qr: string): string | null {
  let url: URL;
  try {
    url = new URL(qr.trim());
  } catch {
    return null;
  }
  if (!isSefazHost(url)) return null;
  const p = url.searchParams.get('p') ?? url.searchParams.get('chNFe');
  if (!p || !/^\d{44}/.test(p)) return null;
  return url.toString();
}

/** Só sites do governo, por https (a rota não pode virar uma ponte para qualquer endereço). */
export function isSefazHost(url: URL): boolean {
  return url.protocol === 'https:' && !url.port && /(^|\.)[a-z0-9-]+\.gov\.br$/i.test(url.hostname);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Texto de um pedaço de HTML: sem tags, entidades trocadas e espaços juntados. */
function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
      e[0] === '#'
        ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
        : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1.234,56" → 123456; "0,345" (peso) → 0.345 com `decimals`. */
function num(s: string | undefined): number | null {
  const m = s?.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?/);
  if (!m) return null;
  const v = Number(m[0].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

const cents = (s: string | undefined) => {
  const v = num(s);
  return v === null ? null : Math.round(v * 100);
};

/** O conteúdo do primeiro elemento com a classe dada (ex.: `txtTit`), dentro de `html`. */
function byClass(html: string, cls: string): string | undefined {
  const m = html.match(new RegExp(`<(\\w+)[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`, 'i'));
  return m ? text(m[2]) : undefined;
}

const SERVICE = /\b(?:TAXA\s+DE\s+)?SERVI[CÇ]O\b|\bGORJETA\b|\bTX\.?\s*SERV/i;

/**
 * Lê a página de consulta da NFC-e (o leiaute "tabResult", usado em SP e na maioria dos
 * estados). Item vendido por peso vira 1 unidade com o valor total, como na leitura da foto.
 * Taxa de serviço lançada como item vira o serviço da nota.
 */
export function parseNfcePage(html: string): ParsedReceipt | null {
  const table = html.match(/<table[^>]*id="tabResult"[^>]*>([\s\S]*?)<\/table>/i);
  if (!table) return null;
  const items: ReceiptItem[] = [];
  let serviceCents: number | null = null;
  for (const [, row] of table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const name = byClass(row, 'txtTit');
    const total = cents(byClass(row, 'valor'));
    if (!name || !total || total <= 0) continue;
    if (SERVICE.test(name)) {
      serviceCents = (serviceCents ?? 0) + total;
      continue;
    }
    const qty = num(byClass(row, 'Rqtd')?.replace(/^[^:]*:/, ''));
    const unit = cents(byClass(row, 'RvlUnit')?.replace(/^[^:]*:/, ''));
    // Quantidade inteira e o unitário fechando o total: guarda as unidades; senão, 1 com o total.
    const whole = qty !== null && Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY;
    if (whole && unit && unit * qty === total) items.push({ name: niceName(name), qty, cents: unit });
    else if (whole && total % qty === 0) items.push({ name: niceName(name), qty, cents: total / qty });
    else items.push({ name: niceName(name), qty: 1, cents: total });
  }
  if (items.length === 0) return null;

  // Totais: "Valor total R$" (dos itens) e "Valor a pagar R$" (depois de descontos e acréscimos).
  let subtotalCents: number | null = null;
  let totalCents: number | null = null;
  for (const [, line] of html.matchAll(/<div[^>]*id="linhaTotal"[^>]*>([\s\S]*?)<\/div>/gi)) {
    const label = text(line.match(/<label[^>]*>([\s\S]*?)<\/label>/i)?.[1] ?? '').toLowerCase();
    const value = cents(byClass(line, 'totalNumb'));
    if (value === null) continue;
    if (/valor\s+total/.test(label)) subtotalCents = value;
    else if (/a\s+pagar/.test(label)) totalCents = value;
  }
  // A taxa de serviço entrou como item: o "valor total" dos itens a inclui.
  if (serviceCents && subtotalCents) subtotalCents -= serviceCents;
  return cleanReceipt({ items, servicePct: null, serviceCents, subtotalCents, totalCents });
}
