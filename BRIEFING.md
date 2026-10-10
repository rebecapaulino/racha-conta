# Racha Conta — briefing final para o Claude Code

> Decisões tomadas depois deste briefing (visual Marple, regras da exceção, Next 16 etc.) estão em `DECISOES.md`, que tem prioridade.

---

## 1. Contexto de negócio

**Nome do produto:** Racha Conta

**Problema:** em toda saída em grupo (restaurante, bar, churrasco, viagem), alguém vira o "responsável pela conta" e perde tempo calculando quem pediu o quê. Quase sempre alguém sai no prejuízo ou fica constrangido de cobrar.

**Solução:** um site que funciona no celular. Você adiciona as pessoas, lança os itens da comanda, marca quem consumiu cada um, e o site calcula quanto cada pessoa paga, já com o serviço do garçom. No final, gera um resumo pronto para mandar no grupo do WhatsApp.

**Por que cresce sozinho:** o resumo vai para o WhatsApp do grupo, e cada conta dividida mostra o produto para 5 ou 10 pessoas. No modo compartilhado, cada pessoa que entra pelo link também conhece o produto.

**Público:** grupos de amigos e famílias no Brasil. Uso quase sempre no celular, na mesa, com pressa.

**Possível receita no futuro (não implementar agora):** anúncios discretos ou versão premium (histórico, grupos fixos, exportar PDF, Pix).

**Analogia para guiar as decisões:** o produto é a notinha do restaurante, só que já separada por pessoa e sem precisar de calculadora.

---

## 2. Dois jeitos de usar o produto

### Modo solo
Só uma pessoa tem o app. Ela monta a conta sozinha e compartilha o resultado em print ou no resumo do WhatsApp. **Funciona sem servidor e sem internet**, com os dados no próprio aparelho. É a porta de entrada: nenhuma outra pessoa precisa ter o app.

A conta pode ser montada de duas formas:
- **Lançando os itens à mão**, antes ou durante a refeição, para facilitar a divisão no final.
- **Tirando foto da nota fiscal** (quando uma pessoa paga tudo). O app lê a nota, a pessoa revisa rapidamente e o app mostra quanto cada um deve.

**Exceção "consumiu só isso":** na divisão da nota, escolho uma pessoa da lista e informo que ela consumiu só determinados itens. O app desconta esses itens do total e divide o restante entre os outros. A exceção não vira regra à parte: é o mesmo cálculo por item, só que a pessoa fica de fora dos itens que não consumiu.

### Modo compartilhado
O criador da conta é o **dono**. Ele compartilha um link e todos acompanham a conta em tempo real, cada um vendo o que os outros adicionam.

Permissões:
- **Dono:** controla tudo e decide quem pode adicionar ou editar.
- **Editor:** pode adicionar e editar itens e marcações.
- **Só leitura:** apenas acompanha a conta.

Funcionamento:
- **Sem senha e sem cadastro.** A pessoa entra pelo link e digita o nome. O aparelho guarda uma identificação, e o servidor associa "este aparelho é o Bruno".
- O dono vê a lista de quem entrou e liga ou desliga "pode editar" para cada pessoa.
- **As permissões precisam ser impostas no banco de dados, e não só na tela.** Esconder o botão de editar não basta.
- **As contas expiram sozinhas** depois de alguns dias (sugerir um prazo). O sistema guarda só nomes e valores, nada sensível.
- **Recuperação do dono:** precisa existir uma forma de o dono recuperar a conta se perder o aparelho ou limpar o navegador (ex.: um "link do dono"). Proponha a solução mais simples.

---

## 3. Decisões técnicas já tomadas

