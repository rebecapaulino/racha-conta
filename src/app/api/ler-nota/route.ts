// Lê a foto da nota com o Claude (bem mais preciso que o leitor do celular em nota amassada,
// torta ou escrita à mão). Sem a chave ANTHROPIC_API_KEY, responde 503 e o app usa o leitor
// do celular. A foto não fica guardada: vai para a leitura e é descartada.

import Anthropic from '@anthropic-ai/sdk';
import { cleanReceipt, type ParsedReceipt } from '../../../receipt/parse';
import { fromThisSite, json } from '../same-site';

export const maxDuration = 60;

/** A Vercel aceita até 4,5 MB por pedido; o app manda a foto reduzida (bem menos que isso). */
const MAX_BYTES = 4_000_000;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const PROMPT = `Esta é a foto de uma nota, cupom fiscal (NFC-e/SAT) ou conta de bar/restaurante brasileira.
Liste cada item consumido como está na nota, para dividir a conta entre amigos.

- name: o nome do item, legível, em português, só com a primeira letra maiúscula (ex.: "Chopp brahma 300ml"). Desfaça abreviações óbvias ("CERV" → "Cerveja", "PORC" → "Porção"), sem inventar.
- qty: quantidade inteira. Item vendido por peso (kg, g) ou com quantidade fracionada: qty 1 e o valor total da linha.
- unit_cents: preço de UMA unidade, em centavos (R$ 12,90 → 1290). Confira que unit_cents × qty dá o total da linha.
- Fora da lista de itens: taxa de serviço/gorjeta (vai em service_cents e service_pct), descontos, acréscimos, couvert só se aparecer como item, totais, pagamento, troco, impostos, CPF/CNPJ, dados da loja e itens cancelados.
- subtotal_cents: o total dos itens impresso na nota (antes do serviço), se houver. total_cents: o valor final a pagar, se houver.
- Se não der para ler um valor com certeza, use o que está mais legível; não chute itens que não aparecem.
- Se a foto não for uma nota, devolva items vazio.`;

const nullableInt = { anyOf: [{ type: 'integer' }, { type: 'null' }] };
const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, qty: { type: 'integer' }, unit_cents: { type: 'integer' } },
        required: ['name', 'qty', 'unit_cents'],
        additionalProperties: false,
      },
    },
    service_pct: nullableInt,
    service_cents: nullableInt,
    subtotal_cents: nullableInt,
    total_cents: nullableInt,
  },
  required: ['items', 'service_pct', 'service_cents', 'subtotal_cents', 'total_cents'],
  additionalProperties: false,
};

interface Answer {
  items: { name: string; qty: number; unit_cents: number }[];
  service_pct: number | null;
  service_cents: number | null;
  subtotal_cents: number | null;
  total_cents: number | null;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'sem-ia' }, 503);
  if (!fromThisSite(request)) return json({ error: 'origem' }, 403);
  const type = request.headers.get('content-type')?.split(';')[0].trim() as (typeof TYPES)[number];
  if (!TYPES.includes(type)) return json({ error: 'tipo' }, 415);
  const image = Buffer.from(await request.arrayBuffer());
  if (image.length === 0 || image.length > MAX_BYTES) return json({ error: 'tamanho' }, 413);

  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Tarefa de transcrição: pouco raciocínio basta e a resposta sai mais rápido.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: type, data: image.toString('base64') } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });
    if (response.stop_reason !== 'end_turn') return json({ error: 'ia' }, 502);
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json({ error: 'ia' }, 502);
    const a = JSON.parse(text.text) as Answer;
    const parsed: ParsedReceipt = cleanReceipt({
      items: a.items.map((i) => ({ name: i.name, qty: i.qty, cents: i.unit_cents })),
      servicePct: a.service_pct,
      serviceCents: a.service_cents,
      subtotalCents: a.subtotal_cents,
      totalCents: a.total_cents,
    });
    return json(parsed);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'ocupado' }, 429);
    if (error instanceof Anthropic.APIError) return json({ error: 'ia' }, 502);
    return json({ error: 'ia' }, 500);
  }
}
