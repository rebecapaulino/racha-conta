import { describe, expect, it } from 'vitest';
import { computeSplit, itemTotal, payments, removePerson, summaryText, whatsappUrl, type Bill, type Person } from './bill';
import { formatBRL, parseBRL } from './money';

const people = (...names: string[]): Person[] =>
  names.map((name, i) => ({ id: name.toLowerCase(), name, color: i }));

const bill = (over: Partial<Bill> = {}): Bill => ({
  title: '',
  servicePct: 0,
  payerId: null,
  people: people('Ana', 'Bruno', 'Carla'),
  items: [],
  ...over,
});

const totals = (b: Bill) => computeSplit(b).shares.map((s) => s.total);

describe('divisão de itens', () => {
  it('R$ 10,00 entre 3 pessoas: 3,34 + 3,33 + 3,33', () => {
    const b = bill({ items: [{ id: 'i', name: 'Pizza', cents: 1000, who: ['ana', 'bruno', 'carla'] }] });
    const r = computeSplit(b);
    expect(totals(b)).toEqual([334, 333, 333]);
    expect(r.total).toBe(1000);
  });

  it('o centavo extra gira entre as pessoas conforme o item', () => {
    const all = ['ana', 'bruno', 'carla'];
    const b = bill({
      items: [
        { id: '1', name: 'A', cents: 100, who: all },
        { id: '2', name: 'B', cents: 100, who: all },
        { id: '3', name: 'C', cents: 100, who: all },
      ],
    });
    // Cada pessoa leva o centavo extra uma vez.
    expect(totals(b)).toEqual([100, 100, 100]);
  });

  it('usa a ordem da mesa, não a ordem em que foram marcados', () => {
    const a = bill({ items: [{ id: 'i', name: 'X', cents: 1000, who: ['carla', 'ana', 'bruno'] }] });
    expect(totals(a)).toEqual([334, 333, 333]);
  });

  it('item só de uma pessoa vai inteiro para ela', () => {
    const b = bill({ items: [{ id: 'i', name: 'Pudim', cents: 2100, who: ['bruno'] }] });
    expect(totals(b)).toEqual([0, 2100, 0]);
  });
});

describe('serviço do garçom', () => {
  it('arredonda o serviço total e divide proporcional ao consumo', () => {
    // Subtotal 10,05 → 10% = 1,005 → R$ 1,01 (meio para cima)
    const b = bill({
      servicePct: 10,
      items: [
        { id: '1', name: 'A', cents: 335, who: ['ana'] },
        { id: '2', name: 'B', cents: 335, who: ['bruno'] },
        { id: '3', name: 'C', cents: 335, who: ['carla'] },
      ],
    });
    const r = computeSplit(b);
    expect(r.subtotal).toBe(1005);
    expect(r.service).toBe(101);
    expect(r.shares.map((s) => s.service)).toEqual([34, 34, 33]);
    expect(r.total).toBe(1106);
  });

  it('quem consumiu mais paga mais serviço', () => {
    const b = bill({
      servicePct: 10,
      items: [
        { id: '1', name: 'Picanha', cents: 9000, who: ['ana'] },
        { id: '2', name: 'Água', cents: 1000, who: ['bruno'] },
      ],
    });
    const r = computeSplit(b);
    expect(r.shares.map((s) => s.service)).toEqual([900, 100, 0]);
  });

  it('12% sobre valor quebrado ainda fecha ao centavo', () => {
    const b = bill({ servicePct: 12, items: [{ id: 'i', name: 'X', cents: 1001, who: ['ana', 'bruno', 'carla'] }] });
    const r = computeSplit(b);
    expect(r.service).toBe(120);
    expect(r.shares.reduce((a, s) => a + s.service, 0)).toBe(120);
    expect(r.shares.reduce((a, s) => a + s.total, 0)).toBe(1121);
  });

  it('sem serviço, ninguém paga serviço', () => {
    const b = bill({ servicePct: 0, items: [{ id: 'i', name: 'X', cents: 999, who: ['ana'] }] });
    expect(computeSplit(b).service).toBe(0);
  });
});

describe('item sem ninguém marcado', () => {
  it('fica fora da divisão e é informado', () => {
    const b = bill({
      servicePct: 10,
      items: [
        { id: '1', name: 'Chopp', cents: 1000, who: ['ana'] },
        { id: '2', name: 'Esquecido', cents: 4550, who: [] },
      ],
    });
    const r = computeSplit(b);
    expect(r.subtotal).toBe(1000);
    expect(r.service).toBe(100);
    expect(r.unassigned).toBe(4550);
    expect(r.unassignedItems.map((i) => i.name)).toEqual(['Esquecido']);
    expect(r.total).toBe(1100);
  });

  it('conta sem pessoas não quebra', () => {
    const b = bill({ people: [], servicePct: 10, items: [{ id: '1', name: 'X', cents: 500, who: [] }] });
    const r = computeSplit(b);
    expect(r.shares).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.unassigned).toBe(500);
  });
});

