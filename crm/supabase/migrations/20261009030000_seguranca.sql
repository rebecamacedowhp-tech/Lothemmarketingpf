-- Lothem Núcleo · segurança
-- 1. Organizações no token (custom JWT claims)  2. Funções SECURITY INVOKER  3. RLS revisado
-- 4. Dados sensíveis criptografados (Vault + pgcrypto)  5. Storage isolado por organização
-- 6. Realtime isolado por organização  7. Papel anônimo sem acesso

-- ===== 1. Organizações dentro do token de login =====
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  claims jsonb := event->'claims';
  orgs jsonb;
  roles jsonb;
begin
  select coalesce(jsonb_agg(m.org_id), '[]'::jsonb), coalesce(jsonb_object_agg(m.org_id, m.role), '{}'::jsonb)
    into orgs, roles
    from public.memberships m where m.user_id = (event->>'user_id')::uuid;
  claims := jsonb_set(claims, '{app_metadata}', coalesce(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object('org_ids', orgs, 'org_roles', roles));
  return jsonb_set(event, '{claims}', claims);
end $$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on public.memberships to supabase_auth_admin;
create policy auth_admin_reads_memberships on public.memberships for select to supabase_auth_admin using (true);

-- ===== 2. Quem é membro: lê o token primeiro; se o token estiver velho, confere a própria filiação =====
create or replace function public.jwt_org_ids()
returns uuid[] language sql stable security invoker set search_path = '' as $$
  select coalesce(array(select x::uuid from jsonb_array_elements_text(auth.jwt()->'app_metadata'->'org_ids') as x), '{}'::uuid[]);
$$;

create or replace function public.is_member(o uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select o = any(public.jwt_org_ids())
      or exists (select 1 from public.memberships m where m.org_id = o and m.user_id = auth.uid());
$$;

create or replace function public.is_admin(o uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(auth.jwt()->'app_metadata'->'org_roles'->>(o::text), '') in ('owner', 'manager')
      or exists (select 1 from public.memberships m where m.org_id = o and m.user_id = auth.uid() and m.role in ('owner', 'manager'));
$$;

-- RLS de filiações sem recursão: cada um vê as próprias linhas e as das organizações do seu token
drop policy if exists members_read on public.memberships;
drop policy if exists members_admin on public.memberships;
create policy members_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or org_id = any(public.jwt_org_ids()));
create policy members_insert on public.memberships for insert to authenticated with check (public.is_admin(org_id));
create policy members_update on public.memberships for update to authenticated using (public.is_admin(org_id)) with check (public.is_admin(org_id));
create policy members_delete on public.memberships for delete to authenticated using (public.is_admin(org_id));

-- Funções que precisam de privilégio (criar organização, gatilho de cadastro) ficam com caminho de busca vazio
alter function public.create_organization(text, text) set search_path = '';
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  insert into public.organizations (name, slug) values (p_name, p_slug) returning id into new_id;
  insert into public.memberships (org_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

-- ===== 4. Dados sensíveis criptografados (telefone, CPF/CNPJ/RG) =====
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'contacts_pii_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'contacts_pii_key', 'Chave dos dados sensíveis dos contatos');
  end if;
end $$;

alter table public.contacts add column phone_enc bytea;
alter table public.contacts add column phone_hint text;       -- só os 4 últimos dígitos, para exibir
alter table public.contacts add column phone_hash text;       -- impressão digital do número, para achar o contato sem abrir o dado
alter table public.contacts add column document_enc bytea;    -- CPF, CNPJ ou RG
alter table public.contacts add column document_hint text;
create index on public.contacts (org_id, phone_hash);

create or replace function public.pii_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'contacts_pii_key';
$$;
revoke execute on function public.pii_key() from public, anon, authenticated;

-- Telefones que já existiam vão para a coluna criptografada, e a coluna aberta deixa de existir
update public.contacts set
  phone_enc = extensions.pgp_sym_encrypt(phone, public.pii_key()),
  phone_hint = right(regexp_replace(phone, '\D', '', 'g'), 4),
  phone_hash = encode(extensions.hmac(regexp_replace(phone, '\D', '', 'g'), public.pii_key(), 'sha256'), 'hex')
where phone is not null and phone <> '';
drop index if exists public.contacts_org_id_phone_idx;
alter table public.contacts drop column phone;

create or replace function public.set_contact_sensitive(p_contact uuid, p_phone text default null, p_document text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; k text := public.pii_key(); d text;
begin
  select org_id into v_org from public.contacts where id = p_contact;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a este contato'; end if;
  if p_phone is not null and p_phone <> '' then
    d := regexp_replace(p_phone, '\D', '', 'g');
    update public.contacts set phone_enc = extensions.pgp_sym_encrypt(p_phone, k), phone_hint = right(d, 4),
      phone_hash = encode(extensions.hmac(d, k, 'sha256'), 'hex'), updated_at = now() where id = p_contact;
  end if;
  if p_document is not null and p_document <> '' then
    d := regexp_replace(p_document, '\D', '', 'g');
    update public.contacts set document_enc = extensions.pgp_sym_encrypt(p_document, k), document_hint = right(d, 3), updated_at = now() where id = p_contact;
  end if;
  insert into public.activity_log (org_id, actor_id, entity, entity_id, action) values (v_org, auth.uid(), 'contact', p_contact, 'dados_sensiveis_alterados');
end $$;

create or replace function public.get_contact_sensitive(p_contact uuid)
returns table (phone text, document text) language plpgsql security definer set search_path = '' as $$
declare v_org uuid; k text := public.pii_key();
begin
  select org_id into v_org from public.contacts where id = p_contact;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a este contato'; end if;
  insert into public.activity_log (org_id, actor_id, entity, entity_id, action) values (v_org, auth.uid(), 'contact', p_contact, 'dados_sensiveis_vistos');
  return query select extensions.pgp_sym_decrypt(c.phone_enc, k), extensions.pgp_sym_decrypt(c.document_enc, k) from public.contacts c where c.id = p_contact;
end $$;

create or replace function public.find_contact_by_phone(p_org uuid, p_phone text)
returns uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.contacts c
  where c.org_id = p_org and public.is_member(p_org)
    and c.phone_hash = encode(extensions.hmac(regexp_replace(p_phone, '\D', '', 'g'), public.pii_key(), 'sha256'), 'hex')
  limit 1;
$$;

-- ===== 5. Storage: arquivos privados, cada organização só na própria pasta =====
insert into storage.buckets (id, name, public) values ('arquivos', 'arquivos', false) on conflict (id) do nothing;
create policy arquivos_ler on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id::text = (storage.foldername(name))[1]));
create policy arquivos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id::text = (storage.foldername(name))[1]));
create policy arquivos_alterar on storage.objects for update to authenticated
  using (bucket_id = 'arquivos' and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id::text = (storage.foldername(name))[1]));
create policy arquivos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id::text = (storage.foldername(name))[1] and m.role in ('owner', 'manager')));

-- ===== 6. Realtime: só o canal "org:<id>" da própria organização =====
create policy realtime_ler on realtime.messages for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = auth.uid() and realtime.topic() = 'org:' || m.org_id::text));
create policy realtime_enviar on realtime.messages for insert to authenticated
  with check (exists (select 1 from public.memberships m where m.user_id = auth.uid() and realtime.topic() = 'org:' || m.org_id::text));

-- ===== 7. Papel anônimo sem acesso a nada do schema public =====
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
revoke usage on schema public from anon;
revoke create on schema public from public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- quem está logado continua podendo usar as funções do CRM
grant execute on function public.create_organization(text, text), public.is_member(uuid), public.is_admin(uuid), public.jwt_org_ids(),
  public.set_contact_sensitive(uuid, text, text), public.get_contact_sensitive(uuid), public.find_contact_by_phone(uuid, text) to authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
