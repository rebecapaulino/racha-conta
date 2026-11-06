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

describe('NFC-e em duas linhas (texto real do leitor, com sujeira)', () => {
  // Foto de um cupom real: "nº código - nome" e, embaixo, "qtd x unitário ... total".
  const TEXT = `NFC-e Nº 178624 Série 886
Emissão: 06/11/2026 13:59:15
EMITIDA EM CONTINGÊNCIA Pendente de autorização
1 211 - SOPA CON CARNE
3 XR$ 12,50... o... R$ 37.50
2 245 - BRIGADEIRO                                          y
;          1 XR$S6.00......,.. 0... R$ 6.00                     |
 3 451 - SANDUÍCHE DE FRANGO
E      IO XR$14,00.. 1.1.0.0. R$ 14,00        |
Á  4 684 - SUCO POLPA 300 HI                               |
3          | XRS 7,00... R$ 7,00
E  5 001 - AGUA COM GAS 300 À 310 nj)
|      tOXR$3.50 1.0... RS 3.50          |
Total Produtos:?                        |
Valor Total: R$ 68,00                 '         |
Forna Pasto: 11 - Voucher Refeição
Valor Pago: R$ 68,00
ó Este R512,24 Trio.!`;

  it('nome do cabeçalho, quantidade e total, e nada depois do total', () => {
    const r = parseReceipt(TEXT);
    expect(r.items.map((i) => [i.name, i.qty, i.cents])).toEqual([
      ['Sopa con carne', 3, 1250],
      ['Brigadeiro', 1, 600],
      ['Sanduíche de frango', 1, 1400],
      ['Suco polpa 300 hi', 1, 700],
      ['Agua com gas 300 à 310 nj)', 1, 350],
    ]);
    expect(r.totalCents).toBe(6800);
    expect(sumItems(r.items)).toBe(6800);
  });

  it('linha de preço ilegível no valor total: usa quantidade × unitário', () => {
    const r = parseReceipt('1 211 - SOPA COM CARNE\n3 x R$ 12,50 ....... lixo\n');
    expect(r.items).toEqual([{ name: 'Sopa com carne', qty: 3, cents: 1250 }]);
  });

  it('unitário borrado: o total da linha ainda dá a quantidade', () => {
    const r = parseReceipt('1 211 - SOPA COM CARNE\n3 XR$ IDO... R$37,50\n');
    expect(r.items).toEqual([{ name: 'Sopa com carne', qty: 3, cents: 1250 }]);
  });
});

describe('texto do PaddleOCR', () => {
  it('preço em caixa separada, com "x" diferente e R$ lido como RS', () => {
    const r = parseReceipt(
      '5_001 - AGUA COM GAS 300 A 310 ml\n1 × RS 3.50  RS 3.50\n7 411 - CH0PP BRAHMA 300ml\n2 × R$ 14.90  R$ 29.80\nValor Total: R$ 33.30',
    );
    expect(r.items).toEqual([
      { name: 'Agua com gas 300 a 310 ml', qty: 1, cents: 350 },
      { name: 'Chopp brahma 300ml', qty: 2, cents: 1490 },
    ]);
    expect(r.totalCents).toBe(3330);
  });

  it('quantidade no fim do nome, com ×', () => {
    expect(parseReceipt('003 PUDIM 1 UN × 18,00  18,00').items).toEqual([{ name: 'Pudim', qty: 1, cents: 1800 }]);
  });
});

describe('palavras trocadas pelo leitor (print de um iPhone)', () => {
  const TEXT = `1 211 - SOPA COM CARNE
3 x R$ 12,50 ... R$ 37,50
2 245 BRIGADEIRO
1 x R$ 6,00 ... R$ 6,00
3 451 - SANDUICHE DE FRANGO
1 x R$ 14,00 ... R$ 14,00
À 084 SUCO POLPA 300 ML
1 x R$ 7,00 ... R$ 7,00
5 001 - AGUA COM GAS
1 x R$ 3,50 ... R$ 3,50
Total Produtos:7
Valor tutal: R$ 68,00
Forna Pagto: 11 - Voucher Refeição
Valor paso: R$ 68,00`;

  it('"Valor tutal" e "Valor paso" não viram itens (antes dava R$ 204,00)', () => {
    const r = parseReceipt(TEXT);
    expect(r.items.map((i) => i.name)).toEqual(['Sopa com carne', 'Brigadeiro', 'Sanduiche de frango', 'Suco polpa 300 ml', 'Agua com gas']);
    expect(sumItems(r.items)).toBe(6800);
    expect(r.totalCents).toBe(6800);
  });

  it('linha sem palavra nenhuma legível que vale a soma das anteriores é o total', () => {
    const r = parseReceipt('Sopa 10,00\nBolo 20,00\nCafe 5,00\nXkw 35,00\nZzz 12,24');
    expect(r.items.map((i) => i.name)).toEqual(['Sopa', 'Bolo', 'Cafe']);
    expect(r.totalCents).toBe(3500);
  });

  it('dois itens iguais não são confundidos com total', () => {
    const r = parseReceipt('Sopa 10,00\nBolo 10,00\nCafe 5,00');
    expect(r.items).toHaveLength(3);
  });

  it('palavra parecida num item normal continua item', () => {
    expect(parseReceipt('Agua 4,00\nValentim 12,00').items).toHaveLength(2);
  });
});
