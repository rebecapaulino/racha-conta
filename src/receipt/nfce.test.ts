import { describe, expect, it } from 'vitest';
import { nfceUrl, parseNfcePage } from './nfce';

const KEY = '35241012345678000190650010000123451000123456';

/** Uma linha da tabela de itens, como a consulta pública da NFC-e mostra. */
const row = (n: number, name: string, qty: string, un: string, unit: string, total: string) => `
  <tr id="Item + ${n}">
    <td valign="top"><span class="txtTit">${name}</span><span class="RCod">(Código: 00${n} )</span><br />
      <span class="Rqtd"><strong>Qtde.:</strong>${qty}</span><span class="RUN"><strong>UN: </strong>${un}</span>
      <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;${unit}</span></td>
    <td align="right" valign="top" class="txtTit noWrap">Vl. Total<br /><span class="valor">${total}</span></td>
  </tr>`;

const page = (rows: string, totals: string) => `<html><body><div id="ConteudoPrincipal">
  <table id="tabResult" cellspacing="0" cellpadding="0">${rows}</table>
  <div id="totalNota">${totals}</div></div></body></html>`;

const total = (label: string, value: string, extra = '') =>
  `<div id="linhaTotal"${extra}><label>${label}</label><span class="totalNumb">${value}</span></div>`;

describe('QR code da NFC-e', () => {
  it('aceita o endereço da Sefaz com a chave', () => {
    const url = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|2|1|1|ABCDEF`;
    expect(nfceUrl(url)).toBe(new URL(url).toString());
  });

  it('recusa QR code que não é de nota, site fora do governo ou sem https', () => {
    expect(nfceUrl('https://cardapio.exemplo.com.br/mesa/12')).toBeNull();
    expect(nfceUrl(`https://www.nfce.fazenda.sp.gov.br.mal.com/qrcode?p=${KEY}`)).toBeNull();
    expect(nfceUrl(`http://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}`)).toBeNull();
    expect(nfceUrl(`https://www.nfce.fazenda.sp.gov.br:8443/qrcode?p=${KEY}`)).toBeNull();
    expect(nfceUrl('https://www.nfce.fazenda.sp.gov.br/qrcode?p=123')).toBeNull();
    expect(nfceUrl('texto qualquer')).toBeNull();
  });
});

describe('página da consulta da NFC-e', () => {
  it('lê os itens, as quantidades e os totais', () => {
    const html = page(
      row(1, 'CHOPP BRAHMA 300ML', '3', 'UN', '12,90', '38,70') +
        row(2, 'PORCAO BATATA FRITA', '1', 'UN', '42,00', '42,00') +
        row(3, 'CAIPIRINHA LIMAO &amp; GENGIBRE', '2', 'UN', '24,50', '49,00'),
      total('Qtd. total de itens:', '6') + total('Valor total R$:', '129,70') + total('Valor a pagar R$:', '129,70', ' class="linhaShade"'),
    );
    expect(parseNfcePage(html)).toEqual({
      items: [
        { name: 'Chopp brahma 300ml', qty: 3, cents: 1290 },
        { name: 'Porcao batata frita', qty: 1, cents: 4200 },
        { name: 'Caipirinha limao & gengibre', qty: 2, cents: 2450 },
      ],
      servicePct: null,
      serviceCents: null,
      subtotalCents: 12970,
      totalCents: 12970,
    });
  });

  it('item por peso vira 1 unidade com o valor total', () => {
    const html = page(row(1, 'PICANHA KG', '0,452', 'KG', '119,90', '54,19'), total('Valor total R$:', '54,19'));
    expect(parseNfcePage(html)!.items).toEqual([{ name: 'Picanha kg', qty: 1, cents: 5419 }]);
  });

  it('taxa de serviço lançada como item vira o serviço da nota', () => {
    const html = page(
      row(1, 'PIZZA CALABRESA', '1', 'UN', '80,00', '80,00') + row(2, 'TAXA DE SERVICO', '1', 'UN', '8,00', '8,00'),
      total('Valor total R$:', '88,00') + total('Valor a pagar R$:', '88,00'),
    );
    const r = parseNfcePage(html)!;
    expect(r.items).toEqual([{ name: 'Pizza calabresa', qty: 1, cents: 8000 }]);
    expect(r).toMatchObject({ serviceCents: 800, servicePct: 10, subtotalCents: 8000, totalCents: 8800 });
  });

  it('valor unitário arredondado: guarda o que fecha com o total', () => {
    const html = page(row(1, 'AGUA', '3', 'UN', '3,33', '10,00'), '');
    expect(parseNfcePage(html)!.items).toEqual([{ name: 'Agua', qty: 1, cents: 1000 }]);
  });

  it('página de erro (sem a tabela de itens) não vira nota', () => {
    expect(parseNfcePage('<html><span id="spnErroMaster">QR Code inválido</span></html>')).toBeNull();
    expect(parseNfcePage(page('', ''))).toBeNull();
  });
});
