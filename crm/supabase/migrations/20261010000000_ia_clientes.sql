-- Lothem Vendas · IA de cada cliente (Painel Mestre)
-- Chave de API própria do cliente (cifrada), modelo, limite de gasto, auditoria, instruções e base de conhecimento (RAG).
-- A chave nunca volta para o navegador: só o servidor da IA (chave de serviço) consegue lê-la.

create table if not exists public.ai_configs (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null default 'anthropic',
  key_source text not null default 'cliente' check (key_source in ('lothem', 'cliente')),
  key_enc bytea,
  key_hint text,
  key_set_at timestamptz,
  model text not null default 'claude-opus-5-5',
  effort text not null default 'medium' check (effort in ('low', 'medium', 'high')),
  monthly_cap_usd numeric(10,2),
  alert_pct int not null default 80 check (alert_pct between 10 and 100),
  on_cap text not null default 'pausar' check (on_cap in ('pausar', 'avisar')),
  paused boolean not null default false,
  system_prompt text,
  prompt_version int not null default 1,
  blocked_terms text[] not null default '{}',
  handoff_terms text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  day date not null,
  model text not null,
  conversations int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  cost_usd numeric(12,4) not null default 0,
  unique (org_id, day, model)
);

create table if not exists public.ai_audit (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_audit_org_idx on public.ai_audit (org_id, created_at desc);

-- Crédito pretendido, preenchido pela IA na conversa (nicho de crédito)
alter table public.contacts add column if not exists credit_wanted text;

-- RAG: cada documento da base vira trechos pesquisáveis em português
create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kb_id uuid not null references public.kb_items(id) on delete cascade,
  n int not null,
  content text not null,
  tsv tsvector generated always as (to_tsvector('portuguese', content)) stored
);
create index if not exists kb_chunks_tsv_idx on public.kb_chunks using gin (tsv);
create index if not exists kb_chunks_org_idx on public.kb_chunks (org_id);

alter table public.ai_configs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_audit enable row level security;
alter table public.kb_chunks enable row level security;
-- configuração e auditoria: só por função. Uso e trechos: a própria organização pode ler.
revoke all on public.ai_configs, public.ai_audit from anon, authenticated;
revoke all on public.ai_usage, public.kb_chunks from anon;
grant select on public.ai_usage to authenticated;
grant select, insert, delete on public.kb_chunks to authenticated;
drop policy if exists ai_usage_read on public.ai_usage;
create policy ai_usage_read on public.ai_usage for select to authenticated using (public.is_member(org_id));
drop policy if exists kb_chunks_members on public.kb_chunks;
create policy kb_chunks_members on public.kb_chunks for all to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));

create or replace function public.ai_audit_log(p_org uuid, p_action text, p_detail jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.ai_audit (org_id, actor_id, action, detail) values (p_org, auth.uid(), p_action, coalesce(p_detail, '{}'::jsonb));
$$;

-- Visão geral de todas as organizações
create or replace function public.admin_ai_overview()
returns table (org_id uuid, org_name text, owner_email text, ia_name text, model text, key_source text, key_hint text,
  monthly_cap_usd numeric, paused boolean, month_cost_usd numeric, month_conversations bigint, month_tokens bigint, kb_docs bigint, kb_chunks bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  return query
  select o.id, o.name,
    (select u.email::text from public.memberships m join auth.users u on u.id = m.user_id where m.org_id = o.id and m.role = 'owner' limit 1),
    coalesce(o.settings->'ia'->>'name', 'Cibelle'),
    coalesce(c.model, 'claude-opus-5-5'), coalesce(c.key_source, 'cliente'), c.key_hint, c.monthly_cap_usd, coalesce(c.paused, false),
    coalesce((select sum(x.cost_usd) from public.ai_usage x where x.org_id = o.id and x.day >= date_trunc('month', now())::date), 0),
    coalesce((select sum(x.conversations) from public.ai_usage x where x.org_id = o.id and x.day >= date_trunc('month', now())::date), 0)::bigint,
    coalesce((select sum(x.input_tokens + x.output_tokens) from public.ai_usage x where x.org_id = o.id and x.day >= date_trunc('month', now())::date), 0)::bigint,
    (select count(*) from public.kb_items k where k.org_id = o.id),
    (select count(*) from public.kb_chunks k where k.org_id = o.id)
  from public.organizations o left join public.ai_configs c on c.org_id = o.id
  order by o.created_at;
end $$;

-- Detalhe de uma organização (sem a chave)
create or replace function public.admin_ai_get(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cfg jsonb;
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  select to_jsonb(c) - 'key_enc' into cfg from public.ai_configs c where c.org_id = p_org;
  return jsonb_build_object(
    'config', coalesce(cfg, '{}'::jsonb),
    'usage', coalesce((select jsonb_agg(to_jsonb(u) order by u.day) from public.ai_usage u where u.org_id = p_org and u.day >= (now() - interval '30 days')::date), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('at', a.created_at, 'action', a.action, 'detail', a.detail, 'by', (select p.full_name from public.profiles p where p.id = a.actor_id)) order by a.created_at desc)
      from (select * from public.ai_audit where org_id = p_org order by created_at desc limit 50) a), '[]'::jsonb),
    'kb', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'category', k.category, 'created_at', k.created_at,
      'chunks', (select count(*) from public.kb_chunks c where c.kb_id = k.id)) order by k.created_at desc) from public.kb_items k where k.org_id = p_org), '[]'::jsonb));
