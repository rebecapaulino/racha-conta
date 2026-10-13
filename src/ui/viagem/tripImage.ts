// Resumo da viagem em imagem para mandar no grupo: o mesmo papel serrilhado da notinha do
// Rolê, com quem paga quem (agrupado por quem paga) e quanto cada um pagou e consumiu.
// Desenhado no próprio aparelho (canvas), então funciona até sem internet.

import { formatBRL } from '../../core/money';
import { groupByPayer, settleTransfers, type SettleMode, type Trip, type TripSummary } from '../../core/trip';
import { C, coin, dash, fitText, FONT, loadFonts, PERSON, roundRect, tint, wrap } from '../receiptImage';
import { tripDates } from './tripDates';

const W = 1080;
const M = 64;
const P = 64;
const PW = W - 2 * M;
const CW = PW - 2 * P;
const TEETH = 18;

interface Input {
  trip: Trip;
  summary: TripSummary;
  mode: SettleMode;
}

const f = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

export async function renderTripImage({ trip, summary, mode }: Input): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  canvas.width = W;
  canvas.height = 1;
  // Primeiro mede (desenhando num canvas de 1px), depois desenha de verdade no tamanho certo.
  const paperH = draw(ctx, { trip, summary, mode }, 0) + P - 24;
  const H = M + 24 + paperH + TEETH + 120;
  canvas.height = H;
  background(ctx, H, paperH);
  draw(ctx, { trip, summary, mode }, M + 24);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

function background(ctx: CanvasRenderingContext2D, H: number, paperH: number) {
  ctx.fillStyle = C.page;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.8);
  glow.addColorStop(0, C.glow);
  glow.addColorStop(1, 'rgba(202, 40, 81, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

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

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = f(600, 28);
  ctx.fillStyle = C.footer;
  const foot = 'Feito com Racha Conta';
  const fw = ctx.measureText(foot).width + 40;
  coin(ctx, W / 2 - fw / 2, bottom + TEETH + 46, 28, C.coral);
  ctx.fillText(foot, W / 2 - fw / 2 + 40, bottom + TEETH + 61);
}

function avatar(ctx: CanvasRenderingContext2D, name: string, color: number, cx: number, cy: number, r: number) {
  const c = PERSON[color % PERSON.length];
  ctx.fillStyle = tint(c, 0.16);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c;
  ctx.font = f(800, Math.round(r * 0.9));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name.trim()[0] || '?').toUpperCase(), cx, cy + 2);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
}