- **Formato:** site responsivo instalável como PWA (ícone na tela inicial, tela cheia, funciona offline). Não é app de loja agora. Se der certo, empacotar depois com Capacitor.
- **Framework:** Next.js, usando tela e funções do servidor no mesmo projeto. **Sem backend Node separado por enquanto.** Eu tenho experiência com Angular e menos com React, então explique a estrutura do projeto em linguagem simples, passo a passo.
- **Banco de dados e tempo real:** Supabase (guarda contas, pessoas, itens e permissões, e avisa todos em tempo real). **Firebase não será usado.**
- **Leitura da nota fiscal (OCR):** no celular, sem servidor, com tela de revisão rápida (corrigir um valor, apagar uma linha). Construir a leitura como uma **peça trocável**, para poder migrar para leitura com IA no futuro, caso as pessoas reclamem da revisão. Se um dia usar IA, a chave fica em segredo numa função do Next.
- **Modo solo:** dados no aparelho (localStorage ou IndexedDB), sempre dentro de try/catch, e o app precisa funcionar mesmo se o armazenamento falhar.
- **Idioma e moeda:** português do Brasil, valores em BRL (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
- **Hospedagem:** gratuita e estática ou serverless (Vercel ou similar).
- **Dados organizados desde o início como "conta com pessoas, itens e permissões".** Assim o modo compartilhado entra depois sem refazer a lógica do modo solo.
- **Lógica de cálculo separada da interface**, para ser testada sozinha.

---

## 4. Ordem de construção

**Fase 1: modo solo (sem servidor)**
1. Lógica de cálculo com testes unitários.
2. Interface: nome da conta, pessoas, itens, quem consumiu, serviço, comanda, quem pagou, resumo e WhatsApp.
3. Exceção "consumiu só isso".
4. PWA (manifest, ícones e funcionamento offline).

**Fase 2: modo compartilhado (Supabase)**
1. Conta com link, entrada por nome e tempo real.
2. Permissões de dono, editor e só leitura, impostas no banco.
3. Expiração automática das contas.
4. Recuperação do dono.

**Fase 3: foto da nota fiscal**
1. OCR no celular com tela de revisão rápida.
2. Peça trocável para uma futura leitura com IA.

**Depois (não implementar agora, mas não bloquear):** chave Pix do pagador no resumo, histórico de contas, grupos salvos ("Amigos do futebol", "Família"), divisão desigual (ex.: alguém pagou o couvert de todos), editar item já lançado, gerar imagem da comanda para compartilhar, controle de "quem me deve" entre vários encontros.

---

## 5. Funcionalidades da Fase 1 (versão mínima)

1. **Nome da conta** (campo de título editável, ex.: "Sexta no Bar do Zé") e data do dia.
2. **Quem está na mesa:** adicionar e remover pessoas (nome de até 24 caracteres). Cada pessoa recebe uma cor própria entre 6 cores.
3. **O que foi pedido:** adicionar e remover item (nome e valor). O valor aceita `12,50`, `12.50` e `1.250,50`. Deve ser maior que zero.
4. **Quem consumiu cada item:** cada item mostra os nomes das pessoas como botões liga/desliga. Novo item começa com todos marcados, e existe "Todos / Limpar" por item. Item marcado em várias pessoas é dividido entre elas.
5. **Exceção por pessoa:** escolher alguém e informar os itens que ela consumiu.
6. **Serviço do garçom:** Sem, 10%, 12% e 15%. Padrão: 10%.
7. **Comanda (resultado):** cada pessoa com consumo, serviço e total, mais subtotal, serviço e total geral.
8. **Quem pagou no caixa (opcional):** se escolhido, o resumo diz quem deve quanto para essa pessoa.
9. **Compartilhar:** botão "Copiar resumo" (com fallback para selecionar o texto se a área de transferência falhar) e botão "Abrir no WhatsApp" (`https://wa.me/?text=...`).
10. **Nova conta:** apaga tudo, com confirmação dentro da página (nada de `confirm()` do navegador).
11. **Estado inicial:** abre com uma mesa de exemplo, claramente marcada como exemplo, com botão "Começar do zero".

---

## 6. Regras de negócio (o dinheiro precisa bater)

- **Todo cálculo em centavos inteiros.** Nunca usar float para somar dinheiro.
- **Divisão de um item entre N pessoas:** cada uma paga `floor(valor / N)`. Os centavos que sobram (`valor % N`) são distribuídos 1 centavo por pessoa, **rotacionando o ponto de partida conforme o índice do item**, para que a mesma pessoa não leve sempre o centavo extra.
- **Serviço:** `serviço total = round(subtotal × percentual / 100)`. É dividido **proporcionalmente ao consumo de cada pessoa**, usando o método do maior resto, para que a soma dos serviços individuais seja exatamente o serviço total.
- **Garantia:** a soma dos totais individuais é sempre igual a subtotal + serviço, ao centavo.
- **Item sem ninguém marcado** não entra na divisão e gera um aviso visível, com o valor que ficou de fora.
- **Remover uma pessoa** remove essa pessoa de todos os itens e, se ela era quem pagou, limpa o pagador.
- Escrever testes unitários para a função de cálculo, incluindo: valor que não divide exato (ex.: R$ 10,00 entre 3), serviço com arredondamento, item sem ninguém, pessoa removida e pessoa com exceção.

### Formato do resumo para WhatsApp

Sem pagador definido:

```
*Racha Conta* - Sexta no Bar do Zé
Total: R$ 267,98 (com 10% de serviço)

- Ana: R$ 70,12
- Bruno: R$ 78,40
- Carla: R$ 56,38
- Diego: R$ 63,08
```

Com pagador definido (o pagador não aparece na lista de devedores):

```
*Racha Conta* - Sexta no Bar do Zé
Total: R$ 267,98 (com 10% de serviço)

- Ana deve R$ 70,12
- Carla deve R$ 56,38
- Diego deve R$ 63,08

Pagar para *Bruno*, que pagou a conta.
```

(Os valores acima são só ilustrativos do formato.)

---

## 7. Identidade visual (histórico — ver `DECISOES.md`)

O visual em vigor é a paleta Marple aplicada a partir dos prints. Desta seção continuam valendo: o nome **Racha Conta**, o desenho do ícone, a tipografia, o layout e os requisitos de acessibilidade abaixo.

### Ícone / logo
Uma moeda cortada ao meio: a metade esquerda é cheia e a metade direita é só contorno, com um pequeno espaço entre as duas.

```svg
<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M16 3a13 13 0 0 0 0 26z" fill="#2446E8"/>
  <path d="M18 3a13 13 0 0 1 0 26z" fill="none" stroke="#2446E8" stroke-width="2.5"/>
</svg>
```

- Gerar o ícone do PWA (192 x 192 e 512 x 512, versão maskable) e o favicon a partir deste desenho.

### Tipografia
- **Títulos e nome da marca:** Bricolage Grotesque (600 e 800)
- **Texto:** Figtree (400, 500, 600)
- **Valores e comanda:** IBM Plex Mono (400, 500, 600), com `font-variant-numeric: tabular-nums` em colunas.

### Layout
- **Celular:** coluna única. Barra fixa na base com "Total com serviço" e botão "Ver divisão". Respeitar `env(safe-area-inset-bottom)`.
- **Computador (a partir de 900 px):** duas colunas, comanda fixa (sticky) à direita com 390 px.
- **Comanda:** cara de nota de restaurante, tipografia monoespaçada, linhas tracejadas.
- **Nome da conta** como título grande com linha tracejada embaixo.

### Acessibilidade e qualidade
- Alvos de toque de pelo menos 44 px nos botões principais.
- Foco visível, rótulos em todos os campos, `aria-pressed` nos liga/desliga e `aria-live` nos avisos.
- Respeitar `prefers-reduced-motion` e `prefers-color-scheme`.
- Nada de `alert()`, `confirm()` ou `prompt()`.
- Nenhuma rolagem horizontal em 400 px de largura.

---

## 8. Como trabalhar

1. Entregar em passos pequenos, seguindo a ordem da seção 4.
2. Explicar cada decisão começando pelo motivo de negócio e só depois o detalhe técnico.
3. Não adicionar funcionalidades fora da fase atual sem perguntar.
