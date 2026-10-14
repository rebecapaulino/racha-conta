// Iniciais de quem está no grupo (como as bolinhas de quem está na planilha do Excel).

const clean = (name: string) => name.trim().replace(/\s+/g, ' ');
const cap = (s: string) => s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1).toLocaleLowerCase('pt-BR');

/**
 * Uma letra por pessoa ("M"). Se duas começam com a mesma letra, as duas primeiras do nome
 * ("Ma", "Mo"). Se ainda assim empatam (nomes iguais), primeira letra do nome e do sobrenome
 * ("MS", "MA"); sem sobrenome, fica como deu.
 */
export function memberInitials(names: string[]): string[] {
  const parts = names.map((n) => clean(n).split(' ').filter(Boolean));
  const first = (p: string[]) => (p[0] ?? '?');
  const one = parts.map((p) => first(p).charAt(0).toLocaleUpperCase('pt-BR'));
  const two = parts.map((p) => cap(first(p).slice(0, 2)));
  const full = parts.map((p) => (p.length > 1 ? (p[0].charAt(0) + p[p.length - 1].charAt(0)).toLocaleUpperCase('pt-BR') : cap(first(p).slice(0, 2))));
  const count = (list: string[], v: string) => list.filter((x) => x.toLocaleLowerCase('pt-BR') === v.toLocaleLowerCase('pt-BR')).length;
  return parts.map((_, i) => {
    if (count(one, one[i]) === 1) return one[i];
    if (count(two, two[i]) === 1) return two[i];
    return full[i];
  });
}
