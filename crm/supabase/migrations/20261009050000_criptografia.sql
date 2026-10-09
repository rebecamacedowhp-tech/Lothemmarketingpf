-- Lothem Núcleo · criptografia dos dados sensíveis
-- Tenant (empresa que assina o Núcleo), equipe do tenant e clientes finais.
-- Cada valor é cifrado com AES-256 (pgcrypto), com a chave guardada no Vault, e amarrado ao dono
-- (organização ou pessoa): um dado cifrado copiado para outra organização não abre.
-- A tela recebe só a dica (4 últimos dígitos, e-mail mascarado). O valor completo sai por função,
-- só para quem tem acesso, e abrir dado de cliente fica registrado no histórico.
-- Gatilhos cifram sozinhos tudo o que for gravado depois (inclusive pelo WhatsApp, no futuro).

-- ===== 0. Cifrar e decifrar (uso interno: ninguém logado chama direto) =====
create or replace function public.pii_enc(ctx uuid, v text)
returns bytea language sql volatile security definer set search_path = '' as $$
  select case when v is null or btrim(v) = '' then null
    else extensions.pgp_sym_encrypt(ctx::text || '|' || v, public.pii_key(), 'cipher-algo=aes256, s2k-mode=1') end;
$$;

create or replace function public.pii_dec(ctx uuid, b bytea)
returns text language plpgsql stable security definer set search_path = '' as $$
declare t text; p text := ctx::text || '|';
begin
  if b is null then return null; end if;
  t := extensions.pgp_sym_decrypt(b, public.pii_key());
  if left(t, length(p)) <> p then raise exception 'dado de outro dono'; end if;
  return substr(t, length(p) + 1);
end $$;

create or replace function public.pii_hash(v text)
returns text language sql stable security definer set search_path = '' as $$
  select case when v is null or btrim(v) = '' then null
    else encode(extensions.hmac(lower(btrim(v)), public.pii_key(), 'sha256'), 'hex') end;
$$;

create or replace function public.mask_email(v text)
returns text language sql immutable set search_path = '' as $$
  select case when v is null or position('@' in v) = 0 then null else left(btrim(v), 1) || '•••@' || split_part(btrim(v), '@', 2) end;
$$;

revoke execute on function public.pii_enc(uuid, text), public.pii_dec(uuid, bytea), public.pii_hash(text) from public, anon, authenticated;
-- O servidor do WhatsApp (chave de serviço, nunca no navegador) vai precisar cifrar e decifrar mensagens
grant execute on function public.pii_enc(uuid, text), public.pii_dec(uuid, bytea), public.pii_hash(text) to service_role;

-- =====================================================================
-- CLIENTES FINAIS
-- =====================================================================

-- Telefone e documento que já estavam cifrados passam a ficar amarrados à organização
update public.contacts set phone_enc = public.pii_enc(org_id, extensions.pgp_sym_decrypt(phone_enc, public.pii_key()))
  where phone_enc is not null and left(extensions.pgp_sym_decrypt(phone_enc, public.pii_key()), 37) <> org_id::text || '|';
update public.contacts set document_enc = public.pii_enc(org_id, extensions.pgp_sym_decrypt(document_enc, public.pii_key()))
  where document_enc is not null and left(extensions.pgp_sym_decrypt(document_enc, public.pii_key()), 37) <> org_id::text || '|';

-- E-mail do cliente
alter table public.contacts add column if not exists email_enc bytea;
alter table public.contacts add column if not exists email_hint text;
alter table public.contacts add column if not exists email_hash text;

create or replace function public.contacts_cifrar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and btrim(new.email) <> '' then
    new.email_enc := public.pii_enc(new.org_id, btrim(new.email));
    new.email_hint := public.mask_email(new.email);
    new.email_hash := public.pii_hash(new.email);
  end if;
  new.email := null;
  return new;
end $$;
drop trigger if exists contacts_cifrar on public.contacts;
create trigger contacts_cifrar before insert or update on public.contacts for each row execute function public.contacts_cifrar();
update public.contacts set email = email where email is not null;

-- Qualificação do negócio (dor, dívidas, momento): conta a situação financeira do cliente
alter table public.deals add column if not exists qualification_enc bytea;
create or replace function public.deals_cifrar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.qualification is not null and new.qualification <> '{}'::jsonb then
    new.qualification_enc := public.pii_enc(new.org_id, new.qualification::text);
  end if;
  new.qualification := '{}'::jsonb;
  return new;
end $$;
drop trigger if exists deals_cifrar on public.deals;
create trigger deals_cifrar before insert or update on public.deals for each row execute function public.deals_cifrar();
update public.deals set qualification = qualification where qualification <> '{}'::jsonb;

