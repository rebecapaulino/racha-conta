// Chaves Pix já digitadas neste aparelho, pelo nome da pessoa: no próximo rolê ou viagem, quem
// paga a conta não precisa digitar a própria chave de novo. Fica só aqui, nunca vai para o grupo.

import { isPixKey } from '../core/pix';

const KEY = 'racha-conta-pix';
const MAX = 20;

const nameKey = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function load(): [string, string][] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((e): e is [string, string] => Array.isArray(e) && typeof e[0] === 'string' && isPixKey(e[1])) : [];
  } catch {
    return [];
  }
}

/** A última chave usada para esse nome neste aparelho. */
export function rememberedPix(name: string): string | null {
  const k = nameKey(name);
  return (k && load().find(([n]) => n === k)?.[1]) || null;
}

/** Guarda a chave do nome (a mais recente primeiro). */
export function rememberPix(name: string, pix: string): void {
  const k = nameKey(name);
  if (!k || !isPixKey(pix)) return;
  try {
    const list = [[k, pix] as [string, string], ...load().filter(([n]) => n !== k)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* armazenamento indisponível: só não lembra da próxima vez */
  }
}