describe('remover pessoa', () => {
  it('tira a pessoa dos itens e redivide entre quem ficou', () => {
    let b = bill({ items: [{ id: 'i', name: 'X', cents: 900, who: ['ana', 'bruno', 'carla'] }] });
    b = removePerson(b, 'bruno');
    expect(b.people.map((p) => p.id)).toEqual(['ana', 'carla']);
    expect(b.items[0].who).toEqual(['ana', 'carla']);
    expect(totals(b)).toEqual([450, 450]);
  });

  it('limpa o pagador se era ela', () => {
    const b = removePerson(bill({ payerId: 'bruno' }), 'bruno');
    expect(b.payerId).toBeNull();
  });

  it('mantém o pagador se era outra pessoa', () => {
    const b = removePerson(bill({ payerId: 'ana' }), 'bruno');
    expect(b.payerId).toBe('ana');
  });

  it('item que era só da pessoa removida fica sem ninguém', () => {
    const b = removePerson(bill({ items: [{ id: 'i', name: 'X', cents: 700, who: ['bruno'] }] }), 'bruno');
    expect(computeSplit(b).unassigned).toBe(700);
  });
});

describe('garantia: a soma sempre bate', () => {
  // Gerador pseudoaleatório fixo para o teste ser reproduzível.
  let seed = 42;
  const rnd = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };

  it('2.000 contas aleatórias fecham ao centavo', () => {
    for (let run = 0; run < 2000; run++) {
      const ps = people(...Array.from({ length: 1 + rnd(8) }, (_, i) => 'P' + i));
      const items = Array.from({ length: rnd(12) }, (_, i) => ({
        id: 'i' + i,
        name: 'Item',
        cents: 1 + rnd(50000),
        who: ps.filter(() => rnd(3) > 0).map((p) => p.id),
      }));
      const pct = ([0, 10, 12, 15] as const)[rnd(4)];
      const r = computeSplit({ title: '', servicePct: pct, payerId: null, people: ps, items });

      const sumTotals = r.shares.reduce((a, s) => a + s.total, 0);
      const sumService = r.shares.reduce((a, s) => a + s.service, 0);
      expect(sumTotals).toBe(r.subtotal + r.service);
      expect(sumService).toBe(r.service);
      expect(r.subtotal + r.unassigned).toBe(items.reduce((a, i) => a + i.cents, 0));
      r.shares.forEach((s) => {
        expect(Number.isInteger(s.total)).toBe(true);
        expect(s.service).toBeGreaterThanOrEqual(0);
      });
    }
  });
});

describe('valores digitados', () => {
  it.each([
    ['12,50', 1250],
    ['12.50', 1250],
    ['1.250,50', 125050],
    ['1250', 125000],
    ['1.250', 125000],
    ['8,9', 890],
    ['R$ 42,00', 4200],
    [',99', 99],
    ['0,01', 1],
  ])('"%s" vira %i centavos', (input, cents) => {
    expect(parseBRL(input)).toBe(cents);
  });

  it.each(['', 'abc', '0', '0,00', '1,2,3', '12,345', '1.25.0'])('"%s" é recusado', (input) => {
    expect(parseBRL(input)).toBeNull();
  });

  it('formata em reais', () => {
    expect(formatBRL(26798)).toBe('R$ 267,98');
    expect(formatBRL(125050)).toBe('R$ 1.250,50');
  });
});

describe('resumo para WhatsApp', () => {
  const base = bill({
    title: 'Sexta no Bar do Zé',
    servicePct: 10,
    items: [{ id: 'i', name: 'X', cents: 3000, who: ['ana', 'bruno', 'carla'] }],
  });

  it('sem pagador', () => {
    expect(summaryText(base)).toBe(
      '*Racha Conta* - Sexta no Bar do Zé\n' +
        'Total: R$ 33,00 (com 10% de serviço)\n\n' +
        '- Ana: R$ 11,00\n- Bruno: R$ 11,00\n- Carla: R$ 11,00',
    );
  });

  it('com pagador, que não aparece entre os devedores', () => {
    expect(summaryText({ ...base, payerId: 'bruno' })).toBe(
      '*Racha Conta* - Sexta no Bar do Zé\n' +
        'Total: R$ 33,00 (com 10% de serviço)\n\n' +
        '- Ana deve R$ 11,00\n- Carla deve R$ 11,00\n\n' +
        'Pagar para *Bruno*, que pagou a conta.',
    );
  });

  it('sem título e sem serviço', () => {
    expect(summaryText({ ...base, title: '  ', servicePct: 0 }).split('\n').slice(0, 2)).toEqual([
      '*Racha Conta*',
      'Total: R$ 30,00',
    ]);
  });

  it('link do WhatsApp codifica o texto', () => {
    expect(whatsappUrl('a b\n*c*')).toBe('https://wa.me/?text=a%20b%0A*c*');
  });
});

