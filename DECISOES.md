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
- **Tela de entrada (10/10/2026):** quem abre o app sem estar logado vê a tela de login (topo carmim com as bolhas da paleta Marple, moeda, frase do app e uma mini notinha flutuando; painel com o botão do Google, 3 benefícios e link da privacidade; no computador, lado a lado). Depois de entrar, abre o app; "Sair" volta para ela. É mostrada no próprio endereço (`AuthGate`), sem redirecionar, para não criar vai-e-volta com o app offline. Quem já entrou abre o app até sem internet (sessão guardada no aparelho). Sem as chaves configuradas (ex.: computador de desenvolvimento), o app abre direto. Na Fase 2, o link de convite passa por fora do portão. Enfeite do topo: uma nota fiscal de bar (serrilhada, letra de máquina, itens, serviço, total e código de barras) com a divisão por pessoa por cima, contando a história do app. No computador, a divisa entre o carmim e o painel é esfumada (gradiente), sem linha seca. No celular, o topo é mais baixo (logo ao lado do nome, desenho mais compacto; em telas curtas o desenho encolhe) para o botão do Google aparecer sem rolar, a partir de telas de 320×560. Tirei o texto embaixo de "Entrar" e, em telas de até 740 px de altura, aperto desenho, lista e espaços: a tela de login inteira cabe sem rolar no celular. O painel "Entrar" fica uns 15 px abaixo do selo "3/4 pagos" (antes encostava) e o "Só usamos seu nome…" vai para o pé da tela. O botão do Google na tela de login é retangular com cantos de 12 px (o Google só oferece "pílula" ou cantos de 4 px; o recorte e a borda fina são feitos no CSS) e usa sempre o tema branco com borda, porque no escuro o quadrado branco do "G" ficava torto no recorte.
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
