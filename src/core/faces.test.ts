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

  it('pessoa ligada à conta usa a foto dessa conta, mesmo com outra pessoa de mesmo nome', () => {
    const people = [{ id: 'reb', name: 'Rebeca', userId: 'u-reb' }, { id: 'falsa', name: 'Rebeca' }, { id: 'bia', name: 'Bia', userId: 'u-bia' }];
    const accounts = [
      { userId: 'u-reb', name: 'Rebeca Oliveira', photo: R },
      { userId: 'u-bia', name: 'Beatriz Souza', photo: M },
    ];
    // A "Rebeca" criada à mão não pega a foto da Rebeca de verdade.
    expect(facesByName(people, accounts)).toEqual({ reb: R, bia: M });
  });

  it('conta já ligada a alguém não empresta a foto pelo nome; conta livre ainda liga pelo nome', () => {
    const people = [{ id: 'x', name: 'Beca', userId: 'u-reb' }, { id: 'y', name: 'Rebeca' }, { id: 'm', name: 'Mauricio' }];
    const accounts = [
      { userId: 'u-reb', name: 'Rebeca Oliveira', photo: R },
      { userId: 'u-m', name: 'Mauricio Lima', photo: M },
    ];
    expect(facesByName(people, accounts)).toEqual({ x: R, m: M });
  });

  it('pessoa ligada a uma conta sem foto (ou com endereço estranho) fica com a inicial', () => {
    const people = [{ id: 'a', name: 'Ana', userId: 'u-a' }];
    expect(facesByName(people, [{ userId: 'u-a', name: 'Ana', photo: null }])).toEqual({});
    expect(facesByName(people, [{ userId: 'u-a', name: 'Ana', photo: 'http://x/a.jpg' }])).toEqual({});
  });
});
