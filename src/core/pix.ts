// Chave Pix de quem recebe e o código "Pix copia e cola" (o mesmo que vai no QR code).
// Só texto, sem interface: a tela mostra a chave, copia e desenha o QR a partir daqui.

/** Tipos de chave Pix. */
export type PixKind = 'cpf' | 'cnpj' | 'phone' | 'email' | 'random';

/**
 * A chave como foi entendida. Guardada sempre no mesmo formato: CPF e CNPJ só com números,
 * celular com "+55", e-mail e chave aleatória em minúsculas. Assim o tipo sai da própria chave.
 */
export interface PixKey {
  key: string;
  kind: PixKind;
}

export type PixParse =
  | { ok: true; key: PixKey; /** Outro jeito de ler o mesmo número (11 dígitos: CPF ou celular). */ alt?: PixKey }
  | { ok: false; error: string };

export const MAX_PIX = 77;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RANDOM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function validCPF(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    return ((sum * 10) % 11) % 10;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

function validCNPJ(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const digit = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((a, w, i) => a + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
}

/** DDDs que existem no Brasil. */
const DDD = new Set(
  '11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '),
);
/** Telefone com DDD (10 ou 11 números). */
const phoneDigits = (d: string) => (d.length === 10 || d.length === 11) && DDD.has(d.slice(0, 2));
const phone = (d: string): PixKey => ({ key: `+55${d}`, kind: 'phone' });

/**
 * Entende o que a pessoa digitou ou colou: CPF, CNPJ, celular, e-mail ou chave aleatória,
 * com ou sem pontos, traços e parênteses. Um número de 11 dígitos que pode ser CPF ou celular
 * volta com as duas leituras, para a pessoa escolher.
 */
export function parsePixKey(input: string): PixParse {
  const raw = input.trim().replace(/\s+/g, '');
  if (!raw) return { ok: false, error: 'Digite a chave Pix.' };
  if (raw.length > MAX_PIX) return { ok: false, error: 'Chave Pix grande demais.' };

  if (raw.includes('@')) {
    return EMAIL.test(raw) ? { ok: true, key: { key: raw.toLowerCase(), kind: 'email' } } : { ok: false, error: 'Esse e-mail não parece certo.' };
  }
  if (RANDOM.test(raw.toLowerCase())) return { ok: true, key: { key: raw.toLowerCase(), kind: 'random' } };

  if (!/^[\d+().\-/]+$/.test(raw)) {
    return { ok: false, error: 'Não parece uma chave Pix. Use CPF, CNPJ, celular, e-mail ou a chave aleatória.' };
  }
  const digits = raw.replace(/\D/g, '');

  if (raw.startsWith('+')) {
    return digits.startsWith('55') && phoneDigits(digits.slice(2))
      ? { ok: true, key: phone(digits.slice(2)) }
      : { ok: false, error: 'O celular precisa ser do Brasil (+55), com DDD.' };
  }
  if (digits.length === 14) {
    return validCNPJ(digits) ? { ok: true, key: { key: digits, kind: 'cnpj' } } : { ok: false, error: 'Esse CNPJ não parece certo.' };
  }
  if (digits.length === 11) {
    const cpf = validCPF(digits);
    // Com a pontuação de um ou de outro, não tem dúvida.
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(raw)) return cpf ? { ok: true, key: { key: digits, kind: 'cpf' } } : { ok: false, error: 'Esse CPF não parece certo.' };
    if (raw.includes('(')) return { ok: true, key: phone(digits) };
    const mobile = phoneDigits(digits) && digits[2] === '9';
    if (cpf && mobile) return { ok: true, key: { key: digits, kind: 'cpf' }, alt: phone(digits) };
    if (cpf) return { ok: true, key: { key: digits, kind: 'cpf' } };
    if (mobile) return { ok: true, key: phone(digits) };
    return { ok: false, error: 'Esse número não parece CPF nem celular com DDD.' };
  }
  if (digits.length === 10 && phoneDigits(digits)) return { ok: true, key: phone(digits) };
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55') && phoneDigits(digits.slice(2))) {
    return { ok: true, key: phone(digits.slice(2)) };
  }
  return { ok: false, error: 'Não parece uma chave Pix. Use CPF, CNPJ, celular, e-mail ou a chave aleatória.' };
}

/** O tipo de uma chave já guardada (no formato de `parsePixKey`). */
export function pixKind(key: string): PixKind {
  if (key.startsWith('+')) return 'phone';
  if (key.includes('@')) return 'email';
  if (/^\d{11}$/.test(key)) return 'cpf';
  if (/^\d{14}$/.test(key)) return 'cnpj';
  return 'random';
}

/** Chave guardada que ainda vale (conta que veio de outro aparelho ou de versão antiga). */
export function isPixKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  const p = parsePixKey(key);
  return p.ok && (p.key.key === key || p.alt?.key === key);
}

export const PIX_KIND_LABEL: Record<PixKind, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  phone: 'Celular',
  email: 'E-mail',
  random: 'Chave aleatória',
};

/** A chave para ler na tela: "123.456.789-09", "(11) 98888-7777". */
export function formatPixKey(key: string): string {
  switch (pixKind(key)) {
    case 'cpf':
      return key.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    case 'cnpj':
      return key.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    case 'phone': {
      const d = key.slice(3);
      return d.length === 11 ? d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3') : d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    }
    default:
      return key;
  }
}

/** A chave para colar no app do banco: só números no CPF, CNPJ e celular (com DDD, sem +55). */
export function pixKeyToCopy(key: string): string {
  return pixKind(key) === 'phone' ? key.slice(3) : key;
}

/** Nome ou cidade no código Pix: sem acento, só letras, números e espaço. */
function plain(s: string, max: number): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC16-CCITT (polinômio 0x1021, começa em 0xFFFF), como pede o Banco Central. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * O "Pix copia e cola" (BR Code do Banco Central) para pagar `cents` para a chave. É o mesmo
 * texto do QR code: o app do banco abre com quem recebe e o valor já preenchidos.
 * Sem valor (ou zero), quem paga digita o valor no banco.
 */
export function pixPayload({ key, name, cents, city = 'BRASIL' }: { key: string; name: string; cents?: number; city?: string }): string {
  const account = field('00', 'br.gov.bcb.pix') + field('01', key);
  const body =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (cents && cents > 0 ? field('54', (cents / 100).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', plain(name, 25) || 'RECEBEDOR') +
    field('60', plain(city, 15) || 'BRASIL') +
    field('62', field('05', '***')) +
    '6304';
  return body + crc16(body);
}

const TEXT_KIND: Record<PixKind, string> = { cpf: 'CPF', cnpj: 'CNPJ', phone: 'celular', email: 'e-mail', random: 'chave aleatória' };

/** Linha do texto do WhatsApp: "Pix (celular): 11988887777", pronta para copiar. */
export function pixText(key: string): string {
  return `Pix (${TEXT_KIND[pixKind(key)]}): ${pixKeyToCopy(key)}`;
}

/**
 * Bloco "Pix de quem recebe" do texto do WhatsApp, com quem ainda tem o que receber e deixou
 * a chave. Sem ninguém, não entra nada.
 */
export function pixBlock(receivers: { name: string; pix?: string }[]): string[] {
  const lines = receivers.filter((r) => isPixKey(r.pix)).map((r) => `- ${r.name} (${TEXT_KIND[pixKind(r.pix!)]}): ${pixKeyToCopy(r.pix!)}`);
  return lines.length ? ['', '*Pix de quem recebe*', ...lines] : [];
}
