# Passo a passo: contas para o login com Google

Tempo: uns 40 minutos. Tudo no plano grátis. Faça nesta ordem, porque cada etapa usa um dado da anterior.

Anote num bloco de notas, à medida que aparecerem:

| O quê | Exemplo | É secreto? |
|---|---|---|
| Endereço do Supabase (Project URL) | `https://sfryqzzismqdruqzluge.supabase.co` | Não |
| Chave pública do Supabase (Publishable key) | `sb_publishable_...` | Não |
| Endereço do site na Vercel | `https://racha-conta-ebon.vercel.app` | Não |
| ID do cliente Google (Client ID) | `1234-abc.apps.googleusercontent.com` | Não |
| Senha do banco do Supabase | — | **Sim** |
| Segredo do cliente Google (Client Secret) | `GOCSPX-...` | **Sim** |
| Chave secreta do Supabase (Secret / service_role) | `sb_secret_...` | **Sim** |

Os itens "Não" podem ser enviados para mim: eles vão dentro do app, e qualquer pessoa consegue vê-los no navegador. A proteção dos dados é feita pelas regras do banco.
Os itens "**Sim**" nunca vão para o chat, para o código nem para o GitHub. O segredo do Google é colado só no painel do Supabase.

---

## 1. Supabase (banco, login e fotos)

1. Entre em **supabase.com** → **Start your project** → entre com GitHub ou e-mail.
2. **New project**
   - Organization: a sua (crie se pedir; plano **Free**).
   - Name: `racha-conta`
   - Database password: clique em **Generate a password** e guarde no seu gerenciador de senhas (**secreto**).
   - Region: **South America (São Paulo)**, para ficar mais rápido no Brasil.
   - **Create new project** e espere uns 2 minutos.
3. Menu **Project Settings → API Keys** (ou **Data API**):
   - Copie o **Project URL**.
   - Copie a **Publishable key** (começa com `sb_publishable_`). Se só aparecer a "anon public", serve também.
   - **Não** copie a "secret" nem a "service_role".

## 2. Vercel (onde o site fica no ar)

O login com Google exige um endereço fixo do site. Por isso criamos ele agora.

1. Crie uma conta no **github.com**, se ainda não tiver.
2. Entre em **vercel.com** → **Sign Up** → **Continue with GitHub** → plano **Hobby** (grátis).
3. Por enquanto, só **escolha o nome do projeto** e anote o endereço: `https://NOME.vercel.app` (ex.: `racha-conta-ebon.vercel.app`). A publicação do código eu faço com você depois: crio o repositório e você só clica em **Import**.

> Se tiver um domínio próprio (ex.: `rachaconta.com.br`), dá para usar depois. Comece com o `.vercel.app`.

## 3. Google Cloud (o botão "Entrar com Google")

1. Entre em **console.cloud.google.com** com o seu Gmail.
2. No topo, **Selecionar projeto → Novo projeto** → Nome: `Racha Conta` → **Criar**. Confira se ele ficou selecionado no topo.
3. No menu, procure **Google Auth Platform** (ou "Tela de consentimento OAuth") → **Começar / Get started**:
   - Nome do app: `Racha Conta`
   - E-mail de suporte: o seu
   - Público (Audience): **Externo / External**
   - E-mail de contato: o seu → aceite os termos → **Criar**.
4. **Branding (Identidade visual)**:
   - Logotipo: envie `public/icons/icon-512.png` do projeto (opcional no começo; com logo, o Google pede uma verificação de alguns dias).
   - Página inicial do app: `https://NOME.vercel.app`
   - Política de privacidade: `https://NOME.vercel.app/privacidade` (eu crio essa página no app).
   - Domínios autorizados: `NOME.vercel.app` e `SEU-PROJETO.supabase.co` (a parte do Project URL sem `https://`).
   - **Salvar**.
5. **Acesso a dados (Data Access) → Adicionar escopos**: marque só `openid`, `.../auth/userinfo.email` e `.../auth/userinfo.profile` → **Atualizar** → **Salvar**.
   Esses três são "básicos" e não exigem a verificação demorada do Google.
6. **Público (Audience)**:
   - Enquanto testa, deixe em **Teste / Testing** e, em **Usuários de teste**, adicione o seu Gmail e o de quem for testar (até 100).
   - Quando for lançar: **Publicar app** → **Em produção**.
7. **Clientes (Clients) → Criar cliente**:
   - Tipo: **Aplicativo da Web / Web application**
   - Nome: `Racha Conta Web`
   - **Origens JavaScript autorizadas** (Authorized JavaScript origins), uma por linha:
     - `http://localhost`
     - `http://localhost:3000`
     - `https://NOME.vercel.app`
   - **URIs de redirecionamento autorizados** (o plano B do login):
     - `https://SEU-PROJETO.supabase.co/auth/v1/callback`
   - **Criar** → copie o **ID do cliente** e o **Chave secreta do cliente** (**secreto**).

## 4. Voltar ao Supabase e ligar o Google

1. **Authentication → Sign In / Providers → Google** → ative (**Enable**).
2. **Client IDs**: cole o **ID do cliente** do Google.
3. **Client Secret**: cole a **chave secreta** do Google.
4. Deixe "Skip nonce check" **desligado** → **Save**.
5. **Authentication → URL Configuration**:
   - Site URL: `https://NOME.vercel.app`
   - Redirect URLs → **Add URL**: `http://localhost:3000/**` e `https://NOME.vercel.app/**`
   - **Save**.

## 5. Me mandar os dados públicos

Mande no chat só estes três:

```
Project URL: https://....supabase.co
Publishable key: sb_publishable_...
Google Client ID: ....apps.googleusercontent.com
```

Com eles eu crio o arquivo `.env.local` (fica só no seu computador e não vai para o GitHub), ligo o login e preparo as variáveis para você colar na Vercel.

---

## Problemas comuns

- **"Acesso bloqueado: este app não foi verificado" / "acesso negado"**: o app está em modo Teste e o Gmail não está em "Usuários de teste".
- **"origin_mismatch" / "redirect_uri_mismatch"**: falta o endereço exato em "Origens JavaScript" ou em "Redirecionamento" (cuidado com `http` x `https` e a barra no fim).
- **O projeto Supabase "pausou"**: no plano grátis ele pausa após 7 dias sem uso. É só entrar no painel e clicar em **Restore**.
