-- Lothem Vendas · disparo em massa pela SDR IA
-- O envio de verdade é feito pelo servidor do WhatsApp (chave de serviço), respeitando limite por hora,
-- horário, "não contatar" e parada automática. Aqui ficam o disparo e o resultado.

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  template text not null,
  filters jsonb not null default '{}'::jsonb,
  contact_ids uuid[] not null default '{}',
  per_hour int not null default 30 check (per_hour between 1 and 500),
  window_start time not null default '09:00',
  window_end time not null default '18:00',
  weekdays_only boolean not null default true,
  stop_at_pct numeric(4,1) not null default 3.0,
  status text not null default 'rascunho' check (status in ('rascunho', 'agendado', 'enviando', 'pausado', 'concluido', 'parado')),
  stats jsonb not null default '{}'::jsonb,
  consent boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists broadcasts_org_idx on public.broadcasts (org_id, created_at desc);

alter table public.broadcasts enable row level security;
drop policy if exists broadcasts_members on public.broadcasts;
create policy broadcasts_members on public.broadcasts for all to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
drop policy if exists broadcasts_plano_inserir on public.broadcasts;
drop policy if exists broadcasts_plano_alterar on public.broadcasts;
create policy broadcasts_plano_inserir on public.broadcasts as restrictive for insert to authenticated with check (public.org_active(org_id));
create policy broadcasts_plano_alterar on public.broadcasts as restrictive for update to authenticated using (public.org_active(org_id));
-- só envia para quem deu autorização (LGPD e regras do WhatsApp)
alter table public.broadcasts drop constraint if exists broadcasts_consent_chk;
alter table public.broadcasts add constraint broadcasts_consent_chk check (status = 'rascunho' or consent);

revoke all on public.broadcasts from anon;
grant select, insert, update, delete on public.broadcasts to authenticated;
