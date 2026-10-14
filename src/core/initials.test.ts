import { describe, expect, it } from 'vitest';
import { memberInitials } from './initials';

describe('iniciais de quem está no grupo', () => {
  it('uma letra; duas quando começam igual; nome e sobrenome quando o nome é igual', () => {
    expect(memberInitials(['Rebeca', 'Natacha'])).toEqual(['R', 'N']);
    expect(memberInitials(['Mauricio', 'Monique', 'Rebeca'])).toEqual(['Ma', 'Mo', 'R']);
    expect(memberInitials(['Ana Souza', 'Ana Lima', 'Bia'])).toEqual(['AS', 'AL', 'B']);
    expect(memberInitials(['  rebeca  oliveira ', 'robin'])).toEqual(['Re', 'Ro']);
  });
});
