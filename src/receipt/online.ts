// Os dois leitores que precisam de internet: os itens da NFC-e direto da Sefaz (pelo QR code)
// e a leitura da foto com IA. Quando não dá (sem rede, sem QR, IA desligada), devolvem null
// e o leitor do celular assume.

import { nfceUrl } from './nfce';
import type { ParsedReceipt } from './parse';
import { decode } from './prepare';
import { findQr } from './qr';

/** Lado maior da foto enviada: legível para a IA e leve para subir pelo celular. */
const UPLOAD_EDGE = 2400;

/** A IA respondeu "desligada" (sem chave): não tenta de novo até recarregar o app. */
let aiOff = false;

async function post(path: string, body: BodyInit, type: string, signal: AbortSignal): Promise<ParsedReceipt | null> {
  const res = await fetch(path, { method: 'POST', body, headers: { 'Content-Type': type }, signal });
  if (res.status === 503) aiOff = true;
  if (!res.ok) return null;
  const r = (await res.json()) as ParsedReceipt;
  return Array.isArray(r?.items) ? r : null;
}

/** Itens da NFC-e pela Sefaz, se a foto tiver o QR code do cupom. */
export async function readFromSefaz(image: Blob, signal: AbortSignal, onFound: () => void): Promise<ParsedReceipt | null> {
  const qr = await findQr(image).catch(() => null);
  const url = qr ? nfceUrl(qr) : null;
  if (!url || signal.aborted) return null;
  onFound();
  const r = await post('/api/nfce', JSON.stringify({ url }), 'application/json', signal).catch(() => null);
  return r && r.items.length ? r : null;
}

/** A foto reduzida, em JPEG, para enviar. */
async function shrink(image: Blob): Promise<Blob> {
  const img = await decode(image);
  const scale = Math.min(1, UPLOAD_EDGE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sem canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if ('close' in img) img.close();
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('sem jpeg'))), 'image/jpeg', 0.85));
}

/** A foto lida pela IA, ou null se ela estiver desligada ou falhar. */
export async function readWithAi(image: Blob, signal: AbortSignal): Promise<ParsedReceipt | null> {
  if (aiOff) return null;
  const small = await shrink(image);
  if (signal.aborted) return null;
  return post('/api/ler-nota', small, 'image/jpeg', signal).catch(() => null);
}
