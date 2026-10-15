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

## Extrato com status de cada pessoa

- **Formato de extrato:** linhas separadas por um traço, sem cards. À direita, o valor (verde recebe, vermelho paga) ou o status: "✓ pago", "✓ recebido", "(não incluso)" para quem não participa de nenhuma despesa, e "parte paga por X" para quem tem a parte paga por outra pessoa.
- **Pago:** quem já pagou aparece como "pago" (não "quite"), e o card do acerto continua na tela, marcado em verde.
- Lógica em `statementRows` (trip.ts), testada.

## Desativar "viagem toda" na despesa

- Na etapa "paga conta de alguém?", quem já está na conta de quem pagou na viagem toda aparece marcado ("· viagem toda"). Um toque desativa: a pessoa volta a pagar a própria parte em todas as despesas, e dá para escolher "Só nesta despesa" em seguida. "Ninguém" desativa todos. Só é gravado ao salvar.
- "Todos pagos" na caderneta desceu, para não encostar no destaque da despesa ao passar o mouse.

## Rolê: carrossel e card no estilo da Viagem

- **"Quanto cada um paga"** (conta de uma nota): um card por vez, no estilo do acerto da Viagem ("Mauricio paga", seta para quem pagou no caixa, valor e "Pago"), com a seta à direita para a próxima pessoa. "Ver o que X consumiu" virou **"Detalhe"**. A barra de porcentagem, o consumo e o serviço continuam no card.
- **Resumo do grupo** (várias notas): o acerto também é um card por vez, igual à Viagem.
- "Quem pagou no caixa?" continua igual.
- **Seta de voltar** (Viagem e Rolê): à esquerda do card; o card volta deslizando da esquerda. No primeiro, voltar leva ao último.

## Modo claro / escuro escolhido no app

