import { describe, expect, it } from 'vitest';
import { facesByName } from './faces';

const R = 'https://foto/r.jpg';
const M = 'https://foto/m.jpg';

describe('foto de cada pessoa pelas contas do grupo', () => {
  it('liga pelo primeiro nome ou pelo nome inteiro, sem ligar para acento e maiúscula', () => {
    const people = [{ id: 'a', name: 'rebéca' }, { id: 'b', name: 'Mauricio Lima' }, { id: 'c', name: 'Natacha' }];
    expect(facesByName(people, [{ name: 'Rebeca Oliveira', photo: R }, { name: 'Maurício Lima', photo: M }])).toEqual({ a: R, b: M });
  });

  it('na dúvida, ninguém ganha foto', () => {
    // Duas Anas na mesa.
    expect(facesByName([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ana' }], [{ name: 'Ana Souza', photo: R }])).toEqual({});
    // Duas contas Ana.
    expect(facesByName([{ id: 'a', name: 'Ana' }], [{ name: 'Ana Souza', photo: R }, { name: 'Ana Lima', photo: M }])).toEqual({});
    // Uma das contas Ana não tem foto: ainda assim é dúvida.
    expect(facesByName([{ id: 'a', name: 'Ana' }], [{ name: 'Ana Souza', photo: R }, { name: 'Ana Lima', photo: null }])).toEqual({});
  });

  it('não confunde sobrenome nem nome parecido, e só aceita endereço https', () => {
    expect(facesByName([{ id: 'a', name: 'Oliveira' }, { id: 'b', name: 'Rebe' }], [{ name: 'Rebeca Oliveira', photo: R }])).toEqual({});
    expect(facesByName([{ id: 'a', name: 'Rebeca' }], [{ name: 'Rebeca', photo: 'javascript:alert(1)' }])).toEqual({});
  });
});
