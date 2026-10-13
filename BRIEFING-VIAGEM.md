# Racha Conta — aba "Viagem" (briefing para o Claude Code)

> Decisões tomadas depois deste briefing (nomes Rolê/Viagem, família como participante, acerto exato até 15 pessoas, extras da v1 etc.) estão em `DECISOES.md`, que tem prioridade.

Este briefing **complementa** o `BRIEFING.md` principal do Racha Conta. Tudo que está lá continua valendo: nome, ícone, identidade visual, stack (Next.js + Supabase), regras de centavos, PWA e a ordem "modo solo primeiro, modo compartilhado depois". Aqui eu só descrevo o que é novo: uma segunda aba, voltada para despesas de viagem em grupo.

**Antes de escrever código, leia tudo, me faça as perguntas da seção 11 e aguarde as minhas respostas e os prints de design.**

---

## 1. Contexto de negócio

**Situação real:** no fim do ano eu, minha irmã e nossas famílias vamos viajar juntos. Uma pessoa paga a hospedagem (Airbnb), outra paga o mercado, outra o combustível, outra os passeios. No final, todo mundo deve algo para alguém, e ninguém quer fazer essa conta numa planilha ou numa discussão de WhatsApp.

**Problema:** numa viagem longa, as despesas se espalham por vários dias e várias pessoas pagam coisas diferentes. Sem controle, as pessoas esquecem o que pagaram, alguém paga mais do que devia e o acerto final vira desconforto.

**Solução:** uma aba "Viagem" onde o grupo registra cada despesa (quem pagou, quanto, e quem participou). O app mantém o saldo de cada pessoa durante a viagem e, no final, diz o **menor número possível de pagamentos** para deixar todo mundo quites.

**Por que é bom para o produto:**
- A viagem é um uso diferente da mesa de bar: dura dias, tem mais valor em jogo e envolve a família inteira. É um motivo forte para as pessoas instalarem o app e voltarem a abri-lo.
- Cada viagem tem um grupo fixo de pessoas, e esse grupo vê o produto várias vezes por dia. Isso gera divulgação natural.
- Tenho um prazo real: preciso usar na viagem do fim do ano. Prefiro uma versão simples e confiável a tempo, e não uma versão completa atrasada.

**Analogia para guiar as decisões:** a viagem é um **caixa comum de grupo**. Cada vez que alguém paga algo, é como se tirasse dinheiro do próprio bolso para o caixa, e cada vez que alguém consome, é como se tirasse do caixa. No final, quem colocou mais do que tirou recebe, e quem tirou mais do que colocou paga.

---

## 2. Estrutura do produto: duas abas

O Racha Conta passa a ter duas áreas, escolhidas por uma navegação clara no topo (no celular, preferir barra de abas fácil de alcançar com o polegar):

- **Mesa:** o que já existe. Uma conta de restaurante ou bar, dividida por consumo, resolvida em uma única ocasião.
- **Viagem:** novo. Despesas de vários dias, pagas por várias pessoas, com saldo e acerto no final.

Os nomes "Mesa" e "Viagem" são provisórios. Sugira alternativas se achar melhores. A navegação precisa deixar óbvio que as duas fazem parte do mesmo produto, com a mesma identidade visual.

Os dados das duas áreas devem ser independentes (apagar uma conta de mesa não mexe em nenhuma viagem), mas a lógica de dinheiro em centavos deve ser **compartilhada** no código, para não existir duas implementações diferentes de divisão.

---

## 3. Conceitos do produto (vocabulário que a interface deve usar)

