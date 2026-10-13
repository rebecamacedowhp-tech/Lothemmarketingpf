-- Lothem Vendas · memória da SDR por cliente
-- O que a IA precisa lembrar de cada pessoa (dor, valor, objeções, combinados). Fica cifrado, porque costuma ter
-- situação financeira. A equipe lê e corrige pela ficha; o servidor da IA lê antes de responder e atualiza depois.

create table if not exists public.contact_memory (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  notes_enc bytea,
  updated_by text not null default 'equipe' check (updated_by in ('ia', 'equipe')),
  updated_at timestamptz not null default now()
);
alter table public.contact_memory enable row level security;
revoke all on public.contact_memory from anon, authenticated;

create or replace function public.get_contact_memory(p_contact uuid)
returns table (notes text, updated_by text, updated_at timestamptz) language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.contacts where id = p_contact;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a este contato'; end if;
  return query select public.pii_dec(v_org, m.notes_enc), m.updated_by, m.updated_at from public.contact_memory m where m.contact_id = p_contact;
end $$;

create or replace function public.set_contact_memory(p_contact uuid, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.contacts where id = p_contact;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a este contato'; end if;
  insert into public.contact_memory (contact_id, org_id, notes_enc, updated_by, updated_at)
  values (p_contact, v_org, public.pii_enc(v_org, left(coalesce(p_notes, ''), 8000)), 'equipe', now())
  on conflict (contact_id) do update set notes_enc = excluded.notes_enc, updated_by = 'equipe', updated_at = now();
end $$;

-- o servidor da IA (chave de serviço) lê e grava a memória
create or replace function public.ai_memory_get(p_contact uuid)
returns text language sql stable security definer set search_path = '' as $$
  select public.pii_dec(m.org_id, m.notes_enc) from public.contact_memory m where m.contact_id = p_contact;
$$;
create or replace function public.ai_memory_set(p_contact uuid, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.contacts where id = p_contact;
  if v_org is null then return; end if;
  insert into public.contact_memory (contact_id, org_id, notes_enc, updated_by, updated_at)
  values (p_contact, v_org, public.pii_enc(v_org, left(coalesce(p_notes, ''), 8000)), 'ia', now())
  on conflict (contact_id) do update set notes_enc = excluded.notes_enc, updated_by = 'ia', updated_at = now();
end $$;

revoke execute on function public.get_contact_memory(uuid), public.set_contact_memory(uuid, text), public.ai_memory_get(uuid), public.ai_memory_set(uuid, text) from public, anon, authenticated;
grant execute on function public.get_contact_memory(uuid), public.set_contact_memory(uuid, text) to authenticated;
grant execute on function public.ai_memory_get(uuid), public.ai_memory_set(uuid, text) to service_role;