describe('quantidade', () => {
  it('valor da linha é unidade × quantidade; sem quantidade vale 1', () => {
    expect(itemTotal({ id: 'i', name: 'Chopp', cents: 1450, qty: 3, who: [] })).toBe(4350);
    expect(itemTotal({ id: 'i', name: 'Chopp', cents: 1450, who: [] })).toBe(1450);
  });

  it('3 chopps de 14,50 entre 2 pessoas = 43,50 dividido', () => {
    const b = bill({ servicePct: 0, items: [{ id: 'i', name: 'Chopp', cents: 1450, qty: 3, who: ['ana', 'bruno'] }] });
    const r = computeSplit(b);
    expect(r.subtotal).toBe(4350);
    expect(r.shares.map((s) => s.total)).toEqual([2175, 2175, 0]);
  });

  it('item com quantidade e ninguém marcado fica fora pelo valor total', () => {
    const b = bill({ items: [{ id: 'i', name: 'Água', cents: 500, qty: 4, who: [] }] });
    expect(computeSplit(b).unassigned).toBe(2000);
  });
});

describe('por que alguém gastou mais (itens de cada pessoa)', () => {
  it('lista os itens da pessoa com a parte dela, somando exatamente o consumo', () => {
    const b = bill({
      items: [
        { id: '1', name: 'Pizza', cents: 1000, who: ['ana', 'bruno', 'carla'] },
        { id: '2', name: 'Vinho', cents: 6000, qty: 2, who: ['ana'] },
        { id: '3', name: 'Água', cents: 500, who: ['bruno'] },
      ],
    });
    const [ana, bruno, carla] = computeSplit(b).shares;
    expect(ana.parts.map((p) => [p.item.name, p.cents, p.splitBy])).toEqual([
      ['Pizza', 334, 3],
      ['Vinho', 12000, 1],
    ]);
    expect(bruno.parts.map((p) => p.item.name)).toEqual(['Pizza', 'Água']);
    expect(carla.parts.map((p) => p.cents)).toEqual([333]);
    for (const s of [ana, bruno, carla]) expect(s.parts.reduce((a, p) => a + p.cents, 0)).toBe(s.consumption);
  });

  it('em contas aleatórias a soma dos itens de cada um sempre bate com o consumo', () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 16807) % 2147483647) % n);
    for (let t = 0; t < 300; t++) {
      const ids = ['ana', 'bruno', 'carla'];
      const items = Array.from({ length: 1 + rnd(6) }, (_, i) => ({
        id: String(i), name: 'X', cents: 1 + rnd(9000), qty: 1 + rnd(3),
        who: ids.filter(() => rnd(2) === 1),
      }));
      for (const s of computeSplit(bill({ items })).shares) {
        expect(s.parts.reduce((a, p) => a + p.cents, 0)).toBe(s.consumption);
      }
    }
  });
});

describe('quem já pagou', () => {
  // 3 pessoas, R$ 30 + 10% = R$ 11 cada
  const base = bill({ servicePct: 10, items: [{ id: 'i', name: 'X', cents: 3000, who: ['ana', 'bruno', 'carla'] }] });

  it('ninguém marcado: tudo em aberto, falta o total', () => {
    const p = payments(base);
    expect(p.rows.map((r) => r.state)).toEqual(['open', 'open', 'open']);
    expect(p.paidCount).toBe(0);
    expect(p.remaining).toBe(3300);
  });

  it('quem pagou no caixa já está quite; o resto é o que falta receber', () => {
    const p = payments({ ...base, payerId: 'bruno', paid: { ana: 1100 } });
    expect(p.rows.map((r) => r.state)).toEqual(['paid', 'payer', 'open']);
    expect(p.paidCount).toBe(2);
    expect(p.remaining).toBe(1100);
  });

  it('se a conta subir depois do pagamento, mostra quanto falta; se cair, o que pagou a mais', () => {
    const p = payments({ ...base, paid: { ana: 800, bruno: 1500 } });
    expect(p.rows[0]).toMatchObject({ state: 'partial', owed: 300 });
    expect(p.rows[1]).toMatchObject({ state: 'over', owed: -400 });
    expect(p.remaining).toBe(300 + 1100);
  });

  it('tirar a pessoa da mesa apaga o pagamento dela', () => {
    expect(removePerson({ ...base, paid: { ana: 1100 } }, 'ana').paid).toEqual({});
  });

  it('resumo do WhatsApp marca quem pagou e diz quanto falta', () => {
    expect(summaryText({ ...base, title: 'Bar', payerId: 'bruno', paid: { ana: 1100 } })).toBe(
      '*Racha Conta* - Bar\n' +
        'Total: R$ 33,00 (com 10% de serviço)\n\n' +
        '- Ana: R$ 11,00 ✅ pago\n- Carla deve R$ 11,00\n\n' +
        'Pagar para *Bruno*, que pagou a conta.\n\n' +
        'Falta receber: R$ 11,00',
    );
    expect(summaryText({ ...base, paid: { ana: 1100, bruno: 1100, carla: 1100 } }).endsWith('Tudo pago ✅')).toBe(true);
    expect(summaryText({ ...base, paid: { ana: 1500 } })).toContain('- Ana: R$ 11,00 ✅ pago (pagou R$ 4,00 a mais, receber de volta)');
  });
});