1. **Viagem:** um grupo de pessoas, com nome (ex.: "Réveillon 2027"), datas e uma moeda.
2. **Participante:** cada pessoa da viagem. Tem nome, cor (as mesmas 6 cores do app) e um **peso**, que explico abaixo.
3. **Família (grupo opcional):** participantes podem ser agrupados em famílias, só para facilitar a visualização e a divisão ("Família da Ana", "Família da Bia"). Nada impede quem preferir tratar todos como indivíduos.
4. **Peso:** quanto da despesa aquela pessoa assume. Padrão 1. Uma criança pode ter 0,5, ou 0 se for o caso de ninguém cobrar por ela. Serve para a divisão "proporcional ao peso".
5. **Despesa:** um gasto lançado por alguém. Tem descrição, valor, data, categoria, **quem pagou** e **como foi dividido**.
6. **Divisão:** a regra de quem deve quanto naquela despesa. Três formas:
   - **Igual entre os selecionados** (padrão).
   - **Por peso** (usa o peso de cada participante).
   - **Valores exatos** (ex.: Ana R$ 100, Bia R$ 50). O app avisa se a soma não bater com o valor total.
7. **Saldo:** o quanto cada pessoa já pagou menos o quanto ela deve. Positivo significa "tem a receber". Negativo significa "tem a pagar".
8. **Acerto:** um pagamento real entre duas pessoas para diminuir o saldo (ex.: "Caio pagou R$ 1.072,48 para Ana"). Fica registrado e conta no saldo.

---

## 4. Funcionalidades

### Versão 1 (prioridade máxima, precisa estar pronta antes da viagem)

1. **Criar viagem:** nome, datas opcionais e moeda (padrão BRL).
2. **Participantes:** adicionar, renomear e remover pessoas. Definir peso (padrão 1) e família (opcional). Remover alguém que já tem despesas deve ser bloqueado ou exigir uma decisão clara. Nunca apagar o histórico em silêncio.
3. **Lançar despesa:** descrição, valor, data (padrão hoje), categoria, quem pagou, quem participa e a forma de divisão (igual, por peso ou valores exatos). O formulário precisa ser **rápido no celular**, porque será usado na hora, na rua, com uma mão.
4. **Categorias:** hospedagem, alimentação, mercado, transporte, combustível, passeios, compras e outros. Cada uma com ícone simples e cor neutra. O usuário pode editar o nome, mas não precisa criar categorias novas na v1.
5. **Lista de despesas:** em ordem de data, com filtro por pessoa, categoria e dia. Cada item mostra quem pagou, quanto e quem participou. Editar e excluir (a exclusão pede confirmação dentro da página, nada de `confirm()` do navegador).
6. **Saldos:** painel simples com cada pessoa, quanto pagou, quanto deve e o saldo final (verde para quem recebe, vermelho/laranja para quem paga, sempre acompanhado de texto, nunca só cor).
7. **Acerto final:** a lista mínima de pagamentos para deixar todo mundo quite (algoritmo na seção 5). Cada linha diz "Fulano paga R$ X para Beltrano".
8. **Registrar acerto:** marcar um pagamento da lista como feito, e ele passa a contar no saldo.
9. **Resumo para WhatsApp:** botão para copiar/abrir no WhatsApp com o estado atual (saldos ou acerto final), no formato da seção 8.
10. **Totais:** gasto total da viagem, gasto por pessoa (quanto cada um consumiu de verdade) e gasto por categoria.

### Versão 2 (depois, mas não bloquear no desenho)

- **Parcelamento:** quando alguém parcela um gasto no cartão (ex.: hospedagem em 5x), registrar o plano de reembolso em parcelas com vencimentos, e lembrar quem deve pagar o quê em cada mês.
- **Múltiplas moedas:** despesa em moeda estrangeira com cotação informada manualmente, convertida para a moeda da viagem.
- **Orçamento:** meta de gasto por categoria, com aviso ao chegar perto do limite.
- **Anexar comprovante:** foto do comprovante ligada à despesa.
- **Exportar** o relatório da viagem em PDF ou planilha.
- **Chave Pix** de cada pessoa visível apenas para os participantes, para facilitar o acerto.

---

## 5. Regras de negócio e de cálculo (o dinheiro precisa bater ao centavo)

