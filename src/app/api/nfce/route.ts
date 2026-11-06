// Busca na Sefaz os itens da NFC-e cujo QR code o app leu (o navegador não pode abrir o
// site da Sefaz direto). Só segue endereços *.gov.br por https; nada fica guardado.

import { isSefazHost, nfceUrl, parseNfcePage } from '../../../receipt/nfce';
import { fromThisSite, json } from '../same-site';

export const maxDuration = 20;

/** A Sefaz recusa pedidos que não parecem de um navegador. */
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

export async function POST(request: Request) {
  if (!fromThisSite(request)) return json({ error: 'origem' }, 403);
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const start = typeof body?.url === 'string' ? nfceUrl(body.url) : null;
  if (!start) return json({ error: 'qr' }, 400);
  let url: string = start;

  try {
    // Segue até 3 redirecionamentos, conferindo que cada um continua num site do governo.
    for (let hop = 0; hop < 4; hop++) {
      const res = await fetch(url, { headers: HEADERS, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(12_000) });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (next) {
        const to = new URL(next, url);
        if (!isSefazHost(to)) return json({ error: 'sefaz' }, 502);
        url = to.toString();
        continue;
      }
      if (!res.ok) return json({ error: 'sefaz' }, 502);
      const html = await res.text();
      // "recusada": o firewall da Sefaz barrou. "pagina": respondeu, mas sem os itens (nota em
      // contingência ainda não autorizada, por exemplo).
      if (/<title>\s*Request Rejected/i.test(html)) return json({ error: 'recusada' }, 502);
      const parsed = parseNfcePage(html);
      return parsed ? json(parsed) : json({ error: 'pagina' }, 422);
    }
    return json({ error: 'sefaz' }, 502);
  } catch {
    return json({ error: 'sefaz' }, 504);
  }
}
