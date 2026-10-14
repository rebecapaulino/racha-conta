# Passo a passo: viagem e rolê compartilhados

O compartilhamento guarda a viagem (ou o rolê) no Supabase, para todo mundo do grupo ver e editar.
Antes do app usar, o banco precisa das tabelas. São dois passos, feitos uma vez só.

## 1. Criar as tabelas no Supabase

1. Abra o projeto no Supabase (`sfryqzzismqdruqzluge`).
2. No menu da esquerda, **SQL Editor** → **New query**.
3. Abra o arquivo `supabase/migrations/20261014_grupos.sql` do projeto, copie **tudo** e cole.
4. Clique em **Run**. Deve aparecer "Success. No rows returned".

Não precisa de senha do banco nem de chave secreta: o SQL Editor já usa a sua conta do Supabase.

## 2. Deixar qualquer pessoa entrar com o Google

Hoje o app do Google está em **modo Teste**: só entram os e-mails da lista de "Usuários de teste".
Quem receber o convite e não estiver na lista não consegue entrar.

1. Google Cloud → **APIs e serviços** → **Tela de consentimento OAuth** (ou "Público-alvo").
2. **Publicar app** → confirmar ("Em produção").

O app só pede nome, e-mail e foto (dados básicos), então o Google não exige verificação.
Se preferir testar antes, dá para só adicionar os e-mails dos amigos em "Usuários de teste".