1. **Tudo em centavos inteiros.** Nunca usar número com vírgula para somar dinheiro. Reaproveite a mesma lógica de arredondamento do modo Mesa.
2. **Divisão igual entre N pessoas:** cada uma paga `floor(valor / N)`, e os centavos que sobram são distribuídos 1 a 1, **rotacionando o ponto de partida entre despesas**, para a mesma pessoa não pagar o centavo extra sempre.
3. **Divisão por peso:** cada pessoa paga proporcional ao seu peso, usando o **método do maior resto** para a soma dar exatamente o valor da despesa. Pesos devem aceitar decimais simples (0, 0,5, 1, 1,5, 2).
4. **Valores exatos:** a soma precisa ser igual ao valor da despesa. Se não for, o app mostra a diferença e **não salva** até corrigir.
5. **Saldo de uma pessoa** = tudo que ela pagou − tudo que ela deve (considerando os acertos já registrados). **A soma dos saldos de todos é sempre zero, ao centavo.** Isso deve ser verificado em testes automáticos e, se algum dia falhar em produção, o app mostra um aviso claro em vez de números errados.
6. **Acerto mínimo:** o objetivo é o menor número possível de pagamentos. Use um algoritmo guloso: ordene os devedores e os credores, pague o maior devedor ao maior credor até zerar um dos dois, e repita. Explique em linguagem simples por que isso não garante sempre o mínimo absoluto, mas é suficiente na prática para grupos de até uns 20 participantes. Se achar que vale um algoritmo melhor, proponha antes de implementar.
7. **Acerto registrado** reduz o saldo de quem pagou e de quem recebeu, e nunca altera as despesas originais.
8. **Editar ou excluir uma despesa** recalcula tudo na hora. Quando já existirem acertos registrados, avisar que os saldos mudaram.
9. **Remover participante:** só é permitido se ele não aparece em nenhuma despesa, ou se eu escolher explicitamente para quem passar as despesas dele. Nunca apagar silenciosamente.
10. **Despesa sem participantes marcados** não pode ser salva.
11. **Quem pagou não precisa participar da divisão** (ex.: alguém pagou uma lembrança de presente para outra pessoa). O saldo trata isso corretamente.

### Exemplo de teste que precisa passar (números conferidos)

Cinco participantes: Ana, Bia, Caio, Duda e Edu, todos com peso 1.

- Ana pagou a hospedagem: **R$ 4.750,00**, dividida igualmente entre os cinco. Cada parte: **R$ 950,00**.
- Bia pagou o mercado: **R$ 612,40**, dividido igualmente entre os cinco. Cada parte: **R$ 122,48**.
- Cada pessoa deve, no total, **R$ 1.072,48**.
- Saldos: Ana **+R$ 3.677,52**, Bia **−R$ 460,08**, Caio **−R$ 1.072,48**, Duda **−R$ 1.072,48**, Edu **−R$ 1.072,48**. A soma é **zero**.
- Acerto mínimo: Caio, Duda e Edu pagam **R$ 1.072,48** cada um para Ana, e Bia paga **R$ 460,08** para Ana. São 4 pagamentos, e Ana recebe **R$ 3.677,52** no total.

Outros testes obrigatórios:
- R$ 100,00 dividido entre 3 pessoas: partes de R$ 33,34, R$ 33,33 e R$ 33,33, somando exatamente R$ 100,00.
- Hospedagem de R$ 6.000,00 com cinco adultos de peso 1 e duas crianças de peso 0,5: cada adulto assume R$ 1.000,00 e cada criança R$ 500,00, somando exatamente R$ 6.000,00.
- Despesa com valores exatos cuja soma não bate: deve ser recusada com mensagem clara.
- Remoção de participante que já tem despesas.
- Acerto registrado e depois uma despesa editada.
- Muitas despesas pequenas, para provar que o centavo extra rotaciona.

---

## 6. Compartilhamento e permissões (viagem é compartilhada por natureza)

Uma viagem só faz sentido se várias pessoas puderem lançar despesas. Por isso, **a aba Viagem depende do modo compartilhado** (Supabase) definido no briefing principal, com estas adaptações:

