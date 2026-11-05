// O leitor que precisa de internet: os itens da NFC-e direto da Sefaz, pelo QR code do cupom.
// Quando não dá (sem QR code, Sefaz fora do ar), devolve null e o leitor do celular assume.

import { nfceUrl } from './nfce';
import type { ParsedReceipt } from './parse';
import { findQr } from './qr';

/** Itens da NFC-e pela Sefaz, se a foto tiver o QR code do cupom. */
export async function readFromSefaz(image: Blob, signal: AbortSignal, onFound: () => void): Promise<ParsedReceipt | null> {
  const qr = await findQr(image).catch(() => null);
  const url = qr ? nfceUrl(qr) : null;
  if (!url || signal.aborted) return null;
  onFound();
  const res = await fetch('/api/nfce', {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: { 'Content-Type': 'application/json' },
    signal,
  }).catch(() => null);
  if (!res?.ok) return null;
  const r = (await res.json().catch(() => null)) as ParsedReceipt | null;
  return Array.isArray(r?.items) && r.items.length ? r : null;
}