- **Botão no topo** (lua/sol, ao lado de Rolês/Viagens): troca entre claro e escuro e guarda a escolha neste aparelho (`racha-conta-tema`). Sem escolha, segue o aparelho.
- **Como:** o tema escolhido vai em `data-theme` no `<html>` antes da página aparecer (sem piscar). Cada bloco de estilo do escuro vale quando o aparelho está escuro e não foi escolhido o claro, ou quando foi escolhido o escuro.
- **"Total da mesa"** no claro: cinza claro com sombra (antes, preto). No escuro continua preto.
- **Fundo do modo claro:** branco (#FFFFFF) em vez de cinza (#F5F5F5); a barra do navegador acompanha.

## Peso saiu de Pessoas

- O ajuste de peso e o "peso 1" na lista saíram da tela de Pessoas. Despesas antigas divididas por peso continuam com a mesma conta (o peso guardado de cada pessoa não muda).

## Registro de alterações na Viagem e base do compartilhamento — 14/10/2026

- **Registro na Viagem:** na aba Saldos, as últimas 4 alterações e "Ver tudo" (igual ao Rolê): pessoa adicionada, renomeada ou tirada, quem paga a parte de quem, despesa lançada/editada (com o valor antigo → novo)/excluída, "todos pagos", pagamentos marcados e desmarcados, nome e datas da viagem. Guardado na própria viagem (`trip.log`, até 300 linhas), com o campo "quem fez" pronto para o compartilhado.
- **Compartilhar (em andamento):** SQL das tabelas em `supabase/migrations/20261014_grupos.sql` (grupo com o conteúdo inteiro, membros, convite por código, salvar com conferência de versão, tempo real). Gravação só por funções que conferem quem é do grupo; leitura só para membros (RLS). Passo a passo em `docs/PASSO-A-PASSO-COMPARTILHAR.md`.
- **Decidido agora:** todo mundo do grupo vê e edita tudo (substitui "editor mexe só no que lançou"); o registro mostra quem fez cada mudança.

## Viagem compartilhada (grupo) — 14/10/2026

- **Compartilhar:** botão na capa da viagem → "Criar link de convite" → link (`/?convite=código`) para copiar ou mandar no WhatsApp. A janela mostra quem está no grupo.
- **Entrar:** quem abre o link entra com o Google (como todo mundo no app) e vê "Fulano te chamou para a viagem X · N pessoas" → "Entrar no grupo". A viagem chega e abre; se uma pessoa da viagem tem o mesmo primeiro nome da conta, ela já fica como "sou eu".
- **Todo mundo do grupo vê e edita tudo.** O registro mostra quem fez cada mudança (nome da conta).
- **Bolinhas do grupo** na capa (como no Excel): iniciais de quem está no grupo; duas letras quando duas pessoas começam igual ("Ma", "Mo"); nome e sobrenome quando o nome é igual.
- **Sincronização:** cada mudança feita no aparelho entra numa fila e vai para o grupo (sem internet, espera). O banco só aceita se a versão for a mesma; se outra pessoa salvou antes, o app busca a versão dela e refaz as mudanças da fila por cima (ninguém perde despesa). Em tempo real, as mudanças dos outros aparecem sozinhas.
- Código: `src/sync/groups.ts` (Supabase), `src/state/tripState.ts` (fila, versões, `replay`), `src/ui/viagem/useTripSync.ts`, `ShareSheet.tsx`, `src/core/initials.ts`. Testado com testes automáticos e no navegador com um Supabase simulado (duas contas, conflito de versão).
- **Ainda não:** Rolê compartilhado (próximo passo), sair do grupo/tirar alguém, trocar o link, expiração de 90 dias.

## Rolê compartilhado (grupo) — 14/10/2026

- **Igual à Viagem:** botão de compartilhar na capa do rolê (ao lado da câmera) → link de convite; quem entra vê as despesas e pode adicionar e editar; registro com o nome de quem fez; bolinhas com as iniciais de quem está no grupo.
- **O que vai para o grupo:** a conta (pessoas, notas, itens, serviço, quem pagou, quem já pagou, acertos), o registro e a data. **Fica só no aparelho:** a foto do rolê e das notas (só quem tirou vê) e a nota aberta.
- **Entrar pelo convite:** o link abre na área certa (Rolê ou Viagem) sozinho. Ao entrar num rolê, a conta que estava aberta vai para Rolês (nada se perde). Indo para Rolês e reabrindo, o rolê continua ligado ao grupo.
- **Capa do rolê:** a data foi para baixo do nome (como na Viagem), para os botões caberem ao lado no celular.
- Código: `src/state/billState.ts` (`shared`, fila, `replayRole`), `src/ui/useBillSync.ts`, `src/ui/useInvite.tsx` (convite comum às duas áreas), `ShareSheet` comum. Testado com testes automáticos e no navegador com Supabase simulado.

## Rolê: X para apagar nota fiscal — 14/10/2026

- Cada nota na faixa de notas tem um X no canto (com confirmação). Antes, a última nota não podia ser apagada e ficava presa mesmo sem despesas. Agora, apagar a última (ou a conta de uma nota só) tira os itens, quem pagou, quem já pagou e os acertos; as pessoas e o nome da conta ficam.

## Viagem: nota fiscal na despesa e bloco de notas — 14/10/2026

- **Na despesa (etapa 1):** "Nota fiscal" com câmera ou galeria. O app lê o total no próprio celular (mesmo leitor do Rolê) e preenche o valor; se já tinha valor diferente, oferece "Usar esse valor"; se não leu, pede para digitar. A foto fica guardada na despesa (X para tirar). Registro: "Adicionou a nota fiscal de X".
- **Viagem compartilhada:** a foto vai para o Supabase Storage (balde privado `notas`, pasta do grupo; só quem é do grupo vê e envia — `supabase/migrations/20261015_notas.sql`). Quem não tirou baixa uma vez e guarda no aparelho. Sem internet, a foto sobe depois.
- **Bloco "Notas fiscais (N)"** na caderneta: todas as notas da viagem, separadas por categoria (com o total de cada uma); tocar abre a nota grande.
- Na lista de despesas, a que tem nota mostra "nota".

## Ajustes de notas, filtros e grupo — 14/10/2026

- **Rolê, conta vazia:** sem "Nota 1 · R$ 0,00"; só o botão "Adicionar nota". Com uma nota, ele vira "Outra nota". A primeira nota numa conta vazia não cria mais uma nota vazia antes dela (e pega o serviço da conta).
- **Rolê, tocar numa nota com foto:** abre a nota fiscal, com **Baixar** e **Compartilhar**. "Baixar nota" também nas notas da Viagem.
- **Notas fiscais (N)** também no Rolê (em Pedidos, abaixo da faixa de notas), por categoria. As fotos do Rolê continuam só no aparelho de quem tirou.
- **Viagem:** cartão "Ler nota fiscal" na caderneta (também com ela vazia), que abre a despesa nova já com a nota e o total lido.
- **Rolê, filtros** nos itens (como na Viagem): Quem e Divisão (Individual, Dividido, Sem ninguém), com total e "Limpar filtros".
- **Grupo:** além do tempo real, o app confere o grupo a cada 15 s e ao voltar para ele; avisa "Fulano entrou no grupo"; a janela de compartilhar mostra se há mudanças suas esperando para enviar.

## Grupo: nunca desligar sozinho — 14/10/2026

- **Problema:** quando o Supabase respondia "não achei este grupo para você" (por um instante, ex.: sessão do Google sendo renovada), o app desligava a viagem/rolê do grupo sem avisar. Daí em diante, as mudanças daquele celular não iam para ninguém (e as bolinhas do grupo sumiam). Foi o caso do nome da viagem que não mudou.
- **Agora:** o app nunca desliga sozinho. Mostra o erro na janela de compartilhar ("Não deu para falar com o grupo…"), com "Atualizar agora", a hora da última conferência e se há mudanças suas esperando. Dados do grupo que o app não reconhece também viram aviso (antes eram ignorados em silêncio).
- **Quem já ficou desligado:** abrir o link de convite de novo religa (a viagem do grupo substitui a do aparelho).

## Grupo sem tempo real (polling) — 14/10/2026

- **Por quê:** o plano grátis do Supabase limita as conexões de tempo real (200 simultâneas), e não precisamos ver a mudança no mesmo segundo.
- **Como fica:** cada mudança vai direto para o banco (com a conferência de versão). Os outros aparelhos buscam a versão nova **a cada 20 s, só com o app na tela**, e na hora em que a pessoa volta para o app (ou a internet volta). "Atualizar agora" na janela de compartilhar busca na hora. Nenhuma conexão de tempo real é aberta.
- As tabelas continuam na publicação `supabase_realtime` (do SQL de 14/10); não faz diferença sem ninguém ouvindo.

## Fotos no grupo, lápis no Rolê e foto na Viagem (14/10/2026)

- **Fotos das notas do Rolê vão para o grupo.** Usam o mesmo balde `notas` do Supabase da Viagem (pasta do grupo, só membros veem). Não precisa de SQL novo. Cada aparelho envia as fotos que tirou uma vez; quem não tem a foto baixa do grupo ao abrir e guarda no aparelho.
- **Foto do cartão da Viagem.** Botão da câmera igual ao do Rolê. A foto fica na viagem (`photoId`) e, se a viagem é compartilhada, vai para a pasta do grupo: todo mundo vê o mesmo fundo. Entra no registro ("Adicionou/Trocou/Tirou a foto da viagem").
- ~~A foto do cartão do Rolê continua só no aparelho~~ → mudou no mesmo dia, ver abaixo.
- **Lápis no cartão do Rolê.** Abre "Editar rolê" com o nome do lugar (o mesmo campo de Pedidos, que continua lá).
- **Segurança:** só nomes de foto do app (letras e números) viram caminho no Storage; nada de "/" ou "..".
- **Tela estreita:** com os pontinhos do grupo e três botões, os botões descem para baixo do nome em vez de quebrar o nome no meio.

## Respiro no celular (14/10/2026)

- De 360px a 430px de largura, os espaços crescem com a tela: margem da página (16 → 22px), distância entre blocos, espaço dentro dos cartões, entre os botões do topo e do cartão, e entre as pessoas da lista. Abaixo de 360px e no computador, nada muda.
- A margem da página virou uma variável (`--gutter`), e as barras de ponta a ponta (botão da base, notas do Rolê) seguem ela.
- "Racha Conta" no topo: aparece só quando cabe ao lado dos botões (depende da tela e do tamanho de fonte do celular). Quando não cabe, fica só o logo, como já acontecia nas telas pequenas.
- Subtítulos "bar e restaurante" / "vários dias" quebram em duas linhas em vez de serem cortados.
- No toque, a aba tocada antes ficava cinza (o efeito de passar o mouse grudava). Corrigido.
- Conferido sem rolagem para o lado em 320, 360, 375, 390, 412 e 430px, com fonte normal, 112,5% e 130%.

## Foto do cartão do Rolê no grupo (14/10/2026)

- A foto do cartão do Rolê agora vai junto com o rolê compartilhado (campo `photoId` no que vai para o grupo) e para a pasta do grupo no Storage, como na Viagem. Todo mundo vê a mesma foto; trocar ou tirar vale para todos e entra no registro.
- Grupo criado antes desta mudança (sem o campo): a foto que já estava no aparelho continua, não é apagada pela versão do grupo.
- O nome da foto vindo do grupo é conferido (só letras e números); se vier estranho, a versão é recusada.

## Abas com espaço igual (14/10/2026)

- As abas (Pessoas · Despesas · Saldos, e Mesa · Pedidos · Divisão) tinham 1/3 da largura cada, com o conteúdo no meio: como os textos têm tamanhos diferentes, o espaço entre uma aba e outra ficava desigual. Agora cada aba cresce a partir do próprio conteúdo, e o espaço entre elas fica igual (medido em 320, 360, 412 e 430px).
- Ícone da aba mais afastado do texto (8px; 5px em tela pequena).
- Lembrete: o app instalado só troca de versão depois de tocar em "Atualizar" no aviso do topo.

## Foto do grupo que não aparecia (14/10/2026)

- Defeito: o aparelho tentava baixar a foto do grupo uma vez só. Se a outra pessoa ainda estava enviando, a foto nunca aparecia (até reabrir o app). Agora tenta de novo: 0,4 s, 5 s, 15 s, 30 s, 1 min e 2 min.
- Do lado de quem tirou: se o envio da foto falhar (sinal fraco), tenta de novo em 8 s, em vez de esperar outra mudança.

## Grupo que "soltou", nome da conta, foto na estante e nas bolinhas (14/10/2026)

- Investigação do celular que parou de receber as mudanças: na versão atual, sair e entrar na conta, sessão negada por um tempo e abrir o link de novo mantêm a viagem ligada ao grupo (teste com dois aparelhos). Também 300 sequências sorteadas de ações não quebram a viagem ao fechar e abrir o app (teste automático `tripReload.test.ts`). A causa mais provável é a versão antiga no celular dele (antes da correção que parou de desligar a viagem quando o grupo não respondia).
- Achado no caminho: quem entrava pelo convite ia para a área certa (Viagem), mas o app não guardava; na próxima abertura voltava para o Rolê e parecia que a viagem tinha sumido. Agora guarda.
- Criar viagem logado: não pergunta mais "Seu nome"; usa o primeiro nome da conta. Sem login, o campo continua.
- Estante "Suas viagens": o cartão mostra a foto da viagem (inclusive a que outra pessoa do grupo pôs).
- Bolinhas do grupo: mostram a foto da conta (Google) de cada pessoa; sem foto, ou se não carregar, as iniciais.

## Foto da conta em todas as bolinhas de pessoa (14/10/2026)

- As bolinhas de pessoa (lista, quem pagou, extrato, mesa, pilha do cartão…) mostram a foto da conta Google de quem é do grupo.
- Como as pessoas da conta são nomes digitados, a ligação é pelo nome (`core/faces.ts`, com testes): "Rebeca" combina com a conta "Rebeca Oliveira" (primeiro nome ou nome inteiro, sem ligar para acento e maiúscula). Na dúvida (duas "Ana" na mesa, ou duas contas "Ana …"), fica a inicial: nunca a foto de outra pessoa.
- Na Viagem, "você" (a pessoa deste aparelho) sempre ganha a foto da própria conta, mesmo sem grupo.
- Só endereços https; se a foto não carregar, volta a inicial.

## Viagem: convite certo, quem entra vira pessoa da viagem e "Assumir despesas" (14/10/2026)

- **Defeito do convite errado:** criar (ou apagar) uma viagem apagava, neste aparelho, a ligação de **todas** as viagens com os grupos (e o nome de quem fez). A viagem anterior ficava solta: as mudanças dela não iam para ninguém, e compartilhar de novo criava outro grupo com outro link, deixando quem tinha o link antigo num grupo abandonado. Agora criar/apagar mexe só na viagem criada/apagada; cada viagem fica com o seu link. Teste: `state/tripShare.test.ts` e `sync/tripEngine.test.ts`.
- **Copiar link:** se o celular recusar a área de transferência, copia pelo campo do link; se nem assim, avisa. O aviso diz de qual viagem é o link ("Link de Praia copiado"), para não colar por engano o de outra viagem que estava copiado antes.
- **Quem entra no grupo participa da viagem:** ao entrar pelo convite, a pessoa vai para Pessoas (com o primeiro nome da conta) e vira "você" no celular dela. Se já havia alguém com o nome dela anotado antes ("Bia" ↔ conta "Bia Souza"), liga a essa pessoa em vez de duplicar. Na dúvida (duas "Ana"), entra como pessoa nova com o nome inteiro.
- Quem entrou antes desta versão (está no topo, mas não em Pessoas) é adicionado quando o grupo é conferido. Quem criou o grupo só é ligado pelo próprio celular (só ele sabe qual pessoa é).
- Cada conta ganha o seu lugar **uma vez só** (`joined` na viagem): se for tirada depois, não volta sozinha. A pessoa guarda a conta (`userId`); o "você" segue a conta se a pessoa guardada sair.
- Quem chega depois pode ser marcado nas despesas de antes (editar a despesa) e já vem marcado nas novas.
- **Assumir despesas de outra pessoa:** tocar numa pessoa → "Assumir despesas de outra pessoa" → escolher de quem. Tudo o que está no nome da outra (o que pagou, o que consumiu, acertos e de quem ela paga a parte) passa para esta; nenhum valor muda. "Tirar X da viagem" vem marcado quando X é só um nome anotado e desmarcado quando X tem conta no grupo. Ao juntar, se quem sai tinha conta e quem fica não, a conta passa para quem fica.
- **Motor separado da tela:** `src/sync/tripEngine.ts` (enviar fila, buscar, entrar pelo convite, pôr membros na viagem). O `useTripSync` só chama ele. Testes de integração com um servidor de mentira que confere a versão como o `save_group`, com 3 celulares, sem internet, conflitos e sorteio de 40 sequências.
- Versões antigas do app aceitam viagens com os campos novos (`userId`, `joined`): não precisa de SQL novo.

## Rolê: quem entra no grupo vai para a mesa (14/10/2026)

- Mesma regra da Viagem: ao entrar pelo convite, a pessoa vai para a mesa com o primeiro nome da conta (ou é ligada a quem já tinha o nome dela, sem duplicar). Entra nas notas que eram de todo mundo, como quem é adicionado à mão; nos itens de antes, só se alguém marcar.
- Quem entrou antes desta versão é adicionado quando o grupo é conferido. Cada conta uma vez só (`joined` na conta): tirada da mesa, não volta sozinha.
- Quem criou o rolê não é adicionado sozinho: no Rolê não há "sou eu", e quem cria normalmente já se pôs na mesa (às vezes com outro nome).
- Motor separado da tela: `src/sync/roleEngine.ts` (enviar, buscar, quem entrou). Testes em `sync/roleEngine.test.ts`, com 3 celulares e conflito de versão.
- Conferido no navegador (Supabase simulado, duas contas), na Viagem: quem entra aparece em Pessoas nos dois celulares, em "Quem pagou?" e "Quem participa?" da despesa nova, e a despesa divide com ela. Quem já estava no grupo sem estar em Pessoas é adicionado na conferência seguinte.

## Foto da pessoa pela conta, não só pelo nome (14/10/2026)

- **Defeito:** a foto era escolhida só pelo nome. Uma "Rebeca" criada à mão por outra pessoa podia pegar a foto da Rebeca de verdade; e quem marcava "Sou eu" na pessoa errada punha a própria foto nela.
- **Agora:** a pessoa ligada a uma conta do grupo usa sempre a foto dessa conta. Pelo nome, só ganha foto quem não está ligado a ninguém, e só de uma conta que ainda não é de ninguém. A foto de "você" só vale numa pessoa sem conta ou ligada à sua. Vale para Viagem e Rolê (`core/faces.ts`, com testes).
- Conferido no navegador com duas contas com foto: cada uma mantém a sua; a "Rebeca" criada à mão fica com a inicial, também depois de "Sou eu" na pessoa errada.

## Estante: três pontinhos para excluir a viagem (14/10/2026)

- Cada cartão de "Suas viagens" tem três pontinhos no canto superior direito. Tocar abre a confirmação "Excluir …? Todas as despesas e acertos são apagados." (viagem compartilhada: "Para quem está no grupo, a viagem continua."). Igual ao "Apagar viagem" de dentro da viagem, que continua lá.
- Os pontinhos ficam por cima do cartão (que é um botão inteiro); o topo do cartão abre espaço para eles não cobrirem as datas. No cartão com foto, ficam brancos com fundo escuro.

## "Quem é você?" ao entrar no grupo: nome igual não liga mais sozinho (14/10/2026)

- **Problema:** o app ligava quem entrava pelo convite à pessoa anotada com o mesmo nome. Com duas Rebecas diferentes, a que entrava tomava o lugar (despesas e foto) da anotada.
- **Agora (Viagem e Rolê):** logo depois de "Entrar no grupo", aparece "Quem é você nesta viagem?" (ou "neste rolê?"), com as pessoas que ainda não são de nenhuma conta e "Pessoa nova", que já vem marcada. Quem tem o mesmo nome aparece primeiro, com "mesmo nome", só como sugestão. Não fecha sem escolher. Sem ninguém para escolher, entra direto como pessoa nova. Na pergunta, as pessoas aparecem só com a inicial (a foto pelo nome é justamente o palpite que pode estar errado).
- **Pessoa nova com nome repetido:** primeiro nome; se já existe, com a inicial do sobrenome ("Rebeca O."); se ainda repete, o nome inteiro.
- **Quem não responde:** os outros aparelhos esperam 10 minutos e então a põem como pessoa nova (marcada como provisória). Quando ela abre o app, a pergunta continua; se escolher uma pessoa anotada e a provisória ainda não tem nada no nome, a provisória sai. Quem entrou com o app antigo segue o mesmo caminho.
- **Quem criou o grupo** não é perguntado: na Viagem é o seu "sou eu"; no Rolê não é adicionado (já está na mesa).
- Errou a escolha: "Assumir despesas de outra pessoa" continua resolvendo.
- Conferido no navegador (Viagem, três contas): a outra Rebeca entra como "Rebeca O." e a anotada continua sem foto e com as despesas dela; a Bia escolhe a "Bia" anotada e fica com ela.

## Grupos na conta, em qualquer aparelho; link do convite e o app instalado (14/10/2026)

- **Problema:** quem entrava num grupo pelo navegador do celular (o link do WhatsApp abre o navegador) não via a viagem no app da tela inicial: cada lugar guardava só o que tinha acontecido nele.
- **Agora:** ao abrir (e a cada minuto, e ao voltar para o app), o app busca todos os grupos da conta logada. As viagens que faltam aparecem em "Suas viagens" e os rolês em "Rolês", já ligados ao grupo, em qualquer lugar: app instalado, navegador do celular, computador. As viagens que já estão ficam em dia. Viagem que tinha ficado solta do grupo (mesmo id) volta a ficar ligada (a versão do grupo vale). O "você" segue a conta.
- **Excluir viagem ou rolê compartilhado** vale para a conta: some de todos os aparelhos dela (a lista fica nos dados da conta no Supabase, `hidden_groups`; sem tabela nova). Para o grupo, continua. Sem internet, vale no aparelho na hora e vai para a conta depois. Entrar de novo pelo convite tira da lista.
- **Link abrindo o app:** no iPhone não é possível (o iOS sempre abre links no Safari). No Android, com o app instalado pelo Chrome, o manifesto pede que links do site abram no app (`handle_links`, `launch_handler`). Quem entra pelo navegador do celular vê "Ela já aparece também no app Racha Conta da sua tela inicial".
- Avisos longos ficam mais tempo na tela (proporcional ao texto).
- Testes: `syncAdopt` (state/tripShare), `adoptRoles` (sync/roleEngine), lista de excluídos (state/hiddenGroups) e integração com a mesma conta em dois aparelhos (sync/tripEngine). Conferido no navegador com Supabase simulado: entra pelo navegador, aparece no "atalho"; exclui no atalho, some do navegador.

## Versão nova do app troca sozinha (14/10/2026)

- **Antes:** aparecia o aviso "Versão nova do app" com o botão Atualizar, e nem todo mundo sabia que precisava tocar.
- **Agora:** sem aviso e sem botão. Quando a versão nova termina de baixar, o app troca sozinho num momento em que nada se perde: na hora, se não há janela aberta (lançando uma despesa, por exemplo) nem alguém digitando; senão, assim que a janela fecha ou a pessoa sai do app. O que já foi salvo, inclusive mudanças que ainda vão para o grupo, fica guardado e segue depois da troca.
- O app confere se há versão nova ao voltar para a tela e de hora em hora com ele aberto.
- Quem ainda está numa versão anterior a esta vê o aviso antigo uma última vez (ou recebe a nova ao fechar e abrir o app).
- Conferido com um servidor de produção local: com o convite de instalar aberto, a versão nova esperou; ao fechar, trocou em segundos. Sem janela aberta, trocou direto.

## Sem "Atualizar agora": o grupo é conferido sozinho (15/10/2026)

- Saiu o botão "Atualizar agora" da janela de compartilhar (Viagem e Rolê). O app já confere o grupo a cada 20 s com ele na tela, ao voltar para ele e quando a internet volta; agora também **toda vez que a janela de compartilhar abre** (era o que o botão fazia).
- As mensagens de erro do grupo deixaram de pedir "tente Atualizar agora": dizem que o app tenta de novo sozinho.
- Com a versão nova do app trocando sozinha (14/10), não sobra nenhum "Atualizar" para a pessoa tocar.

## "Você paga a parte de alguém?" e convite que entra sozinho (15/10/2026)

- **Quem entra pelo convite** (Viagem), logo depois de "Quem é você nesta viagem?", responde **"Você paga a parte de alguém?"**: marca uma ou mais pessoas (os filhos, por exemplo) ou "Não, só a minha parte". As despesas continuam no nome de cada pessoa; no acerto, a parte delas entra na conta de quem paga (o mesmo "Quem paga" que já existia em cada pessoa). Dá para mudar depois, tocando na pessoa.
- Pergunta **uma vez por conta**, em qualquer aparelho (a viagem guarda quem já respondeu, `payAsked`). **Quem entrou antes desta pergunta existir também é perguntado uma vez** ao abrir a viagem: é o jeito de ajustar os grupos que já existem. Quem criou o grupo não é perguntado (ele mesmo monta a viagem).
- **Convite com a conta já aberta entra sozinho**, sem o "Entrar no grupo". Se a pessoa já está naquela viagem (clicou no link de novo), a viagem só abre. A janela do convite só aparece quando não deu (convite que não vale mais, ou sem internet, com "Tentar de novo"). Vale para Viagem e Rolê.
- **Login automático:** a tela de login também abre a janelinha do Google "Continuar como Fulano"; quem já entrou no app com aquela conta Google entra sozinho. Isso ajuda quando o link abre num navegador em que o app ainda não estava logado. No iPhone, o app da tela inicial e o Safari não dividem a sessão: o primeiro acesso por um deles ainda passa pelo Google, mas sem precisar digitar nada.
- Testes: `payFor` (core/tripJoin) e integração com dois celulares (sync/tripEngine): o Robin entra, paga a da Lara e o acerto vai para ele; quem entrou antes é perguntado uma vez; quem criou não é. Conferido no navegador com Supabase simulado.
- Ajuste (15/10/2026): **toda lista de escolher pessoa mostra todo mundo, em linhas.** Antes rolava para o lado sem barra, e quem ficava fora da tela parecia não estar na lista (no teste real, a Clari sumiu de "Você paga a parte de alguém?"). Vale para: "Quem é você", "Você paga a parte de alguém?", "Quem pagou" (despesa da viagem, divisão do rolê e nota), "De quem são as despesas" e "Quem fica com as despesas". A faixa de várias notas fiscais do rolê também passou a quebrar em linhas. Conferido com 12 pessoas no celular: ninguém fora da tela.

## Foto numa despesa que já existe (15/10/2026)

- **Antes:** o "Ler nota fiscal" sempre abria uma despesa nova. Para guardar a nota (ou um comprovante) numa despesa já lançada, era preciso abrir a despesa e passar pelas etapas.
- **Agora:** depois de tirar ou escolher a foto, o app pergunta **"Onde guardar esta foto?"**: **Criar uma despesa nova** (como antes, lendo o total) ou tocar numa **despesa que já existe**. Serve para nota fiscal que chegou depois, comprovante, print do extrato do banco.
- Guardar numa despesa existente **não muda mais nada nela** (valor, divisão, quem pagou, saldos); só a foto. Se a despesa já tinha foto, a lista avisa "troca a foto atual". O aviso tem "Desfazer". Fica no registro ("Adicionou a nota fiscal de Aluguel") e vai para o grupo como as outras mudanças.
- A lista mostra primeiro as despesas que você pagou, depois as outras, da mais nova para a mais antiga. Sem nenhuma despesa na viagem, vai direto para a despesa nova.
- Testes: `setExpenseReceipt` (core/tripJoin) e integração com dois celulares (sync/tripEngine). Conferido no navegador: guardar, desfazer e criar nova.
