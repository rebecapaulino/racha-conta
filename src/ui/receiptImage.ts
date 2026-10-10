// Notinha em imagem para mandar no WhatsApp: papel serrilhado sobre fundo preto,
// com a foto do rolê (se houver), quanto cada um paga e o total.
// Desenhada no próprio aparelho (canvas), então funciona até sem internet.

import { payments, type Bill, type SplitResult } from '../core/bill';
import { formatBRL } from '../core/money';
import { unassignedList } from './unassigned';

const W = 1080;
const M = 64; // margem do fundo
const P = 64; // margem dentro do papel
const PW = W - 2 * M;
const CW = PW - 2 * P;
const TEETH = 18;

const C = {
  page: '#121212',
  glow: 'rgba(202, 40, 81, 0.28)',
  footer: '#BEB9B2',
  paper: '#FFFFFF',
  ink: '#1D1A1B',
  muted: '#736C6A',
  line: '#E3DAD6',
  primary: '#CA2851',
  coral: '#FF6766',
  soft: '#FCE9ED',
  ok: '#0F7A3D',
  okSoft: '#E3F6EA',
  warnInk: '#8A3B00',
  warnSoft: '#FFF1DE',
};
const PERSON = ['#CA2851', '#C2410C', '#0F766E', '#4338CA', '#9333EA', '#A16207'];

interface Input {
  bill: Bill;
  result: SplitResult;
  startedAt: number;
  photoUrl: string | null;
}

// Fonte do app que já vem no pacote: a notinha sai igual em qualquer celular, até offline.
const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

