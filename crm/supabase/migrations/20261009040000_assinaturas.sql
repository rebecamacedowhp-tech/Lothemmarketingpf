-- Lothem Núcleo · assinaturas
-- 1. Teste grátis de 7 dias para toda conta nova  2. Planos Essencial, Profissional e Avançado
-- 3. Organização sem assinatura válida fica só para leitura  4. Pedido de plano (até o provedor de pagamento entrar)

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'pro' check (plan in ('ess', 'pro', 'adv', 'interno')),
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cycle text check (cycle in ('mensal', 'anual')),
  requested_plan text,
  requested_cycle text,
  requested_method text,
  requested_at timestamptz,
  gateway text,
  gateway_customer_id text,
  gateway_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists subs_read_own on public.subscriptions;
create policy subs_read_own on public.subscriptions for select to authenticated using (user_id = auth.uid());
-- Ninguém altera a própria assinatura pela API: só as funções abaixo e, depois, o provedor de pagamento.
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- Contas que já existem (a da Lothem) ficam como uso interno, sem cobrança
insert into public.subscriptions (user_id, plan, status) select id, 'interno', 'active' from auth.users on conflict (user_id) do nothing;

-- Toda conta nova começa com 7 dias grátis do Avançado (o plano completo)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.subscriptions (user_id, plan, status, trial_ends_at) values (new.id, 'adv', 'trial', now() + interval '7 days')
    on conflict (user_id) do nothing;
  return new;
end $$;

-- Limites de cada plano
create or replace function public.plan_limits(p text)
returns jsonb language sql immutable set search_path = '' as $$
  select case p
    when 'ess' then '{"users": 3, "orgs": 1, "ia": 0, "wa": 1}'::jsonb
    when 'pro' then '{"users": 6, "orgs": 1, "ia": 300, "wa": 1}'::jsonb
    when 'adv' then '{"users": 15, "orgs": 3, "ia": 1500, "wa": 3}'::jsonb
    else '{"users": 999, "orgs": 999, "ia": 99999, "wa": 99}'::jsonb end;
$$;

-- A organização está liberada se uma das donas tiver assinatura válida
create or replace function public.org_active(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m join public.subscriptions s on s.user_id = m.user_id
    where m.org_id = p_org and m.role = 'owner'
      and (s.status in ('active', 'past_due') or (s.status = 'trial' and s.trial_ends_at > now())));
$$;

-- Situação da assinatura que sustenta a organização (para quem é da equipe e não é dona)
create or replace function public.org_billing(p_org uuid)
returns table (plan text, status text, trial_ends_at timestamptz, current_period_end timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.plan, s.status, s.trial_ends_at, s.current_period_end
  from public.memberships m join public.subscriptions s on s.user_id = m.user_id
  where m.org_id = p_org and m.role = 'owner'
    and exists (select 1 from public.memberships me where me.org_id = p_org and me.user_id = auth.uid())
  order by (s.status = 'active') desc, s.trial_ends_at desc nulls first
  limit 1;
$$;

-- Criar organização respeita a assinatura e o limite do plano
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; s public.subscriptions; n int; lim int;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  select * into s from public.subscriptions where user_id = auth.uid();
  if not found or not (s.status in ('active', 'past_due') or (s.status = 'trial' and s.trial_ends_at > now())) then
    raise exception 'Sua assinatura não está ativa. Escolha um plano para continuar.';
  end if;
  select count(*) into n from public.memberships where user_id = auth.uid() and role = 'owner';
  lim := (public.plan_limits(s.plan)->>'orgs')::int;
  if n >= lim then raise exception 'Seu plano permite % organização(ões). Para ter mais, mude para o Avançado.', lim; end if;
  insert into public.organizations (name, slug) values (p_name, p_slug) returning id into new_id;
  insert into public.memberships (org_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

-- Pedido de plano: guarda a escolha até o provedor de pagamento confirmar
create or replace function public.request_plan(p_plan text, p_cycle text, p_method text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  if p_plan not in ('ess', 'pro', 'adv', 'implantacao') or p_cycle not in ('mensal', 'anual') or p_method not in ('pix', 'cartao', 'boleto') then
    raise exception 'pedido inválido';
  end if;
  update public.subscriptions set requested_plan = p_plan, requested_cycle = p_cycle, requested_method = p_method,
    requested_at = now(), updated_at = now() where user_id = auth.uid();
end $$;

-- Sem assinatura válida: dá para ver e exportar, mas não criar nem alterar
do $$
declare t text;
begin
  foreach t in array array['pipelines', 'stages', 'contacts', 'deals', 'tasks', 'campaigns', 'kb_items', 'conversations', 'messages']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_plano_inserir', t);
    execute format('drop policy if exists %I on public.%I', t || '_plano_alterar', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.org_active(org_id))', t || '_plano_inserir', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.org_active(org_id))', t || '_plano_alterar', t);
  end loop;
end $$;

grant execute on function public.org_active(uuid), public.org_billing(uuid), public.request_plan(text, text, text), public.create_organization(text, text) to authenticated;
revoke execute on function public.plan_limits(text) from public, anon;
