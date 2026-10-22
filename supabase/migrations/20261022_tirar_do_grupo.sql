-- Racha Conta · quem criou o grupo pode tirar alguém dele.
-- Rodar uma vez no Supabase: SQL Editor → colar tudo → Run.
--
-- Só o dono tira, e não pode tirar a si mesmo. Quem sai para de ver e de editar o grupo; o que
-- a pessoa lançou continua (fica nos dados do grupo). Com o link do convite, ela entra de novo.

create or replace function public.remove_member(p_group uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from groups where id = p_group and owner_id = auth.uid()) then
    raise exception 'só quem criou o grupo tira alguém';
  end if;
  if p_user = auth.uid() then raise exception 'quem criou o grupo não sai dele'; end if;
  delete from group_members where group_id = p_group and user_id = p_user and role <> 'owner';
end $$;

revoke all on function public.remove_member from public, anon;
grant execute on function public.remove_member to authenticated;