async function loadFonts() {
  try {
    await Promise.all([500, 600, 700, 800].map((w) => document.fonts.load(`${w} 32px "Plus Jakarta Sans"`)));
  } catch {
    /* sem a fonte, usa a do sistema */
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text.replace(/…$/, '');
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = fitText(ctx, kept[maxLines - 1] + '…', maxW);
    return kept;
  }
  return lines.map((l) => fitText(ctx, l, maxW));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function dash(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.save();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.fill(new Path2D('M16 3a13 13 0 0 0 0 26z'));
  ctx.lineWidth = 2.5;
  ctx.stroke(new Path2D('M18 3a13 13 0 0 1 0 26z'));
  ctx.restore();
}

/** Mistura a cor com branco (como o fundo claro dos avatares no app). */
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

export async function renderReceipt({ bill, result, startedAt, photoUrl }: Input): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const f = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

  const photo = photoUrl ? await loadImage(photoUrl) : null;
  const title = bill.title.trim() || 'Conta da mesa';
  ctx.font = f(800, 64);
  const titleLines = wrap(ctx, title, CW, 2);
  const payer = bill.people.find((p) => p.id === bill.payerId);
  const payerShare = result.shares.find((s) => s.person.id === payer?.id)?.total ?? 0;
  const showCallout = !!payer && result.shares.length > 1;
  const pay = payments(bill, result);
  const tracking = Object.keys(bill.paid ?? {}).length > 0;

  // Altura: soma os blocos na mesma ordem em que são desenhados.
  const photoH = photo ? Math.round((CW * 9) / 16) + 48 : 0;
  const peopleH = result.shares.length ? result.shares.length * 108 + 8 : 64;
  const paperH =
    P + photoH + 44 + 28 + titleLines.length * 76 + 12 + 44 + 40 + 3 + 40 + peopleH + 40 + 3 + 36 + 2 * 52 + 104 +
    (result.unassigned > 0 ? 96 : 0) + (showCallout ? 156 : 0) + P - 24;
  const H = M + 24 + paperH + TEETH + 120;
  canvas.width = W;
  canvas.height = H;

  // Fundo preto com um brilho carmim discreto atrás do papel.
  ctx.fillStyle = C.page;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.8);
  glow.addColorStop(0, C.glow);
  glow.addColorStop(1, 'rgba(202, 40, 81, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Papel com borda serrilhada embaixo.
  const x0 = M;
  const top = M + 24;
  const bottom = top + paperH;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = C.paper;
  ctx.beginPath();
  ctx.moveTo(x0, top + 36);
  ctx.arcTo(x0, top, x0 + 36, top, 36);
  ctx.arcTo(x0 + PW, top, x0 + PW, top + 36, 36);
  ctx.lineTo(x0 + PW, bottom);
  const teeth = Math.round(PW / 34);
  const tw = PW / teeth;
  for (let i = teeth; i > 0; i--) {
    ctx.lineTo(x0 + (i - 0.5) * tw, bottom + TEETH);
    ctx.lineTo(x0 + (i - 1) * tw, bottom);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const left = x0 + P;
  const right = left + CW;
  const center = W / 2;
  let y = top + P;

  if (photo) {
    const ph = Math.round((CW * 9) / 16);
    const scale = Math.max(CW / photo.width, ph / photo.height);
    const sw = CW / scale;
    const sh = ph / scale;
    ctx.save();
    roundRect(ctx, left, y, CW, ph, 28);
    ctx.clip();
    ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, left, y, CW, ph);
    ctx.restore();
    y += ph + 48;
  }

  // Marca
  ctx.textBaseline = 'middle';
  ctx.font = f(800, 28);
  ctx.letterSpacing = '6px';
  const brand = 'RACHA CONTA';
  const bw = ctx.measureText(brand).width + 44 + 14;
  coin(ctx, center - bw / 2, y, 44, C.primary);
  ctx.fillStyle = C.primary;
  ctx.textAlign = 'left';
  ctx.fillText(brand, center - bw / 2 + 58, y + 23);
  ctx.letterSpacing = '0px';
  y += 44 + 28;

  // Lugar e data
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.ink;
  ctx.font = f(800, 64);
  for (const line of titleLines) {
    ctx.fillText(line, center, y);
    y += 76;
  }
  y += 12;
  const d = new Date(startedAt);
  const date = d
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
    .replace(/ de /g, ' ');
  const nItems = bill.items.reduce((a, i) => a + (i.qty ?? 1), 0);
  const nPeople = bill.people.length;
  ctx.font = f(500, 32);
  ctx.fillStyle = C.muted;
  ctx.fillText(
    `${date} · ${nItems} ${nItems === 1 ? 'item' : 'itens'} · ${nPeople} ${nPeople === 1 ? 'pessoa' : 'pessoas'}`,
    center,
    y,
  );
  y += 44 + 40;
  dash(ctx, left, y, CW);
  y += 3 + 40;

  // Quanto cada um paga
  ctx.textAlign = 'left';
  if (result.shares.length === 0) {
    ctx.font = f(500, 32);
    ctx.fillStyle = C.muted;
    ctx.fillText('Ninguém na mesa ainda.', left, y + 12);
  }
  result.shares.forEach((s, i) => {
    const ry = y + i * 108;
    const color = PERSON[s.person.color % PERSON.length];
    ctx.fillStyle = tint(color, 0.16);
    ctx.beginPath();
    ctx.arc(left + 36, ry + 40, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = f(800, 32);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((s.person.name.trim()[0] || '?').toUpperCase(), left + 36, ry + 42);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = f(800, 42);
    ctx.fillStyle = C.ink;
    const amount = formatBRL(s.total);
    ctx.fillText(amount, right, ry + 14);
    const amountW = ctx.measureText(amount).width;

    ctx.textAlign = 'left';
    const nameX = left + 96;
    const isPayer = s.person.id === payer?.id;
    const state = pay.rows[i].state;
    // Etiqueta: "pagou" para quem pagou no caixa; "pago ✓" (verde) para quem já acertou a parte.
    const tag = isPayer ? { text: 'pagou', bg: C.soft, fg: C.primary } :
      tracking && (state === 'paid' || state === 'over') ? { text: 'pago ✓', bg: C.okSoft, fg: C.ok } : null;
    const tagW = tag ? 126 : 0;
    ctx.font = f(700, 38);
    const name = fitText(ctx, s.person.name, right - amountW - 32 - nameX - tagW);
    ctx.fillText(name, nameX, ry + 4);
    if (tag) {
      const nx = nameX + ctx.measureText(name).width + 14;
      ctx.font = f(800, 22);
      const w = ctx.measureText(tag.text).width + 32;
      ctx.fillStyle = tag.bg;
      roundRect(ctx, nx, ry + 8, w, 38, 19);
      ctx.fill();
      ctx.fillStyle = tag.fg;
      ctx.textAlign = 'center';
      ctx.fillText(tag.text, nx + w / 2, ry + 16);
      ctx.textAlign = 'left';
    }
    ctx.font = f(500, 27);
    ctx.fillStyle = C.muted;
    const sub = bill.servicePct
      ? `consumo ${formatBRL(s.consumption)} + serviço ${formatBRL(s.service)}`
      : `consumo ${formatBRL(s.consumption)}`;
    ctx.fillText(fitText(ctx, sub, right - nameX), nameX, ry + 52);
  });
  y += peopleH + 40;
  dash(ctx, left, y, CW);
  y += 3 + 36;

  // Somas e total
  const row = (label: string, value: string) => {
    ctx.font = f(500, 34);
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'left';
    ctx.fillText(label, left, y);
    ctx.font = f(700, 34);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'right';
    ctx.fillText(value, right, y);
    y += 52;
  };
  row('Consumo', formatBRL(result.subtotal));
  row(`Serviço${bill.servicePct ? ` (${bill.servicePct}%)` : ''}`, formatBRL(result.service));
  y += 8;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = f(800, 40);
  ctx.fillStyle = C.ink;
  ctx.fillText('Total', left, y + 70);
  ctx.textAlign = 'right';
  ctx.font = f(800, 76);
  ctx.fillStyle = C.primary;
  ctx.fillText(formatBRL(result.total), right, y + 74);
  y += 96;
  ctx.textBaseline = 'top';

  if (result.unassigned > 0) {
    ctx.fillStyle = C.warnSoft;
    roundRect(ctx, left, y + 12, CW, 68, 20);
    ctx.fill();
    ctx.fillStyle = C.warnInk;
    ctx.font = f(600, 28);
    ctx.textAlign = 'left';
    ctx.fillText(fitText(ctx, `Fora da divisão (ninguém marcado): ${unassignedList(result.unassignedItems)}`, CW - 48), left + 24, y + 31);
    y += 96;
  }

  if (showCallout && payer) {
    ctx.fillStyle = C.soft;
    roundRect(ctx, left, y + 20, CW, 128, 24);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = f(800, 34);
    ctx.fillText(fitText(ctx, `Pague para ${payer.name}`, CW - 56), left + 28, y + 44);
    ctx.font = f(500, 30);
    ctx.fillStyle = C.muted;
    ctx.fillText(
      fitText(
        ctx,
        tracking
          ? pay.remaining > 0
            ? `Falta receber ${formatBRL(pay.remaining)} · ${pay.paidCount} de ${pay.rows.length} já pagaram.`
            : 'Tudo acertado ✓ Todo mundo já pagou.'
          : `${payer.name} pagou a conta e recebe ${formatBRL(result.total - payerShare)} dos outros.`,
        CW - 56,
      ),
      left + 28,
      y + 92,
    );
  }

  // Rodapé no fundo preto
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = f(600, 28);
  ctx.fillStyle = C.footer;
  const foot = 'Feito com Racha Conta';
  const fw = ctx.measureText(foot).width + 40;
  coin(ctx, W / 2 - fw / 2, bottom + TEETH + 46, 28, C.coral);
  ctx.fillText(foot, W / 2 - fw / 2 + 40, bottom + TEETH + 61);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}
