// Foto de cada pessoa da conta (Rolê ou Viagem) a partir das contas do grupo.
// As pessoas são nomes digitados ("Rebeca"); as contas têm o nome do Google ("Rebeca Oliveira").
// Liga pelo nome, e só quando não há dúvida: na dúvida, fica a inicial (nunca a foto errada).

export interface Face {
  name: string;
  photo: string | null;
  /** Conta do grupo (quando se sabe). */
  userId?: string;
}

/** "  Rebéca   OLIVEIRA " → "rebeca oliveira" */
export const normalName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** A pessoa e a conta são a mesma? Nome inteiro igual, ou o nome digitado é o primeiro nome da conta. */
export function sameName(person: string, account: string): boolean {
  const p = normalName(person);
  const a = normalName(account);
  if (!p || !a) return false;
  return p === a || (!p.includes(' ') && a.split(' ')[0] === p);
}

/**
 * id da pessoa → foto da conta. Quem está ligada a uma conta do grupo (entrou pelo convite e
 * é ela) usa a foto dessa conta, sempre. Quem não está ligada só ganha foto pelo nome, e só
 * de uma conta que ainda não é de ninguém: assim uma "Rebeca" criada à mão nunca pega a foto
 * da Rebeca de verdade. Pelo nome, só quem combina com exatamente uma conta, e essa conta
 * combina só com essa pessoa (duas "Ana" na mesa, ou duas contas "Ana …": nenhuma ganha foto).
 */
export function facesByName(people: { id: string; name: string; userId?: string }[], accounts: Face[]): Record<string, string> {
  const https = (photo: string | null | undefined): photo is string => !!photo && /^https:\/\//.test(photo);
  const out: Record<string, string> = {};
  const linked = new Set(people.map((p) => p.userId).filter((u): u is string => !!u));
  for (const p of people) {
    if (!p.userId) continue;
    const photo = accounts.find((a) => a.userId === p.userId)?.photo;
    if (https(photo)) out[p.id] = photo;
  }
  const free = people.filter((p) => !p.userId);
  const open = accounts.filter((a) => !a.userId || !linked.has(a.userId));
  const withPhoto = open.filter((a) => https(a.photo));
  for (const p of free) {
    const found = withPhoto.filter((a) => sameName(p.name, a.name));
    if (found.length !== 1) continue;
    const rivals = free.filter((q) => sameName(q.name, found[0].name));
    if (rivals.length !== 1) continue;
    // Uma conta sem foto com o mesmo nome também deixa em dúvida.
    if (open.filter((a) => sameName(p.name, a.name)).length !== 1) continue;
    out[p.id] = found[0].photo!;
  }
  return out;
}

/**
 * Nome de quem entra pelo convite como pessoa nova: o primeiro nome da conta ("Rebeca"); se já
 * tem alguém com esse nome, com a inicial do sobrenome ("Rebeca O."); se ainda assim repete, o
 * nome inteiro. Assim duas Rebecas diferentes não ficam com o mesmo nome na tela.
 */
export function newcomerName(taken: string[], account: string, max = 24): string {
  const words = account.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return 'Convidado';
  const used = new Set(taken.map(normalName));
  const first = words[0];
  const options = [first, ...(words.length > 1 ? [`${first} ${words[words.length - 1].charAt(0).toUpperCase()}.`] : []), words.join(' ')];
  const pick = options.find((o) => !used.has(normalName(o.slice(0, max)))) ?? options[options.length - 1];
  return pick.slice(0, max).trim();
}

/** Quem da lista tem o mesmo nome da conta (sugestão em "Quem é você?"; nunca liga sozinho). */
export function sameNameIds(people: { id: string; name: string }[], account: string): string[] {
  return people.filter((p) => sameName(p.name, account)).map((p) => p.id);
}
