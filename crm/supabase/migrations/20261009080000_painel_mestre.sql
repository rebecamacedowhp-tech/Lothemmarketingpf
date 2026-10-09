-- Lothem Vendas · Painel Mestre (só a dona da plataforma)
-- Ver todas as contas, liberar planos, dar mais dias de teste, suspender e ajustar preços dos planos.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
-- A conta da Lothem (uso interno) vira administradora da plataforma
insert into public.platform_admins (user_id) select user_id from public.subscriptions where plan = 'interno' on conflict do nothing;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- Preços, limites e textos dos planos (editáveis pelo painel)
create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),
  plans jsonb not null default '[]'::jsonb,
  extras jsonb not null default '[]'::jsonb,
  implant jsonb not null default '{}'::jsonb,
  trial_days int not null default 7 check (trial_days between 0 and 60),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (1) on conflict do nothing;
alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_read on public.platform_settings;
create policy platform_settings_read on public.platform_settings for select to authenticated using (true);
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to authenticated;

create or replace function public.admin_save_settings(p_plans jsonb, p_extras jsonb, p_implant jsonb, p_trial_days int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  update public.platform_settings set plans = coalesce(p_plans, plans), extras = coalesce(p_extras, extras), implant = coalesce(p_implant, implant),
    trial_days = coalesce(p_trial_days, trial_days), updated_at = now() where id = 1;
end $$;

-- Todas as contas da plataforma
create or replace function public.admin_tenants()
returns table (user_id uuid, email text, full_name text, plan text, status text, trial_ends_at timestamptz, current_period_end timestamptz,
  cycle text, requested_plan text, requested_cycle text, requested_method text, requested_at timestamptz, created_at timestamptz,
  orgs text, org_count int, members int, contacts int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  return query
  select s.user_id, u.email::text, p.full_name, s.plan, s.status, s.trial_ends_at, s.current_period_end, s.cycle,
    s.requested_plan, s.requested_cycle, s.requested_method, s.requested_at, u.created_at,
    (select string_agg(o.name, ' · ' order by o.created_at) from public.memberships m join public.organizations o on o.id = m.org_id where m.user_id = s.user_id and m.role = 'owner'),
    (select count(*)::int from public.memberships m where m.user_id = s.user_id and m.role = 'owner'),
    (select count(distinct m2.user_id)::int from public.memberships m join public.memberships m2 on m2.org_id = m.org_id where m.user_id = s.user_id and m.role = 'owner'),
    (select count(*)::int from public.contacts c join public.memberships m on m.org_id = c.org_id where m.user_id = s.user_id and m.role = 'owner')
  from public.subscriptions s join auth.users u on u.id = s.user_id left join public.profiles p on p.id = s.user_id
  order by s.requested_at desc nulls last, u.created_at desc;
end $$;

-- Liberar plano, dar dias de teste, suspender
create or replace function public.admin_set_subscription(p_user uuid, p_plan text, p_status text, p_cycle text default null,
  p_period_end timestamptz default null, p_trial_end timestamptz default null, p_clear_request boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  if p_plan not in ('ess', 'pro', 'adv', 'interno') or p_status not in ('trial', 'active', 'past_due', 'canceled') then raise exception 'plano ou situação inválida'; end if;
  update public.subscriptions set plan = p_plan, status = p_status, cycle = coalesce(p_cycle, cycle),
    current_period_end = coalesce(p_period_end, current_period_end), trial_ends_at = coalesce(p_trial_end, trial_ends_at),
    requested_plan = case when p_clear_request then null else requested_plan end,
    requested_cycle = case when p_clear_request then null else requested_cycle end,
    requested_method = case when p_clear_request then null else requested_method end,
    requested_at = case when p_clear_request then null else requested_at end,
    updated_at = now()
  where user_id = p_user;
end $$;

-- Conta nova: teste com os dias definidos no painel
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d int;
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  select trial_days into d from public.platform_settings where id = 1;
  insert into public.subscriptions (user_id, plan, status, trial_ends_at) values (new.id, 'adv', 'trial', now() + make_interval(days => coalesce(d, 7)))
    on conflict (user_id) do nothing;
  return new;
end $$;

revoke execute on function public.is_platform_admin(), public.admin_save_settings(jsonb, jsonb, jsonb, int), public.admin_tenants(),
  public.admin_set_subscription(uuid, text, text, text, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.is_platform_admin(), public.admin_save_settings(jsonb, jsonb, jsonb, int), public.admin_tenants(),
  public.admin_set_subscription(uuid, text, text, text, timestamptz, timestamptz, boolean) to authenticated;
