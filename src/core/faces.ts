// Foto de cada pessoa da conta (Rolê ou Viagem) a partir das contas do grupo.
// As pessoas são nomes digitados ("Rebeca"); as contas têm o nome do Google ("Rebeca Oliveira").
// Liga pelo nome, e só quando não há dúvida: na dúvida, fica a inicial (nunca a foto errada).

export interface Face {
  name: string;
  photo: string | null;
}

/** "  Rebéca   OLIVEIRA " → "rebeca oliveira" */
export const normalName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** A pessoa e a conta são a mesma? Nome inteiro igual, ou o nome digitado é o primeiro nome da conta. */
function same(person: string, account: string): boolean {
  const p = normalName(person);
  const a = normalName(account);
  if (!p || !a) return false;
  return p === a || (!p.includes(' ') && a.split(' ')[0] === p);
}

/**
 * id da pessoa → foto da conta. Só entra quem combina com exatamente uma conta, e essa conta
 * combina só com essa pessoa (duas "Ana" na mesa, ou duas contas "Ana …": nenhuma ganha foto).
 */
export function facesByName(people: { id: string; name: string }[], accounts: Face[]): Record<string, string> {
  const withPhoto = accounts.filter((a) => a.photo && /^https:\/\//.test(a.photo));
  const out: Record<string, string> = {};
  for (const p of people) {
    const found = withPhoto.filter((a) => same(p.name, a.name));
    if (found.length !== 1) continue;
    const rivals = people.filter((q) => same(q.name, found[0].name));
    if (rivals.length !== 1) continue;
    // Uma conta sem foto com o mesmo nome também deixa em dúvida.
    if (accounts.filter((a) => same(p.name, a.name)).length !== 1) continue;
    out[p.id] = found[0].photo!;
  }
  return out;
}