-- Mensagens do WhatsApp
alter table public.messages add column if not exists body_enc bytea;
alter table public.messages alter column body drop not null;
create or replace function public.messages_cifrar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.body is not null and new.body <> '' then new.body_enc := public.pii_enc(new.org_id, new.body); end if;
  new.body := null;
  return new;
end $$;
drop trigger if exists messages_cifrar on public.messages;
create trigger messages_cifrar before insert or update on public.messages for each row execute function public.messages_cifrar();
update public.messages set body = body where body is not null;

-- Gravar e abrir os dados sensíveis do cliente
drop function if exists public.set_contact_sensitive(uuid, text, text);
create function public.set_contact_sensitive(p_contact uuid, p_phone text default null, p_document text default null, p_email text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; d text;
begin
  select org_id into v_org from public.contacts where id = p_contact;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a este contato'; end if;
  if p_phone is not null and btrim(p_phone) <> '' then
    d := regexp_replace(p_phone, '\D', '', 'g');
    update public.contacts set phone_enc = public.pii_enc(v_org, p_phone), phone_hint = right(d, 4),
      phone_hash = encode(extensions.hmac(d, public.pii_key(), 'sha256'), 'hex'), updated_at = now() where id = p_contact;
  end if;
  if p_document is not null and btrim(p_document) <> '' then
    d := regexp_replace(p_document, '\D', '', 'g');
    update public.contacts set document_enc = public.pii_enc(v_org, p_document), document_hint = right(d, 3), updated_at = now() where id = p_contact;
  end if;
  if p_email is not null and btrim(p_email) <> '' then
    update public.contacts set email = p_email, updated_at = now() where id = p_contact;
  end if;
  insert into public.activity_log (org_id, actor_id, entity, entity_id, action) values (v_org, auth.uid(), 'contact', p_contact, 'dados_sensiveis_alterados');
end $$;

drop function if exists public.get_contact_sensitive(uuid);
create function public.get_contact_sensitive(p_contact uuid)
returns table (phone text, document text, email text) language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.contacts where id = p_contact;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a este contato'; end if;
  insert into public.activity_log (org_id, actor_id, entity, entity_id, action) values (v_org, auth.uid(), 'contact', p_contact, 'dados_sensiveis_vistos');
  return query select public.pii_dec(v_org, c.phone_enc), public.pii_dec(v_org, c.document_enc), public.pii_dec(v_org, c.email_enc)
    from public.contacts c where c.id = p_contact;
end $$;

create or replace function public.get_deal_qualification(p_deal uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org uuid; b bytea;
begin
  select org_id, qualification_enc into v_org, b from public.deals where id = p_deal;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a este negócio'; end if;
  return coalesce(public.pii_dec(v_org, b)::jsonb, '{}'::jsonb);
end $$;

create or replace function public.get_conversation_messages(p_conversation uuid)
returns table (id uuid, sender public.msg_from, author_id uuid, body text, meta jsonb, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.conversations where conversations.id = p_conversation;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a esta conversa'; end if;
  return query select m.id, m.sender, m.author_id, public.pii_dec(v_org, m.body_enc), m.meta, m.created_at
    from public.messages m where m.conversation_id = p_conversation order by m.created_at;
end $$;

-- =====================================================================
-- EQUIPE DO TENANT
-- =====================================================================

-- Telefone de quem trabalha no CRM
alter table public.profiles add column if not exists phone_enc bytea;
alter table public.profiles add column if not exists phone_hint text;
create or replace function public.profiles_cifrar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.phone is not null and btrim(new.phone) <> '' then
    new.phone_enc := public.pii_enc(new.id, new.phone);
    new.phone_hint := right(regexp_replace(new.phone, '\D', '', 'g'), 4);
  end if;
  new.phone := null;
  return new;
end $$;
drop trigger if exists profiles_cifrar on public.profiles;
create trigger profiles_cifrar before insert or update on public.profiles for each row execute function public.profiles_cifrar();
update public.profiles set phone = phone where phone is not null;

create or replace function public.get_profile_phone(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if p_user <> auth.uid() and not exists (
    select 1 from public.memberships a join public.memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = p_user) then
    raise exception 'sem acesso';
  end if;
  return (select public.pii_dec(p.id, p.phone_enc) from public.profiles p where p.id = p_user);
end $$;

-- E-mail de quem foi convidado para a equipe (acha o convite pela impressão digital, sem abrir o e-mail)
alter table public.invites add column if not exists email_enc bytea;
alter table public.invites add column if not exists email_hint text;
alter table public.invites add column if not exists email_hash text;
alter table public.invites alter column email drop not null;
create or replace function public.invites_cifrar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and btrim(new.email) <> '' then
    new.email_enc := public.pii_enc(new.org_id, btrim(new.email));
    new.email_hint := public.mask_email(new.email);
    new.email_hash := public.pii_hash(new.email);
  end if;
  new.email := null;
  return new;
end $$;
drop trigger if exists invites_cifrar on public.invites;
create trigger invites_cifrar before insert or update on public.invites for each row execute function public.invites_cifrar();
update public.invites set email = email where email is not null;

-- =====================================================================
-- TENANT (a empresa que assina)
-- =====================================================================

-- Dados de cobrança da empresa: CPF/CNPJ, e-mail, telefone e endereço
alter table public.organizations add column if not exists billing_doc_enc bytea;
alter table public.organizations add column if not exists billing_doc_hint text;
alter table public.organizations add column if not exists billing_email_enc bytea;
alter table public.organizations add column if not exists billing_phone_enc bytea;
alter table public.organizations add column if not exists billing_address_enc bytea;

create or replace function public.set_org_billing_data(p_org uuid, p_doc text default null, p_email text default null, p_phone text default null, p_address text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin(p_org) then raise exception 'só a proprietária ou a gestão alteram'; end if;
  update public.organizations set
    billing_doc_enc = coalesce(public.pii_enc(p_org, p_doc), billing_doc_enc),
    billing_doc_hint = coalesce(right(regexp_replace(nullif(btrim(p_doc), ''), '\D', '', 'g'), 3), billing_doc_hint),
    billing_email_enc = coalesce(public.pii_enc(p_org, p_email), billing_email_enc),
    billing_phone_enc = coalesce(public.pii_enc(p_org, p_phone), billing_phone_enc),
    billing_address_enc = coalesce(public.pii_enc(p_org, p_address), billing_address_enc)
  where id = p_org;
  insert into public.activity_log (org_id, actor_id, entity, entity_id, action) values (p_org, auth.uid(), 'organization', p_org, 'dados_cobranca_alterados');
end $$;

create or replace function public.get_org_billing_data(p_org uuid)
returns table (doc text, email text, phone text, address text) language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin(p_org) then raise exception 'só a proprietária ou a gestão veem'; end if;
  insert into public.activity_log (org_id, actor_id, entity, entity_id, action) values (p_org, auth.uid(), 'organization', p_org, 'dados_cobranca_vistos');
  return query select public.pii_dec(p_org, o.billing_doc_enc), public.pii_dec(p_org, o.billing_email_enc),
    public.pii_dec(p_org, o.billing_phone_enc), public.pii_dec(p_org, o.billing_address_enc)
    from public.organizations o where o.id = p_org;
end $$;

-- Números de WhatsApp da empresa e a chave de acesso da Meta (a chave nunca volta para o navegador)
alter table public.whatsapp_instances add column if not exists phone_enc bytea;
alter table public.whatsapp_instances add column if not exists phone_hint text;
alter table public.whatsapp_instances add column if not exists access_token_enc bytea;
create or replace function public.instances_cifrar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.phone is not null and btrim(new.phone) <> '' then
    new.phone_enc := public.pii_enc(new.org_id, new.phone);
    new.phone_hint := right(regexp_replace(new.phone, '\D', '', 'g'), 4);
  end if;
  new.phone := null;
  return new;
end $$;
drop trigger if exists instances_cifrar on public.whatsapp_instances;
create trigger instances_cifrar before insert or update on public.whatsapp_instances for each row execute function public.instances_cifrar();
update public.whatsapp_instances set phone = phone where phone is not null;

create or replace function public.set_instance_token(p_instance uuid, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.whatsapp_instances where id = p_instance;
  if v_org is null or not public.is_admin(v_org) then raise exception 'só a proprietária ou a gestão alteram'; end if;
  update public.whatsapp_instances set access_token_enc = public.pii_enc(v_org, p_token) where id = p_instance;
  insert into public.activity_log (org_id, actor_id, entity, entity_id, action) values (v_org, auth.uid(), 'whatsapp', p_instance, 'chave_whatsapp_alterada');
end $$;

-- ===== Permissões =====
revoke execute on function public.contacts_cifrar(), public.deals_cifrar(), public.messages_cifrar(), public.profiles_cifrar(),
  public.invites_cifrar(), public.instances_cifrar() from public, anon, authenticated;
grant execute on function public.set_contact_sensitive(uuid, text, text, text), public.get_contact_sensitive(uuid),
  public.get_deal_qualification(uuid), public.get_conversation_messages(uuid), public.get_profile_phone(uuid),
  public.set_org_billing_data(uuid, text, text, text, text), public.get_org_billing_data(uuid),
  public.set_instance_token(uuid, text) to authenticated;