- **Mesmas permissões:** dono, editor e só leitura, impostas no banco de dados e não só na tela.
- **Entrada pelo link, sem senha:** a pessoa digita o nome e o aparelho guarda a identificação. Se o nome digitado já existir na lista de participantes, o app pergunta "você é este participante?" para evitar duplicatas.
- **Quem pode editar o quê:** proponha uma regra simples e segura. Minha sugestão: cada editor pode editar e excluir **só as despesas que ele mesmo lançou**, e o dono pode editar qualquer uma. Quero sua opinião sobre isso.
- **Histórico de alterações:** toda despesa criada, editada ou excluída registra **quem fez e quando**, e o dono consegue ver isso. Em dinheiro entre família, esse registro evita briga.
- **Expiração diferente da Mesa:** a Mesa expira em poucos dias, mas uma viagem dura semanas e o acerto pode acontecer depois dela. Proponha uma regra (por exemplo, expirar um tempo longo depois da última atividade, com aviso antes de apagar e a opção de exportar). Não use o mesmo prazo curto.
- **Recuperação do dono:** mesma solução do briefing principal, mas aqui é mais importante, porque a viagem dura mais tempo.
- **Modo solo da viagem:** quero também poder usar a aba Viagem **sozinha**, sem servidor, como "tesoureira" que lança tudo para o grupo e compartilha só o resumo no WhatsApp. É a versão que preciso garantir primeiro (ver seção 10).
- **Privacidade:** a viagem guarda nomes, valores e datas. Não guarde documentos, CPF nem dados de cartão. Se houver chave Pix (versão 2), ela deve aparecer só para participantes da viagem, nunca em links públicos, e ser opcional.

---

## 7. Modelo de dados (conceitual, sem código)

Desenhe com base nestas entidades, ajustando como julgar melhor e explicando as mudanças:

- **Viagem:** nome, datas, moeda, dono, data de expiração, estado (em andamento ou encerrada).
- **Participante:** viagem, nome, cor, peso, família (opcional), vínculo com o aparelho (opcional).
- **Despesa:** viagem, descrição, valor em centavos, data, categoria, quem pagou, forma de divisão, quem lançou, criada em, alterada em, excluída (marca de exclusão, e não remoção).
- **Parte da despesa:** despesa, participante, valor em centavos devido. Guardar o valor já calculado evita que mudar uma regra de arredondamento no futuro altere viagens antigas.
- **Acerto:** viagem, de quem, para quem, valor em centavos, data, quem registrou.
- **Histórico:** viagem, o que mudou, quem, quando.

Mantenha a lógica de cálculo (divisão, saldos, acerto mínimo) em um módulo separado da interface e do banco, com testes. O banco guarda os dados e aplica as permissões, mas **os cálculos são puros e testáveis sozinhos**.

---

## 8. Resumo para WhatsApp

Estado durante a viagem (saldos):

```
*Racha Conta* - Réveillon 2027
Gasto total: R$ 5.362,40

Saldos até agora:
- Ana: recebe R$ 3.677,52
- Bia: paga R$ 460,08
- Caio: paga R$ 1.072,48
- Duda: paga R$ 1.072,48
- Edu: paga R$ 1.072,48
```

Acerto final (quem paga quem):

```
*Racha Conta* - Réveillon 2027
Para ficar tudo quite:

- Caio paga R$ 1.072,48 para Ana
- Duda paga R$ 1.072,48 para Ana
- Edu paga R$ 1.072,48 para Ana
- Bia paga R$ 460,08 para Ana
```

(O formato é a referência. Os valores batem com o exemplo de teste.)

---

## 9. Design