/** Desenha o conteúdo do papel a partir de `top` e devolve a altura usada. */
function draw(ctx: CanvasRenderingContext2D, { trip, summary, mode }: Input, top: number): number {
  const left = M + P;
  const right = left + CW;
  const center = W / 2;
  const person = (id: string) => trip.people.find((p) => p.id === id)!;
  let y = top + P;

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

  // Nome da viagem, datas e total
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.ink;
  ctx.font = f(800, 64);
  for (const line of wrap(ctx, trip.name.trim() || 'Viagem', CW, 2)) {
    ctx.fillText(line, center, y);
    y += 76;
  }
  y += 12;
  const n = trip.people.length;
  const dates = tripDates(trip.start, trip.end);
  ctx.font = f(500, 32);
  ctx.fillStyle = C.muted;
  ctx.fillText(fitText(ctx, `${dates ? `${dates} · ` : ''}${n} ${n === 1 ? 'pessoa' : 'pessoas'}`, CW), center, y);
  y += 56;
  ctx.font = f(600, 30);
  ctx.fillText('Gasto total da viagem', center, y);
  y += 44;
  ctx.font = f(800, 72);
  ctx.fillStyle = C.primary;
  ctx.fillText(formatBRL(summary.total), center, y);
  y += 88 + 32;
  dash(ctx, left, y, CW);
  y += 3 + 40;

  // Quem paga quem
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = f(800, 40);
  ctx.fillText('Para ficar tudo quite', left, y);
  y += 54;
  ctx.font = f(500, 28);
  ctx.fillStyle = C.muted;
  ctx.fillText(mode === 'direct' ? 'Cada um paga para quem pagou as despesas.' : 'Com o menor número de Pix.', left, y);
  y += 56;

  const groups = groupByPayer(settleTransfers(summary, mode), trip);
  if (groups.length === 0) {
    ctx.fillStyle = C.okSoft;
    roundRect(ctx, left, y, CW, 96, 24);
    ctx.fill();
    ctx.fillStyle = C.ok;
    ctx.font = f(800, 36);
    ctx.textAlign = 'center';
    ctx.fillText('Está tudo quite! ✓', center, y + 30);
    ctx.textAlign = 'left';
    y += 96 + 24;
  }
  for (const g of groups) {
    const from = person(g.from);
    const boxH = 104 + g.items.length * 72 + 16;
    ctx.fillStyle = '#F6F2F0';
    roundRect(ctx, left, y, CW, boxH, 28);
    ctx.fill();
    avatar(ctx, from.name, from.color, left + 60, y + 56, 34);
    ctx.textAlign = 'right';
    ctx.font = f(800, 44);
    ctx.fillStyle = C.primary;
    const total = formatBRL(g.cents);
    ctx.fillText(total, right - 28, y + 32);
    const tw = ctx.measureText(total).width;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = f(800, 38);
    ctx.fillText(fitText(ctx, `${from.name} paga`, right - 28 - tw - 24 - (left + 112)), left + 112, y + 22);
    ctx.font = f(500, 26);
    ctx.fillStyle = C.muted;
    ctx.fillText(g.items.length > 1 ? `para ${g.items.length} pessoas` : 'para 1 pessoa', left + 112, y + 66);
    let iy = y + 112;
    for (const t of g.items) {
      const to = person(t.to);
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left + 28, iy - 6);
      ctx.lineTo(right - 28, iy - 6);
      ctx.stroke();
      ctx.fillStyle = C.muted;
      ctx.font = f(700, 30);
      ctx.fillText('→', left + 46, iy + 14);
      avatar(ctx, to.name, to.color, left + 116, iy + 30, 24);
      ctx.textAlign = 'right';
      ctx.font = f(700, 34);
      ctx.fillStyle = C.ink;
      const amount = formatBRL(t.cents);
      ctx.fillText(amount, right - 28, iy + 12);
      const aw = ctx.measureText(amount).width;
      ctx.textAlign = 'left';
      ctx.font = f(600, 32);
      ctx.fillText(fitText(ctx, to.name, right - 28 - aw - 24 - (left + 156)), left + 156, iy + 12);
      iy += 72;
    }
    y += boxH + 20;
  }
  y += 20;
  dash(ctx, left, y, CW);
  y += 3 + 40;

  // Quanto cada um pagou e consumiu
  ctx.fillStyle = C.ink;
  ctx.font = f(800, 40);
  ctx.fillText('Quanto cada um gastou', left, y);
  y += 54;
  ctx.font = f(500, 28);
  ctx.fillStyle = C.muted;
  ctx.fillText('Pagou: o que pôs no caixa. Consumiu: a parte dele.', left, y);
  y += 56;
  for (const r of summary.people) {
    avatar(ctx, r.person.name, r.person.color, left + 32, y + 36, 32);
    const state = r.balance > 0 ? 'in' : r.balance < 0 ? 'out' : 'zero';
    const tag = state === 'in' ? `recebe ${formatBRL(r.balance)}` : state === 'out' ? `paga ${formatBRL(-r.balance)}` : 'quite';
    ctx.font = f(800, 26);
    const tagW = ctx.measureText(tag).width + 36;
    ctx.fillStyle = state === 'in' ? C.okSoft : state === 'out' ? C.soft : '#F1EEEC';
    roundRect(ctx, right - tagW, y - 2, tagW, 44, 22);
    ctx.fill();
    ctx.fillStyle = state === 'in' ? C.ok : state === 'out' ? C.primary : C.muted;
    ctx.textAlign = 'center';
    ctx.fillText(tag, right - tagW / 2, y + 8);
    ctx.textAlign = 'left';
    const nameX = left + 84;
    ctx.fillStyle = C.ink;
    ctx.font = f(700, 34);
    ctx.fillText(fitText(ctx, r.person.name, right - tagW - 20 - nameX), nameX, y);
    ctx.font = f(500, 26);
    ctx.fillStyle = C.muted;
    const extra = `${r.sent ? ` · mandou ${formatBRL(r.sent)}` : ''}${r.received ? ` · recebeu ${formatBRL(r.received)}` : ''}`;
    ctx.fillText(fitText(ctx, `pagou ${formatBRL(r.paid)} · consumiu ${formatBRL(r.owes)}${extra}`, right - nameX), nameX, y + 46);
    y += 96;
  }
  return y - top;
}
