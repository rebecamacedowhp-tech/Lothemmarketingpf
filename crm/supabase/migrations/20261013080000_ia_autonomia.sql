-- Lothem Vendas · o cliente cuida da própria IA no CRM dele
-- Painel do cliente: chave, modelo, gasto do mês, limite, aviso e o último problema com a conta de IA
-- (ex.: créditos acabaram, chave inválida). O motor grava o problema; a primeira resposta boa limpa.

alter table public.ai_configs add column if not exists last_error text;
alter table public.ai_configs add column if not exists last_error_kind text;
alter table public.ai_configs add column if not exists last_error_at timestamptz;

-- Tudo o que o cliente vê na aba "IA e custos" (sem a chave)
create or replace function public.ai_client_panel(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c record; v_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if not public.is_member(p_org) then raise exception 'sem acesso'; end if;
  select * into c from public.ai_configs where org_id = p_org;
  return jsonb_build_object(
    'can_edit', public.is_admin(p_org),
    'provider', coalesce(c.provider, 'anthropic'), 'model', coalesce(c.model, 'claude-sonnet-5-5'),
    'key_hint', c.key_hint, 'key_set_at', c.key_set_at, 'paused', coalesce(c.paused, false),
    'monthly_cap_usd', c.monthly_cap_usd, 'alert_pct', coalesce(c.alert_pct, 80), 'bot_mode', coalesce(c.bot_mode, 'teste'),
    'last_error', c.last_error, 'last_error_kind', c.last_error_kind, 'last_error_at', c.last_error_at,
    'month', (select jsonb_build_object('cost', coalesce(sum(u.cost_usd), 0), 'input', coalesce(sum(u.input_tokens), 0),
        'output', coalesce(sum(u.output_tokens), 0), 'cache', coalesce(sum(u.cache_read_tokens), 0), 'conversations', coalesce(sum(u.conversations), 0))
      from public.ai_usage u where u.org_id = p_org and u.day >= v_month),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', u.day, 'model', u.model, 'cost', u.cost_usd, 'conversations', u.conversations) order by u.day)
      from public.ai_usage u where u.org_id = p_org and u.day >= (now() - interval '30 days')::date), '[]'::jsonb));
end $$;

-- O cliente (proprietária ou gestão) escolhe modelo, limite, aviso e pausa
create or replace function public.ai_client_save(p_org uuid, p_model text, p_cap numeric, p_alert int, p_paused boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_prov text;
begin
  if not public.is_admin(p_org) then raise exception 'só a proprietária ou a gestão'; end if;
  insert into public.ai_configs (org_id) values (p_org) on conflict (org_id) do nothing;
  select provider into v_prov from public.ai_configs where org_id = p_org;
  if p_model is not null and ((v_prov = 'openai' and p_model not like 'gpt-%') or (coalesce(v_prov, 'anthropic') = 'anthropic' and p_model not like 'claude-%')) then
    raise exception 'esse modelo não é da empresa da sua chave';
  end if;
  if p_cap is not null and p_cap < 0 then raise exception 'limite inválido'; end if;
  update public.ai_configs set model = coalesce(p_model, model), monthly_cap_usd = p_cap,
    alert_pct = coalesce(least(greatest(p_alert, 10), 100), alert_pct), paused = coalesce(p_paused, paused), updated_at = now()
  where org_id = p_org;
  perform public.ai_audit_log(p_org, 'configuracao_pelo_cliente', jsonb_build_object('modelo', p_model, 'limite_usd', p_cap, 'aviso_pct', p_alert, 'pausada', p_paused));
end $$;

-- O motor avisa quando a IA falha (créditos, chave, limite de uso)
create or replace function public.ai_bot_error(p_org uuid, p_kind text, p_msg text)
returns void language sql security definer set search_path = '' as $$
  update public.ai_configs set last_error = left(p_msg, 300), last_error_kind = p_kind, last_error_at = now() where org_id = p_org;
$$;

-- Gasto por dia e modelo; uma resposta que deu certo limpa o aviso de problema
create or replace function public.ai_bot_usage(p_org uuid, p_model text, p_in bigint, p_out bigint, p_cache bigint, p_cost numeric, p_new_conv boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ai_usage (org_id, day, model, conversations, input_tokens, output_tokens, cache_read_tokens, cost_usd)
  values (p_org, (now() at time zone 'America/Sao_Paulo')::date, p_model, case when p_new_conv then 1 else 0 end, p_in, p_out, p_cache, p_cost)
  on conflict (org_id, day, model) do update set
    conversations = public.ai_usage.conversations + excluded.conversations,
    input_tokens = public.ai_usage.input_tokens + excluded.input_tokens,
    output_tokens = public.ai_usage.output_tokens + excluded.output_tokens,
    cache_read_tokens = public.ai_usage.cache_read_tokens + excluded.cache_read_tokens,
    cost_usd = public.ai_usage.cost_usd + excluded.cost_usd;
  update public.ai_configs set last_error = null, last_error_kind = null, last_error_at = null where org_id = p_org and last_error is not null;
end $$;

revoke execute on function public.ai_client_panel(uuid), public.ai_client_save(uuid, text, numeric, int, boolean),
  public.ai_bot_error(uuid, text, text), public.ai_bot_usage(uuid, text, bigint, bigint, bigint, numeric, boolean) from public, anon, authenticated;
grant execute on function public.ai_client_panel(uuid), public.ai_client_save(uuid, text, numeric, int, boolean) to authenticated;
grant execute on function public.ai_bot_error(uuid, text, text), public.ai_bot_usage(uuid, text, bigint, bigint, bigint, numeric, boolean) to service_role;
