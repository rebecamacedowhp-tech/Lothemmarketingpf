-- Lothem Núcleo · serviços na ficha, produto no negócio e campanhas de anúncio

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  platform text not null default 'meta',
  external_id text,                                  -- id da campanha no Meta
  status text not null default 'ativa',
  spend numeric(12,2) not null default 0,            -- investimento
  impressions int not null default 0,
  clicks int not null default 0,
  platform_leads int not null default 0,             -- leads contados pelo Meta
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.campaigns (org_id);

alter table public.contacts add column services jsonb not null default '{}'::jsonb;   -- serviços marcados na ficha
alter table public.contacts add column campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.deals add column product text;
alter table public.deals add column campaign_id uuid references public.campaigns(id) on delete set null;

alter table public.campaigns enable row level security;
create policy campaigns_members on public.campaigns for all using (public.is_member(org_id)) with check (public.is_member(org_id));
grant select, insert, update, delete on public.campaigns to authenticated;
revoke all on public.campaigns from anon;
