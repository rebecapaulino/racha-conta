# Racha Conta — decisões

Complementa o `BRIEFING.md`. Quando os dois divergirem, vale este arquivo (decisões mais recentes).

## Visual (vale sobre a seção 7 do briefing)

- **Do protótipo HTML fica só o ícone.** Layout, tipografia e acabamento vêm dos prints de referência.
- **Estrutura em etapas:** abas Mesa · Pedidos · Divisão, com botão-pílula grande na base para avançar.
  - Computador (a partir de 1000 px): abas Mesa e Pedidos à esquerda; Divisão sempre visível à direita.
- **Acabamento limpo e suave** (prints 2, 3 e 4): fundo claro neutro, cartões brancos com sombra suave, sem contornos pretos.
- **Paleta Marple:** carmim `#CA2851` nos botões (coral `#FF6766` no tema escuro), pêssego e creme de apoio. Tema escuro grafite com brilho quente.
- **Fonte:** Plus Jakarta Sans, instalada no projeto para funcionar offline.
- **Logo:** moeda partida em carmim (coral no escuro).
- Peças principais:
  - Cartão de destaque carmim com o total, presente em todas as etapas (ref.: "Total bill" do print 4).
  - Mesa: campo "Adicionar pessoa" estilo busca e lista com avatares (ref.: "Choose Friends").
  - Pedidos: cartões de campo cinza e itens com ícone por palavra-chave (🍺, 🍕…) (ref.: "Split The Bill").
  - Quem consumiu: botões com avatar e selo de check na cor da pessoa.
  - Divisão: cartão por pessoa com barra de % do total (ref.: slider do "Split bill"), escolha de quem pagou com avatares e uma nota limpa serrilhada com os totais.

### Dois visuais com chave (09/10/2026)

- **Ativo: "fluent"**, estilo Microsoft atual (Fluent 2) com a marca carmim: cantos de 4–8 px, contornos finos, abas com traço embaixo, campos com linha de marca no foco, barra de base com vidro fosco, fonte do sistema (Segoe UI no Windows). Arquivo: `src/app/visual-fluent.css`.
- **Ilustrações do "fluent":** formas simples sobrepostas em três tons da mesma cor (escuro, médio, claro), com transparência onde se cruzam. Famílias: carmim, coral, pêssego e verde-água (só na salada). Usadas nos itens (no lugar dos emojis), nas abas (cinza quando fechadas), nos estados vazios e no cartão do total. Arquivo: `src/ui/illustrations.tsx`. O visual "suave" continua com emojis.
- **Guardado: "suave"**, o visual descrito acima, em `globals.css`.
- Troca em `src/ui/visual.ts` (`VISUAL`). Para comparar sem mexer no código: `?visual=suave` ou `?visual=fluent` no endereço.

## Foto do rolê e Rolês (histórico) — 09/10/2026

- **Foto no cartão do total:** botão de câmera no cartão → "Tirar foto agora" ou "Escolher da galeria". A foto vira o fundo, escurecida embaixo para o total ficar legível. É reduzida para no máximo 1600 px (≈200 KB) e guardada no aparelho (IndexedDB), separada da conta.
- **"Nova conta" guarda a atual nos Rolês**, sem pedir confirmação (nada se perde). O exemplo intocado e conta vazia não são guardados.
- **Rolês:** botão no topo. Cartões com foto de fundo, nome do lugar, data, avatares, nº de pessoas e total. Tocando: foto grande, quem estava, quanto cada um pagou, quem pagou; ações "Reabrir conta" e "Apagar" (com confirmação na página).
- **Reabrir:** a conta volta a ser a atual; a que estava aberta vai para os Rolês.
- O campo "Nome da conta" virou **"Nome do lugar"**.
- **Fase 2 (pendente):** foto de todo mundo exige guardar no Supabase Storage; a regra de apagar contas compartilhadas após 14 dias conflita com a ideia de lembrança e precisa ser revista.

## Quantidade, registro de alterações e PWA — 09/10/2026

- **Quantidade no item:** barra "− 3 +" com o total da linha (padrão dos carrinhos de delivery). O "+" soma uma unidade e mantém as mesmas pessoas marcadas. O item guarda o preço de 1 unidade e a quantidade (sem o campo, vale 1). Mínimo 1 (para apagar, lixeira), máximo 99.
- **Registro de alterações:** cada mudança vira uma linha com o quê e quando (ex.: "Mais um: Chopp (agora 3×)"). Digitar o nome do lugar vira uma linha só. Até 500 linhas por conta. Aparece em Divisão (últimas 4 + "Ver tudo") e no detalhe de cada rolê. Vai junto para o histórico.
- **Autor no registro:** cada linha já tem o campo "quem fez", vazio no modo solo. No modo compartilhado será o nome da conta Google.
- **PWA:** instalável (manifest, ícones 192/512 normais e "maskable", ícone do iPhone), abre em tela cheia, funciona sem internet (service worker em `/sw.js`, gerado de `src/pwa/sw.template.js` com versão nova a cada build). Rede lenta no bar: se a página não responder em 3,5 s, abre a versão guardada. Convite "Instalar" (Android/Chrome) ou instrução do iPhone, que dá para dispensar. Aviso "Versão nova do app" com botão Atualizar. Em desenvolvimento o service worker fica desligado.
- **Celular:** campos com letra de 16 px (o iPhone não dá zoom ao digitar); ajustes para telas de 320–374 px. Conferido sem rolagem para o lado em 320, 360, 390 e 430 px, nos dois visuais.