end $$;

-- Salvar modelo, limites, instruções e regras
create or replace function public.admin_ai_save(p_org uuid, p_cfg jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare old public.ai_configs;
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  insert into public.ai_configs (org_id) values (p_org) on conflict (org_id) do nothing;
  select * into old from public.ai_configs where org_id = p_org;
  update public.ai_configs set
    model = coalesce(p_cfg->>'model', model),
    effort = coalesce(p_cfg->>'effort', effort),
    key_source = case when p_cfg ? 'key_source' then p_cfg->>'key_source' else key_source end,
    monthly_cap_usd = case when p_cfg ? 'monthly_cap_usd' then nullif(p_cfg->>'monthly_cap_usd', '')::numeric else monthly_cap_usd end,
    alert_pct = coalesce((p_cfg->>'alert_pct')::int, alert_pct),
    on_cap = coalesce(p_cfg->>'on_cap', on_cap),
    paused = coalesce((p_cfg->>'paused')::boolean, paused),
    system_prompt = case when p_cfg ? 'system_prompt' then p_cfg->>'system_prompt' else system_prompt end,
    prompt_version = case when p_cfg ? 'system_prompt' and (p_cfg->>'system_prompt') is distinct from system_prompt then prompt_version + 1 else prompt_version end,
    blocked_terms = case when p_cfg ? 'blocked_terms' then array(select jsonb_array_elements_text(p_cfg->'blocked_terms')) else blocked_terms end,
    handoff_terms = case when p_cfg ? 'handoff_terms' then array(select jsonb_array_elements_text(p_cfg->'handoff_terms')) else handoff_terms end,
    updated_at = now()
  where org_id = p_org;
  perform public.ai_audit_log(p_org, 'configuracao_alterada', (select jsonb_object_agg(k, true) from jsonb_object_keys(p_cfg) k));
end $$;

-- Chave de API do cliente: entra cifrada, só a dica dos 4 últimos caracteres fica visível
create or replace function public.admin_ai_set_key(p_org uuid, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  if p_key is null or length(btrim(p_key)) < 20 then raise exception 'chave inválida'; end if;
  insert into public.ai_configs (org_id) values (p_org) on conflict (org_id) do nothing;
  update public.ai_configs set key_enc = public.pii_enc(p_org, btrim(p_key)), key_hint = right(btrim(p_key), 4), key_source = 'cliente', key_set_at = now(), updated_at = now() where org_id = p_org;
  perform public.ai_audit_log(p_org, 'chave_alterada', jsonb_build_object('final', right(btrim(p_key), 4)));
end $$;

create or replace function public.admin_ai_clear_key(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  update public.ai_configs set key_enc = null, key_hint = null, key_source = 'lothem', key_set_at = null, updated_at = now() where org_id = p_org;
  perform public.ai_audit_log(p_org, 'chave_removida', '{}'::jsonb);
end $$;

-- RAG: adicionar documento já dividido em trechos, remover e testar a busca
create or replace function public.admin_kb_add(p_org uuid, p_title text, p_category text, p_chunks text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare kid uuid; i int;
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  insert into public.kb_items (org_id, title, category, content, status) values (p_org, p_title, coalesce(p_category, 'Treinamento'), left(array_to_string(p_chunks, E'\n'), 200000), 'ready') returning id into kid;
  for i in 1 .. coalesce(array_length(p_chunks, 1), 0) loop
    insert into public.kb_chunks (org_id, kb_id, n, content) values (p_org, kid, i, p_chunks[i]);
  end loop;
  perform public.ai_audit_log(p_org, 'rag_documento_adicionado', jsonb_build_object('titulo', p_title, 'trechos', coalesce(array_length(p_chunks, 1), 0)));
  return kid;
end $$;

create or replace function public.admin_kb_delete(p_kb uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_title text;
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  select org_id, title into v_org, v_title from public.kb_items where id = p_kb;
  delete from public.kb_items where id = p_kb;
  if v_org is not null then perform public.ai_audit_log(v_org, 'rag_documento_removido', jsonb_build_object('titulo', v_title)); end if;
end $$;

create or replace function public.admin_kb_search(p_org uuid, p_q text)
returns table (kb_id uuid, title text, n int, content text, rank real)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  return query
  select c.kb_id, k.title, c.n, c.content, ts_rank(c.tsv, websearch_to_tsquery('portuguese', p_q))
  from public.kb_chunks c join public.kb_items k on k.id = c.kb_id
  where c.org_id = p_org and c.tsv @@ websearch_to_tsquery('portuguese', p_q)
  order by 5 desc limit 5;
end $$;

-- O próprio cliente (proprietária ou gestão) cadastra a chave da sua organização
create or replace function public.ai_my_status(p_org uuid)
returns table (key_source text, key_hint text, model text, paused boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member(p_org) then raise exception 'sem acesso'; end if;
  return query select coalesce(c.key_source, 'cliente'), c.key_hint, coalesce(c.model, 'claude-opus-5-5'), coalesce(c.paused, false)
    from (select 1) d left join public.ai_configs c on c.org_id = p_org;
end $$;

create or replace function public.ai_set_my_key(p_org uuid, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin(p_org) then raise exception 'só a proprietária ou a gestão'; end if;
  if p_key is null or length(btrim(p_key)) < 20 then raise exception 'chave inválida'; end if;
  insert into public.ai_configs (org_id) values (p_org) on conflict (org_id) do nothing;
  update public.ai_configs set key_enc = public.pii_enc(p_org, btrim(p_key)), key_hint = right(btrim(p_key), 4), key_source = 'cliente', key_set_at = now(), updated_at = now() where org_id = p_org;
  perform public.ai_audit_log(p_org, 'chave_alterada', jsonb_build_object('final', right(btrim(p_key), 4), 'por', 'cliente'));
end $$;
revoke execute on function public.ai_my_status(uuid), public.ai_set_my_key(uuid, text) from public, anon;
grant execute on function public.ai_my_status(uuid), public.ai_set_my_key(uuid, text) to authenticated;

-- Só o servidor da IA (chave de serviço) lê a chave do cliente
create or replace function public.ai_key_for_server(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select public.pii_dec(p_org, key_enc) from public.ai_configs where org_id = p_org and key_source = 'cliente';
$$;

revoke execute on function public.ai_audit_log(uuid, text, jsonb), public.admin_ai_overview(), public.admin_ai_get(uuid), public.admin_ai_save(uuid, jsonb),
  public.admin_ai_set_key(uuid, text), public.admin_ai_clear_key(uuid), public.admin_kb_add(uuid, text, text, text[]), public.admin_kb_delete(uuid),
  public.admin_kb_search(uuid, text), public.ai_key_for_server(uuid) from public, anon, authenticated;
grant execute on function public.admin_ai_overview(), public.admin_ai_get(uuid), public.admin_ai_save(uuid, jsonb), public.admin_ai_set_key(uuid, text),
  public.admin_ai_clear_key(uuid), public.admin_kb_add(uuid, text, text, text[]), public.admin_kb_delete(uuid), public.admin_kb_search(uuid, text) to authenticated;
grant execute on function public.ai_key_for_server(uuid) to service_role;
