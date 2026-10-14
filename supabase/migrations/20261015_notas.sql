-- Racha Conta · fotos das notas fiscais da viagem compartilhada (Supabase Storage).
-- Rodar uma vez no Supabase: SQL Editor → colar tudo → Run.
--
-- Cada grupo tem uma pasta no balde "notas" (notas/<id do grupo>/<foto>.jpg).
-- Só quem é do grupo vê, envia e apaga as fotos da pasta dele. O balde não é público.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notas', 'notas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Pasta do grupo → id do grupo (ou nulo, se o nome não for um id válido).
create or replace function public.note_group(p_name text) returns uuid
language sql immutable as $$
  select case when (storage.foldername(p_name))[1] ~ '^[0-9a-f-]{36}$'
              then ((storage.foldername(p_name))[1])::uuid end;
$$;

drop policy if exists "grupo vê as notas" on storage.objects;
create policy "grupo vê as notas" on storage.objects for select to authenticated
  using (bucket_id = 'notas' and public.is_member(public.note_group(name)));

drop policy if exists "grupo envia notas" on storage.objects;
create policy "grupo envia notas" on storage.objects for insert to authenticated
  with check (bucket_id = 'notas' and public.is_member(public.note_group(name)));

drop policy if exists "grupo troca notas" on storage.objects;
create policy "grupo troca notas" on storage.objects for update to authenticated
  using (bucket_id = 'notas' and public.is_member(public.note_group(name)));

drop policy if exists "grupo apaga notas" on storage.objects;
create policy "grupo apaga notas" on storage.objects for delete to authenticated
  using (bucket_id = 'notas' and public.is_member(public.note_group(name)));