## Notinha em imagem — 09/10/2026

- **"Enviar notinha"** (botão principal da Divisão) gera uma imagem da nota com as cores do app: papel serrilhado sobre o carmim, bolhas sobrepostas, foto do rolê no topo (se houver), quanto cada um paga, total e "Pague para Fulano". Desenhada no aparelho (funciona offline), com a fonte Plus Jakarta Sans do pacote.
- No celular abre o menu de compartilhar do sistema (escolhe WhatsApp e a imagem vai anexada). O link do WhatsApp (wa.me) só leva texto, por isso não é usado para a imagem. No computador, a notinha é baixada.
- A imagem é montada antes do toque, porque o celular só abre o menu de compartilhar logo após o toque.
- "Copiar texto" continua; "Mandar só o texto no WhatsApp" fica dentro de "Texto do resumo". Há também "Ver a notinha em imagem" com Baixar/Enviar.
- **Item sem ninguém marcado:** o aviso diz qual item e o valor ("Pudim (R$ 21,00) está sem ninguém marcado, então ficou fora da divisão e do total") e tem o botão "Marcar quem consumiu", que leva ao item em destaque na etapa Pedidos. A notinha em imagem também cita o item.
- Desenhos refeitos: bife (carne vermelha, gordura e marcas da chapa), batata amarela no saquinho vermelho, pudim com calda e sem a bola em cima.

## Por que alguém gastou mais, doces e notinha-ingresso — 09/10/2026

- **"Ver o que Fulano consumiu"** em cada cartão da Divisão: lista os itens da pessoa com a parte dela (e "só Fulano" ou "dividido em N"), consumo, serviço proporcional e total. Vem do mesmo cálculo da divisão (`parts` em `computeSplit`), então bate centavo por centavo; testado em 300 contas aleatórias.
- **Doces separados:** pudim/flan → pudim; bolo/torta/cheesecake → fatia de bolo; doce/sobremesa/brigadeiro/chocolate/brownie → bombom embrulhado; sorvete/açaí/picolé → casquinha.
- **Notinha em imagem:** a versão ingresso de cinema foi testada e **descartada** (poluída). Voltou a primeira (papel branco serrilhado, bolinha + nome + valor de cada pessoa, total, "Pague para…"), agora sobre **fundo preto** com brilho carmim discreto.
- **Nota dentro do app (Divisão) no estilo da notinha do McDonald's** (ref.: 1ª imagem do briefing): serrilhado em cima, foto do rolê como "logo", selo "Pago"/"Em aberto", Conta nº (código curto fixo), data/hora, pago por, itens numerados com ×quantidade (item fora da divisão riscado), consumo, serviço, "Total geral", "Dividido com" (bolinha + nome de cada um; com o login Google vira a foto da pessoa) e a nota saindo de uma "impressora" preta com "Fulano recebe dos outros" ou "Total da mesa".

## Quem já pagou — 09/10/2026

