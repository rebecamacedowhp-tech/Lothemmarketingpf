-- Lothem Vendas · financeiro: negociação na ficha do cliente, parcelas e aviso de vencimento

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  product text,
  total numeric(12,2) not null check (total >= 0),
  method text not null check (method in ('pix', 'cartao', 'boleto', 'dinheiro', 'transferencia')),
  mode text not null check (mode in ('avista', 'parcelado')),
  installments int not null default 1 check (installments between 1 and 48),
  seller_id uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists sales_org_idx on public.sales (org_id, created_at desc);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  n int not null,
  due date not null,
  value numeric(12,2) not null check (value >= 0),
  paid_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists installments_due_idx on public.installments (org_id, due) where paid_at is null;

alter table public.sales enable row level security;
alter table public.installments enable row level security;
drop policy if exists sales_members on public.sales;
drop policy if exists installments_members on public.installments;
create policy sales_members on public.sales for all to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy installments_members on public.installments for all to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));

-- sem assinatura válida: só consulta
do $$
declare t text;
begin
  foreach t in array array['sales', 'installments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_plano_inserir', t);
    execute format('drop policy if exists %I on public.%I', t || '_plano_alterar', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.org_active(org_id))', t || '_plano_inserir', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.org_active(org_id))', t || '_plano_alterar', t);
  end loop;
end $$;

revoke all on public.sales, public.installments from anon;
grant select, insert, update, delete on public.sales, public.installments to authenticated;
