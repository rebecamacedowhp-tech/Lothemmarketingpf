-- Lothem Núcleo · base multi-organização
-- Cada cliente é uma organização. Toda tabela de dados tem org_id e só membros da organização acessam (RLS).

create extension if not exists pgcrypto;

-- ---------- tipos ----------
create type public.member_role as enum ('owner', 'manager', 'closer', 'sdr', 'traffic', 'viewer');
create type public.contact_kind as enum ('pf', 'pj');
create type public.stage_kind as enum ('open', 'won', 'lost');
create type public.msg_from as enum ('lead', 'ia', 'user', 'note', 'system');
create type public.conv_status as enum ('ia', 'waiting_lead', 'waiting_human', 'human', 'closed');

-- ---------- organizações e pessoas ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'implantacao',
  brand jsonb not null default '{}'::jsonb,          -- logo, cor, nome curto
  settings jsonb not null default '{}'::jsonb,       -- SLA, preenchimento automático, IA
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'sdr',
  squad text,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'sdr',
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- funis ----------
create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null,
  position int not null default 0,
  probability int not null default 0 check (probability between 0 and 100),
  kind public.stage_kind not null default 'open'
);

-- ---------- contatos e negócios ----------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind public.contact_kind not null default 'pf',
  name text not null,
  company text,
  occupation text,
  phone text,
  email text,
  city text,
  segment text,
  source text,
  owner_id uuid references auth.users(id),
  lifecycle text not null default 'lead',
  score int not null default 0,
  do_not_contact boolean not null default false,
  consent_at timestamptz,                         -- autorização de contato/consulta (LGPD)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.contacts (org_id, created_at desc);
create index on public.contacts (org_id, phone);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  stage_id uuid not null references public.stages(id),
  title text,
  value numeric(12,2) not null default 0,
  temperature text not null default 'frio' check (temperature in ('frio', 'morno', 'quente')),
  owner_id uuid references auth.users(id),
  next_step text,
  lost_reason text,
  qualification jsonb not null default '{}'::jsonb,   -- dor, decisor, momento, capacidade
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.deals (org_id, pipeline_id, stage_id);

-- ---------- WhatsApp e conversas ----------
create table public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  kind text not null default 'oficial' check (kind in ('oficial', 'nao_oficial')),
  phone text,
  external_id text,                                  -- phone_number_id da Meta
  status text not null default 'off',
  ia_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  instance_id uuid references public.whatsapp_instances(id),
  status public.conv_status not null default 'ia',
  assigned_to uuid references auth.users(id),
  unread int not null default 0,
  sla_type text,
  sla_since timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.conversations (org_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender public.msg_from not null,
  author_id uuid references auth.users(id),
  body text not null,
  meta jsonb not null default '{}'::jsonb,           -- id da Meta, confiança da IA, Pix
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

-- ---------- tarefas, IA, histórico, XP ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  assignee_id uuid references auth.users(id),
  title text not null,
  kind text,
  priority text not null default 'media',
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.tasks (org_id, due_at);

create table public.kb_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  category text,
  content text,
  file_path text,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);

create table public.ai_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  question text not null,
  answer text not null,
  confidence int,
  reason text,
  blocked boolean not null default false,
  corrected_answer text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  actor_kind text not null default 'user' check (actor_kind in ('user', 'ia', 'system')),
  entity text not null,
  entity_id uuid,
  action text not null,
  data jsonb not null default '{}'::jsonb,           -- campo, valor, trecho da conversa
  created_at timestamptz not null default now()
);
create index on public.activity_log (org_id, created_at desc);

create table public.xp_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- ---------- quem pode o quê ----------
create or replace function public.is_member(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.org_id = o and m.user_id = auth.uid());
$$;

create or replace function public.is_admin(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.org_id = o and m.user_id = auth.uid() and m.role in ('owner', 'manager'));
$$;

-- Cria a organização e torna quem criou a proprietária.
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  insert into organizations (name, slug) values (p_name, p_slug) returning id into new_id;
  insert into memberships (org_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

-- Perfil criado junto com o usuário.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS em tudo
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;

create policy org_read on public.organizations for select using (public.is_member(id));
create policy org_update on public.organizations for update using (public.is_admin(id));

create policy profile_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy profile_team on public.profiles for select using (
  exists (select 1 from memberships a join memberships b on a.org_id = b.org_id where a.user_id = auth.uid() and b.user_id = profiles.id));

create policy members_read on public.memberships for select using (public.is_member(org_id));
create policy members_admin on public.memberships for all using (public.is_admin(org_id)) with check (public.is_admin(org_id));

create policy invites_admin on public.invites for all using (public.is_admin(org_id)) with check (public.is_admin(org_id));

do $$
declare t text;
begin
  foreach t in array array['pipelines','stages','contacts','deals','whatsapp_instances','conversations','messages','tasks','kb_items','ai_reviews','activity_log','xp_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all using (public.is_member(org_id)) with check (public.is_member(org_id))', t || '_members', t);
  end loop;
end $$;

-- Acesso explícito (o projeto não expõe tabelas novas sozinho)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.is_member(uuid), public.is_admin(uuid) to authenticated;
revoke all on all tables in schema public from anon;