- Cada pessoa na Divisão tem **"Marcar como pago"** (vira "✓ Pago"; toque de novo desmarca). Quem pagou no caixa já conta como pago ("Pagou a conta no caixa").
- Guarda **o valor pago**, não só sim/não (`bill.paid`). Se a conta mudar depois: "Pagou R$ X · falta R$ Y" (botão "Pagou o resto") ou "Pagou R$ X a mais".
- Nota no app: selo **"2/4 pagos"** (ref.: "3/4 Paid" do McDonald's) ou "Tudo pago"; ✓ nas bolinhas do "Dividido com"; impressora mostra **"Falta Fulano receber R$ X · N de M já pagaram"** ou "Tudo acertado ✓".
- Também em: aviso sob "Quem pagou no caixa?", mensagem do WhatsApp ("✅ pago", "Falta receber", "Tudo pago ✅", "pagou a mais, receber de volta"), notinha em imagem (etiqueta verde "pago ✓"), cartões dos Rolês ("2/4 pagos" / "✓ Tudo pago") e registro de alterações ("Ana pagou R$ 80,85").

## Ler nota fiscal (OCR) — 12/10/2026

Pedida antes da Fase 2 (no briefing era a Fase 3).

- **Onde:** botão "Ler nota fiscal" na aba Pedidos → tirar foto ou escolher da galeria → "Lendo a nota" (barra de progresso, Cancelar) → "Confira os itens" → "Lançar N itens".
- **No celular, sem servidor:** Tesseract (tesseract.js 7.0.0) com o português compacto (~1,3 MB). Os arquivos (~5 MB no total) são servidos pelo próprio site em `/ocr` (copiados de `node_modules` por `scripts/copy-ocr.mjs` antes do build; a pasta não vai para o Git). O service worker guarda esses arquivos num espaço próprio, que não é apagado nas atualizações do app, e a leitura funciona sem internet depois do primeiro uso.
- **Peça trocável:** a tela só conhece `ReceiptReader` (`src/receipt/reader.ts`). O Tesseract é um leitor (`tesseract.ts`). Uma IA no futuro seria outro, com a chave numa função do Next. A interpretação do texto (`parse.ts`) é pura e testada: itens, quantidade (do "2 CAIPIRINHA", do "3 X 14,50" ou do unitário × total), peso vira 1 unidade, item em duas linhas (NFC-e), pontilhado, R$, milhar e trocas comuns do OCR (O→0, l→1). Ignora CNPJ, data, pagamento, troco, impostos, desconto e "por pessoa".
- **Foto:** é ajustada antes (gira pela câmera, tamanho, tons de cinza e contraste) e lida como um bloco só, o que mantém o preço na linha do nome mesmo com a nota um pouco torta.
- **Revisão:** cada linha com nome, quantidade (− +) e valor da unidade editáveis, apagar e "Incluir linha que faltou". Confere a soma com a nota ("A soma bate com a nota" ou "faltam/sobram R$ X"). Se a nota trouxer serviço de 10/12/15% diferente do atual, oferece "Usar o serviço da nota". Com itens já lançados, escolhe "Somar aos N" ou "Trocar pelos da nota". Na mesa de exemplo, a nota começa uma conta nova.
- **Itens lidos** entram como os digitados: todo mundo da mesa marcado. Se ainda não há pessoas, o aviso pede para adicionar quem estava na mesa.
- **Privacidade:** a foto da nota não sai do celular nem fica guardada (texto incluído na política, atualizada em 12/10/2026).
- Testado com nota de bar, cupom NFC-e (serviço de 12%), foto torta e apagada e sem internet.

## Várias notas fiscais na mesma conta — 12/10/2026 (passo 1 de 4)

- **Pedido:** quem banca várias compras (ex.: bar, doces, mercado) guarda cada nota no mesmo grupo e, no fim, cobra o total de cada um. Escolhas da Rebeca: cada nota escolhe quem divide; cada nota tem o seu pagador; categoria da lista pronta (Comida, Bebidas, Doces, Mercado, Transporte, Outros) ou digitada; a foto fica só no celular.
- **Modelo:** a conta ganha `notes` (opcional). Cada nota tem categoria, serviço, quem pagou, quem divide, o que já foi pago e a foto; cada item tem o `noteId`. Sem `notes`, a conta é uma nota só e tudo funciona como antes (contas antigas não mudam). Ao criar a 2ª nota (ou editar/guardar foto na primeira), o que existia vira a "Nota 1".
- **Tela:** em Pedidos, logo abaixo do nome do lugar, a barra das notas (cartões com emoji da categoria e total; "+ Outra nota"), com a linha "paga por Fulano · 2 de 3 dividem", a miniatura da foto (toca e abre grande) e "Editar". Pedidos e Divisão mostram a nota aberta; a Divisão também tem a barra quando há mais de uma nota. O cartão do topo e a Mesa mostram a soma de todas as notas ("2 notas").
- **Regras:** item novo entra na nota aberta com quem divide ela marcado. Pessoa nova na Mesa entra nas notas que eram de todo mundo (nas de só alguns, fica de fora). Tirar alguém da nota tira dos itens dela; pôr de volta marca nos itens que eram de todos. Quem pagou a nota aparece nela mesmo sem dividir (fica com R$ 0 e recebe tudo dos outros). Apagar a nota apaga os itens dela (com confirmação na própria janela); a última não pode ser apagada.
- **Foto da nota:** na janela da nota (câmera ou galeria) ou ao ler a nota fiscal ("Guardar a foto da nota neste celular", marcado por padrão). Reduzida e guardada no aparelho (IndexedDB), como a foto do rolê. Política de Privacidade atualizada.
- **Próximos passos:** (2) resumo do grupo e (3) compartilhar (feitos, abaixo); (4) ver a nota no app para o grupo, junto com a Fase 2.

## Resumo do grupo — 12/10/2026 (passo 2 de 4)

- Com mais de uma nota, a Divisão abre em **"Resumo do grupo"** (com a opção **"Por nota"**, que mostra a divisão de uma nota por vez, como antes).
- **Quem paga para quem:** em cada nota com pagador, cada um deve a ele a sua parte (menos o que já marcou como pago na nota). As dívidas de todas as notas são compensadas num saldo por pessoa (Ana deve 30 à Rebeca e a Rebeca deve 20 à Ana → "Ana paga 10 para Rebeca") e viram o menor número de transferências. Nota sem pagador não gera dívida: aparece "Doces está sem quem pagou: cada um paga a sua parte no caixa · Escolher".
- **"Marcar como pago"** em cada transferência guarda o acerto (`settled`), que entra no saldo; a lista "Já acertado" tem "Desfazer". Fica no registro ("Ana pagou R$ 20,00 a Rebeca"). Quando não falta ninguém: "Tudo acertado entre o grupo".
- **Quanto cada um gastou:** total por pessoa com o valor em cada nota (emoji + categoria). **Notas:** lista com pagador e total; tocar abre a nota em "Por nota".
- Limite conhecido: na visão "Por nota", o "Falta Fulano receber" considera só os pagamentos marcados naquela nota, não os acertos feitos no resumo.

## Compartilhar as notas — 12/10/2026 (passo 3 de 4)

- **Resumo do grupo:** no fim, "Copiar texto" e "Enviar resumo" (abre o menu de compartilhar do celular; no computador, o WhatsApp). O texto traz as notas (emoji, categoria, total, quem pagou), quanto cada um gastou (com o valor por nota) e quem paga para quem, com os acertos marcados ✅ e o aviso das notas sem pagador.
- **Compartilhar nota:** tocando na miniatura da foto da nota, a foto abre grande com "Compartilhar nota": vai a foto + o resumo daquela nota (quanto cada um paga). Sem compartilhar arquivos (computador), baixa a foto e copia o resumo. Sem foto, a nota continua tendo "Enviar notinha" em "Por nota".
- A foto continua só no celular: ela só sai quando a pessoa compartilha.

## Ajustes depois do teste no celular — 12/10/2026

- **Ler nota com a conta já tendo itens:** o "Somar aos N / Trocar pelos da nota" (quebrava o layout e confundia) virou 3 opções com explicação: **"Criar uma nota separada"** (padrão), "Juntar com os N itens desta nota" e "Trocar os N itens pelos da foto". Motivo: a Rebeca leu uma nota de R$ 13,20 e ela foi somada à pizza lançada à mão; ao compartilhar, saiu tudo junto. Na nota separada, o serviço da nota fiscal é oferecido de novo (a nota nova começa sem serviço) e, ao lançar, abre a janela da nota para escolher categoria, quem pagou e quem divide.
- **Primeira vez no app:** começa zerado (sem a mesa de exemplo). Quem tinha a mesa de exemplo salva também passa a ver a conta zerada.

## Aba Viagem — 13/10/2026 (passo 1 de 4: cálculo)

- **Pedido:** uma segunda área para despesas de viagem em grupo (vários dias, várias pessoas pagando), com saldo e acerto no fim. Briefing em `BRIEFING-VIAGEM.md`. Prazo: viagem do fim do ano.
- **Nomes:** as áreas se chamam **Rolê** (bar/restaurante, o que já existe) e **Viagem**. "Mesa" continua sendo só a 1ª etapa do Rolê.
- **Famílias:** o participante pode ser a família inteira, com peso = número de pessoas (criança 0,5). Ex.: "Família Ana" peso 3,5. Na v1 não há agrupamento de pessoas em família.
- **Acerto final:** mínimo exato até 15 pessoas com saldo (testa todas as combinações em milissegundos); acima disso, o guloso (às vezes 1 pagamento a mais). Ex.: saldos +4, +3, +3, −6, −4 → guloso faz 4 pagamentos, o exato faz 3. O Rolê continua com o guloso.
- **Extras da v1 (escolhidos olhando Splitwise, Tricount, Splid e Settle Up):** "Quem paga a próxima?" (quem mais deve ao caixa; equilibra os saldos durante a viagem) e despesas agrupadas por dia ("caderneta"). A leitura do valor pela foto do comprovante fica para depois.
- **Acerto parcial na v1:** "Registrar acerto" aceita valor menor que o da linha (ex.: reembolso de parcela). Parcelamento na v1 = despesa normal com o valor total + acertos parciais.
- **Regras de dinheiro:** igual entre N (centavo extra gira pela ordem de criação da despesa, que não muda ao editar nem ao excluir outras); por peso com maior resto; valores exatos só salvam se a soma bater (mensagem com a diferença). As partes ficam guardadas em cada despesa. Excluir é só uma marca (dá para desfazer). Remover participante com despesas exige passar tudo para outra pessoa (os valores não mudam; se as duas estavam na mesma despesa, as partes somam). Se alguma conta não fechar ao centavo, o resumo vem marcado e o acerto não é mostrado.
- **Código:** `src/core/money.ts` (`splitEven`, `splitWeighted`, usados também pelo Rolê), `src/core/settle.ts` (`settleUp`, `minTransfers`), `src/core/trip.ts` (modelo e cálculo da viagem). Testes com os números do briefing em `trip.test.ts` e `settle.test.ts`.
- **Respostas combinadas para os próximos passos:** viagem compartilhada antes do Rolê compartilhado, com a mesma base (convite, membros, papéis); editor mexe só no que lançou, dono em tudo; expiração 90 dias após a última atividade, com aviso 15 e 3 dias antes e "Baixar planilha" (CSV); aviso de despesa parecida (mesmo valor no mesmo dia) e código único por despesa contra envio repetido; fila para lançar sem internet.

## Aba Viagem — 13/10/2026 (passo 2 de 4: modo solo no celular)

- **Visual "caderneta":** pedido da Rebeca para seguir o que já existe no app (sem prints). Mesmas cores, fontes, cartões, abas e janelas do Rolê, com detalhes de caderno: cada dia é uma página ("Dia 3 · ter, 30 dez", com o total do dia), linha de margem rosa e linhas pautadas entre as despesas. Ícones das categorias em traço neutro (como pede o briefing).
- **Navegação:** no topo, logo abaixo da barra, a troca **Rolê | Viagem** (com "bar e restaurante" / "vários dias"). O app abre na última área usada. As duas áreas ficam na mesma página (e não em endereços diferentes) para a Viagem abrir sem internet como o Rolê. Dados separados: `racha-conta-v1` (Rolê) e `racha-viagem-v1` (Viagem).
- **Telas:** sem viagem, uma boas-vindas com os 3 passos e "Criar viagem". Lista "Suas viagens" (cartões com datas, total e quem vai). Dentro da viagem: capa (nome, datas, gasto total, pessoas) e as abas **Pessoas · Despesas · Saldos** (no computador, Saldos fica sempre à direita). Botão fixo "+ Nova despesa".
- **Nova despesa:** valor primeiro (teclado numérico, foco automático), descrição opcional (sem ela, vale o nome da categoria), 8 categorias em grade, quem pagou (já vem "Eu"), quem participa (todos marcados), como dividir (Igual / Por peso / Valores exatos, com o valor de cada um aparecendo na hora; nos exatos, "Faltam R$ X" ou "Fechou certinho"), dia (Hoje / Ontem / outro). Mostra a sugestão "quem paga a próxima" e o aviso de despesa parecida (mesmo valor no mesmo dia: o botão vira "Lançar mesmo assim"). Editar e excluir na mesma janela; excluir tem "Desfazer" e a lista "Excluídas" com "Restaurar".
- **Pessoas:** nome, peso (− / + de 0,5 em 0,5 e atalhos Adulto 1, Criança 0,5, Não divide 0) e "Sou eu". Remover quem tem despesas pede para escolher quem fica com elas.
- **Saldos:** "Para ficar tudo quite" (acerto mínimo) com "Registrar pagamento" (aceita valor parcial), "Já pago" com Desfazer, saldo de cada um (pagou, consumiu, "recebe"/"paga" com valor e uma barra que cresce para cada lado do zero), gastos por categoria e o resumo para o grupo (Quem paga quem / Saldos) com Copiar texto e Enviar resumo.
- **Garantias:** sem alert/confirm/prompt, alvos de 44 px, rótulos em todos os campos, avisos com aria-live, sem rolagem horizontal de 320 a 1280 px, temas claro e escuro. Política de Privacidade atualizada (viagens ficam só no aparelho; o app não pede CPF, documentos nem cartão).
- **Código:** `src/ui/viagem/` (TripApp, TripCover, TripPeople, TripExpenses, TripBalances, ExpenseSheet, PersonSheet, SettleSheet, TripSheet, Sheet, CategoryIcon, tripDates), `src/ui/Areas.tsx` e `AreaSwitch.tsx`, `src/state/tripState.ts` (com testes), `src/app/viagem.css`.

## Exceção "consumiu só isso" (Fase 1, passo 3)

- Os itens escolhidos ficam **só para a pessoa** (ela paga o valor inteiro). Ela sai de todos os outros itens.
- A pessoa fica marcada com a exceção: **itens novos já começam sem ela**, até alguém marcá-la ou desfazer a exceção.

## Técnica

- **Next.js 16** (migrado do Vite em 09/10/2026; cópia antiga em `../racha-conta-vite-backup`).
- O modo solo roda só no aparelho (`ClientOnly`), porque depende do armazenamento local e da data do celular.
- Testes com Vitest: `npm test`. Verificação de código: `npm run lint`.

## Modo compartilhado (Fase 2) — propostas aceitas

- **Mudança (09/10/2026): login com Google**, no lugar do login anônimo. Pessoas de um rolê podem ser:
  - **com conta:** entraram pelo link de convite e ficam vinculadas (nome vem da conta Google);
  - **só nome:** adicionadas à mão por quem está no rolê, para quem não tem o app.
  O registro de alterações mostra o nome da conta de quem fez cada mudança.
- **Login (decidido em 09/10/2026): obrigatório para quem cria a conta; opcional para quem entra pelo convite** (pode só escolher o nome). O criador precisa de internet só no primeiro login; depois a sessão fica no aparelho e o app funciona offline.
- **Método:** botão oficial "Entrar com Google" (Google Identity Services) + `signInWithIdToken` do Supabase, em vez do redirecionamento — no iPhone com o app instalado, o redirecionamento costuma abrir o Safari e a pessoa fica logada fora do app. O redirecionamento fica configurado como plano B.
- **Login implementado (10/10/2026):** botão da conta no topo (ícone de pessoa; vira a foto do Google depois de entrar). Folha "Entrar" com o botão oficial do Google; logado mostra foto, nome, e-mail e "Sair". Usar o app sozinho continua sem login. Código em `src/auth/` (`supabase.ts`, `account.ts`, `google.ts`) e `src/ui/AccountButton.tsx`/`GoogleButton.tsx`. Usa nonce (hash enviado ao Google, valor original ao Supabase). Cliente OAuth Google criado (app em modo Teste: só entram os e-mails da lista de "Usuários de teste"). Variável pública `NEXT_PUBLIC_GOOGLE_CLIENT_ID` na Vercel e no `.env.local`.
- **Tela de entrada (10/10/2026):** quem abre o app sem estar logado vê a tela de login (topo carmim com as bolhas da paleta Marple, moeda, frase do app e uma mini notinha flutuando; painel com o botão do Google, 3 benefícios e link da privacidade; no computador, lado a lado). Depois de entrar, abre o app; "Sair" volta para ela. É mostrada no próprio endereço (`AuthGate`), sem redirecionar, para não criar vai-e-volta com o app offline. Quem já entrou abre o app até sem internet (sessão guardada no aparelho). Sem as chaves configuradas (ex.: computador de desenvolvimento), o app abre direto. Na Fase 2, o link de convite passa por fora do portão. Enfeite do topo: uma nota fiscal de bar (serrilhada, letra de máquina, itens, serviço, total e código de barras) com a divisão por pessoa por cima, contando a história do app. No computador, a divisa entre o carmim e o painel é esfumada (gradiente), sem linha seca. No celular, o topo é mais baixo (logo ao lado do nome, desenho mais compacto; em telas curtas o desenho encolhe) para o botão do Google aparecer sem rolar, a partir de telas de 320×560. Tirei o texto embaixo de "Entrar" e, em telas de até 740 px de altura, aperto desenho, lista e espaços: a tela de login inteira cabe sem rolar no celular. O painel "Entrar" fica uns 15 px abaixo do selo "3/4 pagos" (antes encostava) e o "Só usamos seu nome…" vai para o pé da tela. No celular, a tela de login tem a altura exata da tela e nunca rola: se faltar espaço, o desenho do topo encolhe por baixo do painel (o app, depois de entrar, rola normalmente). Para não sobrar um buraco vazio no painel, as vantagens viraram um cartão com ícones coloridos: em celular de altura comum, 3 blocos lado a lado (ícone + nome curto); em celular alto (a partir de 880 px) e no computador, a lista com uma linha de explicação. O aviso de privacidade vem logo abaixo do cartão e a sobra de altura fica no carmim do topo, com o desenho centralizado. O botão do Google na tela de login é retangular com cantos de 12 px (o Google só oferece "pílula" ou cantos de 4 px; o recorte e a borda fina são feitos no CSS) e usa sempre o tema branco com borda, porque no escuro o quadrado branco do "G" ficava torto no recorte.
- **Popup "Instale o app" (10/10/2026):** 2,5 s depois de abrir o app (já logado, nunca na tela de login, para não tapar o botão do Google), aparece uma folha com o ícone, 3 vantagens e "Instalar" (Android/Chrome/Edge, abre a janela do navegador) ou o passo a passo do iPhone (Compartilhar → Adicionar à Tela de Início), porque no iPhone não existe botão de instalar. "Agora não" (ou tocar fora / Esc) adia por 7 dias; enquanto isso fica o aviso pequeno no app, que pode ser fechado de vez. Não aparece se o app já está instalado nem se outra folha está aberta.
- **No ar (10/10/2026):** código em `github.com/rebecapaulino/racha-conta` (privado); site em `https://racha-conta-ebon.vercel.app` (Vercel, plano Hobby, projeto ligado ao GitHub: cada push na `main` publica sozinho). Supabase: projeto `sfryqzzismqdruqzluge` (São Paulo). Variáveis públicas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` já estão na Vercel.
- Passo a passo das contas externas (Supabase, Google Cloud, Vercel): `docs/PASSO-A-PASSO-LOGIN.md`.

- Identidade sem cadastro: **login anônimo do Supabase**. Tabela de membros associa aparelho → nome → papel.
- Permissões no banco com **RLS** (Row Level Security). Funções do servidor nunca gravam com a chave mestra em nome do usuário.
- **Link do dono** para recuperação: código secreto guardado no banco só como hash, com botão "Mandar para mim no WhatsApp".
- **Expiração: 14 dias depois da última alteração**, apagadas por tarefa diária no banco.
- Atenção aos limites do plano grátis: 200 conexões de tempo real simultâneas e pausa do projeto após 1 semana sem uso.
- Ativar captcha invisível no login anônimo.
- **Ícone no iPhone (10/10/2026):** no Safari, "Adicionar à Tela de Início" não pegava o ícone do app (no Android/Chrome pegava). O ícone de 180×180 agora fica também na raiz do site (`/apple-touch-icon.png` e `-precomposed`), onde o iPhone procura por padrão, com o tamanho declarado e `?v=2` no endereço para o Safari não reaproveitar uma tentativa antiga guardada.
- **Painel "Entrar" refeito (10/10/2026):** a parte de baixo da tela de login foi redesenhada do zero para ficar limpa, preenchida e sem nenhum texto quebrado:
  - Tudo numa coluna centralizada de até 400 px: título "Entre para começar" e a linha "Rapidinho e sem criar senha.".
  - O botão do Google ("Continuar com o Google") ocupa a largura toda da coluna e se redesenha se a largura mudar (celular girado).
  - As vantagens viraram 3 colunas sem caixa em volta: ícone colorido, uma palavra e um complemento curto ("Fotos do rolê", "Convites por link", "Funciona sem sinal"). As palavras são curtas de propósito, para nunca quebrar linha, nem no celular de 320 px.
  - O aviso de privacidade fica em duas linhas pensadas, com o link inteiro na segunda.
  - O desenho do topo fica numa área que ocupa só o espaço livre do carmim e escolhe sozinho o tamanho (de 100% até 46%). Se não couber nem assim, some em vez de aparecer cortado pelo painel.
  - Em celular deitado (altura abaixo de 460 px), a tela volta a rolar, para nunca cortar o botão.

### Viagem — acerto "Direto para quem pagou" (padrão) e resumo em imagem
- **Por quê:** no modo "menos Pix" o dinheiro pode ir para outra pessoa (Mauricio pagava a Natacha uma parte que devia à Rebeca). Isso confunde quem confere na mão.
- **Direto para quem pagou (padrão):** para cada dupla, soma o que um deve ao outro pelas despesas que o outro pagou, desconta o caminho contrário e os pagamentos já feitos entre os dois, e sobra um Pix. Fica salvo na viagem (`settleMode`); "Menos Pix" continua como opção.
- Os dois modos dão o mesmo total para cada pessoa (testado).
- Acerto agrupado por quem paga ("Você paga R$ 100: R$ 70 para Mauricio, R$ 30 para Natacha"), com "Pago" em cada linha e "Ver a conta" levando à Conta de cada um.
- Resumo em imagem (canvas, no aparelho, funciona offline), no mesmo papel da notinha do Rolê: quem paga quem e quanto cada um pagou/consumiu. Texto do WhatsApp agrupado do mesmo jeito.

### Viagem — pagamento marcado fica na lista; "quem paga a parte de quem"
- **Pago não some:** o acerto é calculado só com as despesas (o "plano"). Cada pagamento registrado abate da linha da mesma dupla: pago inteiro fica verde com "Pago" (tocar desmarca, com Desfazer); parcial mostra "já pagou X de Y" e "Pagar o resto". Se alguém pagar a mais ou para outra pessoa, entra uma linha de ajuste, para o que falta continuar fechando ao centavo com os saldos (testado nos dois modos).
- **Quem paga a parte de outra pessoa** (`Traveler.coveredBy`): o pai paga a da filha, o Robin paga a da Rebeca. As despesas continuam no nome de cada um (dá para ver quanto cada um consumiu); só no acerto a conta entra na de quem paga. Não deixa fechar círculo; ao remover/juntar quem pagava, a ligação é limpa ou passa para quem recebeu.
- Diferente de "família = 1 participante com peso": aqui cada um continua sendo uma pessoa na divisão.

### Viagem — setinha, filtro "Ver de quem" e parcelas
- Cada pagamento mostra quem paga → quem recebe (avatar pequeno, seta, avatar de quem recebe).
- **Ver de quem:** escolhe uma pessoa e mostra "Quem deve para ela" (+ verde) e "Ela deve para" (− vermelho), com Pago e parcelas. Quem tem a parte paga por outro mostra a conta de quem paga.
- ~~Parcelas por dupla no acerto~~: substituído por parcelas na despesa (abaixo).

### Viagem — parcelas na despesa (substitui "Parcelar" no acerto)
- **Por quê:** quem parcela é quem pagou no cartão (ex.: Airbnb em 6x). Definir na despesa faz cada parcela bater com a do cartão.
- `Expense.installments` (2 a 24). No acerto, cada despesa parcelada vira um pagamento separado por pessoa (quem deve → quem pagou), **sem compensar** com o resto; o à vista continua compensado como antes. Os dois modos continuam fechando com os saldos (testado).
- A parte de cada um é dividida ao centavo (o centavo extra vai nas primeiras parcelas). As parcelas pagas são contadas pelo acumulado pago. O pagamento registrado leva `expenseId` e abate só daquela despesa.
- Tela: ícone + nome da despesa, "parcela 2 de 6 · faltam R$ X de R$ Y", botão "Pagar 2/6" com o valor da parcela. Na lista de despesas aparece "6x". Texto e imagem mostram a parcela da vez.

## Rolê: sem o "+" no topo, quem paga a parte de quem e acerto igual ao da Viagem

- O "+" (Nova conta) do topo saiu. "Nova conta" agora fica na tela Rolês, onde a conta atual é guardada.
- Na Mesa, tocar no nome abre "Quem paga a parte de X?". A parte da pessoa entra na de quem paga: numa nota só, quem paga marca tudo de uma vez; no resumo do grupo, as linhas são entre contas.
- Resumo do grupo: "Direto para quem pagou" (padrão) ou "Menos Pix", filtro "Ver de quem", seta e valores em vermelho/verde. O que foi pago continua na lista em verde (tocar desmarca, com Desfazer). A lista é a mesma da Viagem (SettleList), sem parcelas.
- Lógica genérica em settle.ts (accountIn, canCoverIn, netPairs, reconcilePlan), com testes.

## Viagem: nova despesa em etapas, sem "Por peso" e sem Hoje/Ontem

- **Por quê:** a tela pedia tudo de uma vez, e "peso" não era claro para quem usa. Os botões Hoje/Ontem repetiam o calendário. A dica "quem paga a próxima" já aparece na caderneta.
- **Etapas:** 1 Valor e nome · 2 Categoria · 3 Quem pagou, dia, à vista ou parcelado · 4 Alguém paga junto com quem pagou? (a etapa some se ninguém pode entrar) · 5 Quem participa · 6 Como dividir, com o valor de cada um, e Lançar. A etapa 4 muda quem paga a parte de quem na viagem toda (não só na despesa) e só grava ao lançar. Dá para voltar e tocar numa etapa já vista. Editando, todas as etapas ficam abertas e "Salvar" funciona de qualquer uma.
- **Peso:** saiu só da escolha "Como dividir" (fica para quem edita uma despesa antiga que já usava). O peso em Pessoas continua como estava.
- **Títulos das etapas** do tamanho do rótulo "Nome da despesa", e a barra mostra o nome de cada etapa.

## Viagem: "paga conta de alguém?" só nesta despesa ou na viagem toda

- **Por quê:** quem paga a parte de alguém num jantar não paga necessariamente nas outras despesas.
- **Como fica:** na etapa "Mauricio paga conta de alguém?", a pessoa escolhe quem e se vale **só nesta despesa** (padrão) ou **a viagem toda** (o mesmo de Pessoas).
- **Conta:** a despesa guarda `coveredBy` (quem participa → quem paga a parte dela). A pessoa continua tendo consumido (`owes`), mas a parte entra na conta de quem paga (`charged`), no saldo, no acerto direto, no de menos Pix, nas parcelas e na conta detalhada ("parte de Lara"). Testado em `trip.test.ts`.

## Viagem: correções de conta (à vista e despesa excluída)

- **Parcelada que volta para à vista:** a despesa ficava guardada como parcelada e o acerto continuava em parcelas. Agora deixa de ser parcelada.
- **Despesa excluída:** os pagamentos de parcela registrados nela saem do acerto e do histórico junto com ela (voltam se a exclusão for desfeita). Pagamentos gerais continuam contando.
- **Desmarcar pagamento → Desfazer:** voltava sem a ligação com a parcela; agora volta igual.
- Testado em `trip.test.ts`.

## Viagem: "Todos pagos" na despesa e pagamentos ligados às despesas

- **Por quê:** um pagamento feito por uma despesa que depois foi excluída virava "dívida de volta" no painel, o que confunde.
- **"Todos pagos":** botão na despesa (editar, primeira etapa). A despesa sai do acerto (saldos, quem paga quem, parcelas), mas continua na caderneta e no gasto total. Dá para voltar.
- **Pagamento ligado:** ao marcar "Pago", o pagamento guarda as despesas das duas pessoas naquele momento (`expenseIds`). Se uma delas for excluída ou marcada "Todos pagos", o pagamento para de contar. Pagamentos de antes desta versão ligam às despesas das duas pessoas que existiam quando foram marcados.
- Testado em `trip.test.ts`.

## Saldos como extrato e sem "Menos Pix"

- **Viagem:** a "Conta de cada um" e o card antigo de Saldos viraram um extrato único: cada pessoa com o saldo (verde recebe, vermelho paga, "quite"). Os links "Ver a conta" do acerto saíram junto.
- **Menos Pix saiu da Viagem e do Rolê:** o acerto é sempre direto para quem pagou. Contas e viagens antigas que tinham "Menos Pix" guardado passam a mostrar o direto.

## Acerto em carrossel e "Todos pagos" na caderneta

- **Carrossel:** o acerto da Viagem mostra um card por vez (quem paga e para quem). A seta no centro, à direita, passa para a próxima pessoa com uma animação de deslizar (sem animação para quem pediu menos movimento). No último, volta ao primeiro. Não há mais vários cards um embaixo do outro.
- **"Todos pagos"** saiu da tela de editar e ficou embaixo de cada despesa na caderneta (um toque marca, outro desmarca, com Desfazer).
- **Pagamento ligado a despesas excluídas e ativas:** continua valendo para as que ficaram, até o que se deve nelas (antes saía inteiro).
