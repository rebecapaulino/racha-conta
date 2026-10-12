import { describe, expect, it } from 'vitest';
import { expectedItemsTotal, parseReceipt, sumItems } from './parse';

describe('parseReceipt', () => {
  it('lê a comanda de bar com quantidade, serviço e total', () => {
    const r = parseReceipt(`
      BAR DO ZÉ LTDA
      CNPJ 12.345.678/0001-90
      MESA 12   CONTA 345
      ------------------------------
      QTD DESCRICAO          TOTAL
      2 CAIPIRINHA           44,00
      3 CHOPP 300ML          43,50
      1 PICANHA NA CHAPA    142,00
      1 PORCAO DE FRITAS     36,00
      1 PUDIM                21,00
      ------------------------------
      SUBTOTAL              286,50
      TAXA DE SERVIÇO 10%    28,65
      TOTAL R$              315,15
    `);
    expect(r.items).toEqual([
      { name: 'Caipirinha', qty: 2, cents: 2200 },
      { name: 'Chopp 300ml', qty: 3, cents: 1450 },
      { name: 'Picanha na chapa', qty: 1, cents: 14200 },
      { name: 'Porcao de fritas', qty: 1, cents: 3600 },
      { name: 'Pudim', qty: 1, cents: 2100 },
    ]);
    expect(r.subtotalCents).toBe(28650);
    expect(r.serviceCents).toBe(2865);
    expect(r.servicePct).toBe(10);
    expect(r.totalCents).toBe(31515);
    expect(sumItems(r.items)).toBe(expectedItemsTotal(r));
  });

  it('usa o preço da unidade quando a linha tem unitário e total', () => {
    const r = parseReceipt(`
      2 CAIPIRINHA LIMAO   22,00   44,00
      CHOPP 3 X 14,50 43,50
      001 7891234567890 COCA COLA LATA 350ML 2 UN X 6,50 13,00
    `);
    expect(r.items).toEqual([
      { name: 'Caipirinha limao', qty: 2, cents: 2200 },
      { name: 'Chopp', qty: 3, cents: 1450 },
      { name: 'Coca cola lata 350ml', qty: 2, cents: 650 },
    ]);
  });

  it('item por peso vira uma unidade com o valor da linha', () => {
    const r = parseReceipt('PICANHA 0,452 KG X 89,90 40,63');
    expect(r.items).toEqual([{ name: 'Picanha', qty: 1, cents: 4063 }]);
  });

  it('junta o nome de uma linha com o valor da linha de baixo', () => {
    const r = parseReceipt(`
      003 0000123 AGUA MINERAL COM GAS
      2 UN X 5,00 10,00
    `);
    expect(r.items).toEqual([{ name: 'Agua mineral com gas', qty: 2, cents: 500 }]);
  });

  it('aceita "2UNX" grudado (o OCR junta quantidade e unidade)', () => {
    const r = parseReceipt(`
      002 0000000000123 PARMEGIANA DE FRANGO
      2UNX 68,90 137,80
      003 0000000000456 SUCO NATURAL
      1 UN X 12,50 12,50
    `);
    expect(r.items).toEqual([
      { name: 'Parmegiana de frango', qty: 2, cents: 6890 },
      { name: 'Suco natural', qty: 1, cents: 1250 },
    ]);
  });

  it('corrige letras que o OCR troca por números', () => {
    const r = parseReceipt(`
      1 BATATA FRITA 36,O0
      1 SUCO DE LARANJA l2,50
    `);
    expect(r.items.map((i) => i.cents)).toEqual([3600, 1250]);
  });

  it('aceita pontilhado, R$ e milhar', () => {
    const r = parseReceipt(`
      Rodízio completo ........ R$ 1.250,00
      Caipirinha............22.00
    `);
    expect(r.items).toEqual([
      { name: 'Rodízio completo', qty: 1, cents: 125000 },
      { name: 'Caipirinha', qty: 1, cents: 2200 },
    ]);
  });

  it('ignora pagamento, troco, impostos, valor por pessoa e desconto', () => {
    const r = parseReceipt(`
      1 X-BURGUER 32,00
      DESCONTO 5,00
      VALOR POR PESSOA 13,50
      CARTAO DE CREDITO 27,00
      TROCO 0,00
      TRIBUTOS APROX. LEI 12.741 R$ 4,12
      DATA 10/10/2026 21:45
    `);
    expect(r.items).toEqual([{ name: 'X-burguer', qty: 1, cents: 3200 }]);
    expect(r.totalCents).toBeNull();
  });

  it('descobre o percentual do serviço pelo valor quando a nota não imprime o %', () => {
    const r = parseReceipt(`
      1 PIZZA GRANDE 80,00
      1 REFRIGERANTE 2L 15,00
      SERVIÇO 9,50
      TOTAL 104,50
    `);
    expect(r.servicePct).toBe(10);
    expect(r.serviceCents).toBe(950);
    expect(expectedItemsTotal(r)).toBe(9500);
  });

  it('não confunde tamanho com quantidade nem código com preço', () => {
    const r = parseReceipt(`
      CHOPP 300 14,50
      0123456789012 CERVEJA LONG NECK 12,00
    `);
    expect(r.items).toEqual([
      { name: 'Chopp 300', qty: 1, cents: 1450 },
      { name: 'Cerveja long neck', qty: 1, cents: 1200 },
    ]);
  });

  it('texto sem itens devolve lista vazia, sem quebrar', () => {
    const r = parseReceipt('nada para ler aqui\n\n***');
    expect(r.items).toEqual([]);
    expect(r.servicePct).toBeNull();
    expect(expectedItemsTotal(r)).toBeNull();
  });
});
