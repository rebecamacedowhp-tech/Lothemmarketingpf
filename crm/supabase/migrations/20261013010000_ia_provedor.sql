-- Lothem Vendas · a IA do cliente pode ser Claude (Anthropic) ou GPT (OpenAI)
-- O provedor é reconhecido pelo começo da chave: sk-ant- é Anthropic; os demais sk- são OpenAI.

create or replace function public.ai_provider_of(p_key text)
returns text language sql immutable set search_path = '' as $$
  select case when btrim(p_key) like 'sk-ant-%' then 'anthropic' when btrim(p_key) like 'sk-%' then 'openai' else 'anthropic' end;
$$;
revoke execute on function public.ai_provider_of(text) from public, anon, authenticated;

-- chaves já cadastradas: descobre o provedor e acerta o modelo padrão
update public.ai_configs set provider = public.ai_provider_of(public.pii_dec(org_id, key_enc)) where key_enc is not null;
update public.ai_configs set model = 'gpt-6.1-sol' where provider = 'openai' and model like 'claude-%';

create or replace function public.admin_ai_set_key(p_org uuid, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_prov text := public.ai_provider_of(p_key);
begin
  if not public.is_platform_admin() then raise exception 'só a administração da plataforma'; end if;
  if p_key is null or length(btrim(p_key)) < 20 then raise exception 'chave inválida'; end if;
  insert into public.ai_configs (org_id) values (p_org) on conflict (org_id) do nothing;
  update public.ai_configs set key_enc = public.pii_enc(p_org, btrim(p_key)), key_hint = right(btrim(p_key), 4), key_source = 'cliente', key_set_at = now(),
    provider = v_prov, model = case when v_prov = 'openai' and model like 'claude-%' then 'gpt-6.1-sol' when v_prov = 'anthropic' and model not like 'claude-%' then 'claude-sonnet-5-5' else model end,
    updated_at = now() where org_id = p_org;
  perform public.ai_audit_log(p_org, 'chave_alterada', jsonb_build_object('final', right(btrim(p_key), 4), 'provedor', v_prov));
end $$;

create or replace function public.ai_set_my_key(p_org uuid, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_prov text := public.ai_provider_of(p_key);
begin
  if not public.is_admin(p_org) then raise exception 'só a proprietária ou a gestão'; end if;
  if p_key is null or length(btrim(p_key)) < 20 then raise exception 'chave inválida'; end if;
  insert into public.ai_configs (org_id) values (p_org) on conflict (org_id) do nothing;
  update public.ai_configs set key_enc = public.pii_enc(p_org, btrim(p_key)), key_hint = right(btrim(p_key), 4), key_source = 'cliente', key_set_at = now(),
    provider = v_prov, model = case when v_prov = 'openai' and model like 'claude-%' then 'gpt-6.1-sol' when v_prov = 'anthropic' and model not like 'claude-%' then 'claude-sonnet-5-5' else model end,
    updated_at = now() where org_id = p_org;
  perform public.ai_audit_log(p_org, 'chave_alterada', jsonb_build_object('final', right(btrim(p_key), 4), 'provedor', v_prov, 'por', 'cliente'));
end $$;

drop function if exists public.ai_my_status(uuid);
create function public.ai_my_status(p_org uuid)
returns table (key_source text, key_hint text, model text, paused boolean, provider text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member(p_org) then raise exception 'sem acesso'; end if;
  return query select coalesce(c.key_source, 'cliente'), c.key_hint, coalesce(c.model, 'claude-opus-5-5'), coalesce(c.paused, false), coalesce(c.provider, 'anthropic')
    from (select 1) d left join public.ai_configs c on c.org_id = p_org;
end $$;

drop function if exists public.admin_ai_overview();
create function public.admin_ai_overview()
returns table (org_id uuid, org_name text, owner_email text, ia_name text, model text, key_source text, key_hint text,
  monthly_cap_usd numeric, paused boolean, month_cost_usd numeric, month_conversations bigint, month_tokens bigint, kb_docs bigint, kb_chunks bigint, provider text)
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
    (select count(*) from public.kb_chunks k where k.org_id = o.id),
    coalesce(c.provider, 'anthropic')
  from public.organizations o left join public.ai_configs c on c.org_id = o.id
  order by o.created_at;
end $$;

-- o servidor da IA precisa saber o provedor junto com a chave
drop function if exists public.ai_key_for_server(uuid);
create function public.ai_key_for_server(p_org uuid)
returns table (provider text, model text, api_key text) language sql stable security definer set search_path = '' as $$
  select c.provider, c.model, public.pii_dec(p_org, c.key_enc) from public.ai_configs c where c.org_id = p_org and c.key_source = 'cliente';
$$;

revoke execute on function public.ai_my_status(uuid), public.admin_ai_overview(), public.ai_key_for_server(uuid) from public, anon;
grant execute on function public.ai_my_status(uuid), public.admin_ai_overview() to authenticated;
revoke execute on function public.ai_key_for_server(uuid) from authenticated;
grant execute on function public.ai_key_for_server(uuid) to service_role;
