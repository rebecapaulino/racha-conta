-- Racha Conta · viagens e rolês compartilhados (grupo).
-- Rodar uma vez no Supabase: SQL Editor → colar tudo → Run.
--
-- Ideia: cada viagem ou rolê compartilhado é uma linha em `groups`, com o conteúdo inteiro
-- (o mesmo que o app guarda no aparelho) em `data`. Quem está no grupo fica em
-- `group_members`. Só quem é do grupo vê e muda; entrar só com o código do convite.
-- Mudanças passam pelas funções abaixo, que conferem quem é do grupo e a versão (para duas
-- pessoas não sobrescreverem uma à outra sem perceber).

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('trip', 'role')),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  data        jsonb not null,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  name      text not null check (char_length(name) between 1 and 60),
  photo     text,
  role      text not null default 'editor' check (role in ('owner', 'editor')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Quem está logado é do grupo?
create or replace function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid());
$$;

-- Ler: só quem é do grupo. Gravar: só pelas funções (nenhuma política de insert/update).
drop policy if exists "membros leem o grupo" on public.groups;
create policy "membros leem o grupo" on public.groups for select to authenticated using (public.is_member(id));

drop policy if exists "membros veem quem está no grupo" on public.group_members;
create policy "membros veem quem está no grupo" on public.group_members for select to authenticated using (public.is_member(group_id));

drop policy if exists "sair do grupo" on public.group_members;
create policy "sair do grupo" on public.group_members for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner');

-- Criar o grupo (quem cria vira dono e primeiro membro).
create or replace function public.create_group(p_kind text, p_data jsonb, p_name text, p_photo text)
returns public.groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  insert into groups (kind, owner_id, data) values (p_kind, auth.uid(), p_data) returning * into g;
  insert into group_members (group_id, user_id, name, photo, role) values (g.id, auth.uid(), left(p_name, 60), p_photo, 'owner');
  return g;
end $$;

-- Ver o convite antes de entrar: tipo, nome e quantas pessoas (sem o conteúdo).
create or replace function public.invite_preview(p_code text)
returns table (group_id uuid, kind text, title text, owner_name text, members integer)
language sql stable security definer set search_path = public as $$
  select g.id, g.kind,
         coalesce(g.data #>> '{trip,name}', g.data #>> '{bill,title}', ''),
         (select m.name from group_members m where m.group_id = g.id and m.role = 'owner' limit 1),
         (select count(*)::int from group_members m where m.group_id = g.id)
  from groups g where g.invite_code = p_code;
$$;

-- Entrar pelo convite.
create or replace function public.join_group(p_code text, p_name text, p_photo text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  select id into gid from groups where invite_code = p_code;
  if gid is null then raise exception 'convite inválido'; end if;
  insert into group_members (group_id, user_id, name, photo) values (gid, auth.uid(), left(p_name, 60), p_photo)
    on conflict (group_id, user_id) do update set name = excluded.name, photo = excluded.photo;
  return gid;
end $$;

-- Salvar uma mudança: só quem é do grupo, e só se ninguém salvou antes (versão igual).
-- Devolve a versão nova, ou -1 se outra pessoa salvou primeiro (o app busca e refaz).
create or replace function public.save_group(p_id uuid, p_data jsonb, p_base integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if not is_member(p_id) then raise exception 'sem acesso'; end if;
  update groups set data = p_data, version = version + 1, updated_at = now()
    where id = p_id and version = p_base returning version into v;
  return coalesce(v, -1);
end $$;

-- Dono: trocar o código do convite (o link antigo para de funcionar).
create or replace function public.new_invite(p_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  update groups set invite_code = replace(gen_random_uuid()::text, '-', '')
    where id = p_id and owner_id = auth.uid() returning invite_code into c;
  if c is null then raise exception 'só o dono troca o convite'; end if;
  return c;
end $$;

revoke all on function public.create_group, public.invite_preview, public.join_group, public.save_group, public.new_invite, public.is_member from public, anon;
grant execute on function public.create_group, public.invite_preview, public.join_group, public.save_group, public.new_invite, public.is_member to authenticated;

-- Tempo real: avisar o app quando o grupo ou os membros mudam (respeita as regras acima).
do $$ begin
  alter publication supabase_realtime add table public.groups, public.group_members;
exception when duplicate_object then null; end $$;