- **Herde a identidade do Racha Conta:** nome, ícone, cores, tipografia e tema claro/escuro do briefing principal. A aba Viagem deve parecer parte do mesmo produto.
- **Aguarde meus prints de design** antes de decidir o visual final. Se eles pedirem uma mudança de visual, ela vale para as duas abas.
- **Ideia de assunto** (pode propor outra): a Mesa tem cara de nota de restaurante. A Viagem poderia ter cara de **caderneta de gastos da viagem**, mantendo o mesmo conjunto de fontes e cores.
- **Telas principais:** lista de viagens, dentro da viagem (despesas, saldos, acerto) e formulário de nova despesa.
- **Formulário de despesa:** o campo de valor vem primeiro e com teclado numérico. "Quem pagou" já vem preenchido com a minha pessoa. "Quem participa" já vem com todos marcados. O objetivo é lançar uma despesa comum em poucos toques.
- **Saldos legíveis:** positivo e negativo com texto ("recebe" e "paga"), nunca só cor.
- **Acessibilidade:** alvos de toque de pelo menos 44 px, foco visível, rótulos em todos os campos, `aria-live` nos avisos, nada de `alert()`, `confirm()` ou `prompt()`, e nenhuma rolagem horizontal em 400 px de largura.

---

## 10. Ordem de construção sugerida (tenho prazo: viagem no fim do ano)

Proponho esta ordem e quero sua opinião honesta sobre ela:

1. **Lógica de cálculo da viagem, com testes** (divisão, saldos, acerto mínimo), usando os exemplos da seção 5.
2. **Aba Viagem em modo solo** (dados no aparelho): criar viagem, participantes, despesas, saldos, acerto final e resumo no WhatsApp. **Isso já resolve a viagem do fim do ano**, com uma pessoa lançando tudo.
3. **Modo compartilhado da viagem** (Supabase): link, entrada por nome, tempo real, permissões, histórico e expiração.
4. **Versão 2:** parcelamento, múltiplas moedas, orçamento, comprovantes e exportação.

**Mudança em relação ao briefing principal:** a leitura de nota fiscal por foto (OCR) fica **depois** da aba Viagem, porque a viagem tem prazo e o OCR não. Se você discordar, explique o motivo.

---

## 11. Perguntas que quero que você responda antes de começar

1. A aba Viagem deve ser construída **antes** do modo compartilhado da Mesa, ou os dois compartilham a mesma infraestrutura? Qual é a menor quantidade de trabalho para ter a viagem funcionando compartilhada?
2. Qual é a melhor forma de organizar o projeto Next.js para duas áreas (Mesa e Viagem) com uma lógica de dinheiro compartilhada? Explique a estrutura em linguagem simples, já que meu forte é Angular.
3. Sobre os pesos e as famílias: o modelo da seção 3 serve para famílias com crianças, ou existe um jeito mais simples de eu e minha irmã dividirmos por família sem cadastrar peso para cada pessoa?
4. Para o "acerto mínimo", o algoritmo guloso é suficiente para o meu caso (algo como 6 a 10 pessoas)? Quando ele deixaria de ser?
5. Qual prazo de expiração você sugere para viagens, e como o dono exporta os dados antes de apagar?
6. Como evitar que duas pessoas lancem a mesma despesa ao mesmo tempo (por exemplo, a mesma conta do mercado)? Existe algum aviso simples de duplicata?
7. Sobre o parcelamento: quando eu paguei algo no cartão em 5x e cada um vai me reembolsar, vale tratar isso como uma despesa dividida entre as pessoas (versão 1) e deixar o plano de parcelas para a versão 2? Ou isso cria problema que eu deveria ver agora?

---

## 12. Como quero trabalhar com você

1. Responda às perguntas da seção 11 em linguagem simples, começando pelo motivo de negócio e só depois o detalhe técnico.
2. Use analogias quando explicar algo novo.
3. Entregue em passos pequenos, na ordem da seção 10, e me mostre o resultado de cada passo antes de seguir.
4. Peça confirmação antes de adicionar qualquer coisa fora da fase atual.
5. Se uma decisão minha criar um problema (de dinheiro, de segurança ou de prazo), **diga na hora**, mesmo que eu já tenha decidido.
6. Não deixe nenhum cálculo de dinheiro sem teste automático.
