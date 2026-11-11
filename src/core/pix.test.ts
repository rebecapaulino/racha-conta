import { describe, expect, it } from 'vitest';
import { crc16, formatPixKey, isPixKey, parsePixKey, pixKeyToCopy, pixKind, pixPayload } from './pix';

describe('chave Pix', () => {
  it('entende CPF, CNPJ, celular, e-mail e chave aleatória, com ou sem pontuação', () => {
    expect(parsePixKey('529.982.247-25')).toEqual({ ok: true, key: { key: '52998224725', kind: 'cpf' } });
    expect(parsePixKey('11.222.333/0001-81')).toEqual({ ok: true, key: { key: '11222333000181', kind: 'cnpj' } });
    expect(parsePixKey('(11) 98888-7777')).toEqual({ ok: true, key: { key: '+5511988887777', kind: 'phone' } });
    expect(parsePixKey('+55 11 98888-7777')).toEqual({ ok: true, key: { key: '+5511988887777', kind: 'phone' } });
    expect(parsePixKey('5511988887777')).toEqual({ ok: true, key: { key: '+5511988887777', kind: 'phone' } });
    expect(parsePixKey(' Rebeca@Gmail.com ')).toEqual({ ok: true, key: { key: 'rebeca@gmail.com', kind: 'email' } });
    expect(parsePixKey('123E4567-E89B-12D3-A456-426614174000')).toEqual({
      ok: true,
      key: { key: '123e4567-e89b-12d3-a456-426614174000', kind: 'random' },
    });
  });

  it('11 números: CPF ou celular; quando pode ser os dois, devolve as duas leituras', () => {
    // CPF válido que não parece celular.
    expect(parsePixKey('52998224725')).toEqual({ ok: true, key: { key: '52998224725', kind: 'cpf' } });
    // Celular que não é CPF válido.
    expect(parsePixKey('11988887777')).toEqual({ ok: true, key: { key: '+5511988887777', kind: 'phone' } });
    // CPF válido que também é um celular (DDD 11, começa com 9).
    expect(parsePixKey('11987654374')).toEqual({
      ok: true,
      key: { key: '11987654374', kind: 'cpf' },
      alt: { key: '+5511987654374', kind: 'phone' },
    });
    // Com a pontuação, não tem dúvida.
    expect(parsePixKey('119.876.543-74')).toEqual({ ok: true, key: { key: '11987654374', kind: 'cpf' } });
    expect(parsePixKey('(11) 98765-4374')).toEqual({ ok: true, key: { key: '+5511987654374', kind: 'phone' } });
  });

  it('recusa o que não é chave', () => {
    expect(parsePixKey('').ok).toBe(false);
    expect(parsePixKey('rebeca').ok).toBe(false);
    expect(parsePixKey('123.456.789-00').ok).toBe(false);
    expect(parsePixKey('11.222.333/0001-00').ok).toBe(false);
    expect(parsePixKey('12345').ok).toBe(false);
    expect(parsePixKey('+1 415 555 0100').ok).toBe(false);
    expect(parsePixKey('a@b').ok).toBe(false);
  });

  it('guarda num formato só, do qual sai o tipo, a chave de ler e a de colar', () => {
    expect(pixKind('+5511988887777')).toBe('phone');
    expect(pixKind('52998224725')).toBe('cpf');
    expect(pixKind('11222333000181')).toBe('cnpj');
    expect(pixKind('ana@x.com')).toBe('email');
    expect(formatPixKey('+5511988887777')).toBe('(11) 98888-7777');
    expect(formatPixKey('+551133334444')).toBe('(11) 3333-4444');
    expect(formatPixKey('52998224725')).toBe('529.982.247-25');
    expect(formatPixKey('11222333000181')).toBe('11.222.333/0001-81');
    expect(pixKeyToCopy('+5511988887777')).toBe('11988887777');
    expect(pixKeyToCopy('52998224725')).toBe('52998224725');
    expect(isPixKey('+5511988887777')).toBe(true);
    expect(isPixKey('52998224725')).toBe(true);
    expect(isPixKey('(11) 98888-7777')).toBe(false);
    expect(isPixKey(42)).toBe(false);
  });
});

describe('Pix copia e cola', () => {
  it('CRC igual ao do exemplo do manual do Banco Central', () => {
    const body =
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(body)).toBe('1D3D');
  });

  it('monta o código com a chave, o nome sem acento e o valor', () => {
    const code = pixPayload({ key: '+5511988887777', name: 'Conceição', cents: 12345 });
    const body =
      '000201' +
      '26360014br.gov.bcb.pix0114+5511988887777' +
      '52040000' +
      '5303986' +
      '5406123.45' +
      '5802BR' +
      '5909Conceicao' +
      '6006BRASIL' +
      '62070503***' +
      '6304';
    expect(code).toBe(body + crc16(body));
  });

  it('sem valor, não leva o campo do valor; nome grande é cortado em 25', () => {
    const code = pixPayload({ key: 'ana@x.com', name: 'Ana Maria da Silva Albuquerque Neto' });
    expect(code).not.toContain('5406');
    expect(code).toContain('5925Ana Maria da Silva Albuqu');
  });
});
