-- Lothem Vendas · motor da SDR IA no WhatsApp
-- Mensagem chega (wa_ingest) → o servidor pergunta ao banco se a IA pode responder (ai_bot_context) → busca na base
-- (ai_kb_find) → chama a IA com a chave do cliente → envia pela WAHA → grava a resposta (ai_bot_log), a ficha e a
-- memória (ai_bot_apply) e o gasto (ai_bot_usage). Tudo pela chave de serviço, nunca pelo navegador.
--
-- Modo do atendimento automático:
--   desligado · a IA não responde ninguém
--   teste     · responde só os números da lista de teste (padrão, para treinar sem tocar em cliente real)
--   todos     · responde todo mundo que escrever

alter table public.conversations add column if not exists ai_resumed_at timestamptz;
alter table public.ai_configs add column if not exists bot_mode text not null default 'teste';
alter table public.ai_configs add column if not exists test_numbers text[] not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ai_configs_bot_mode_check') then
    alter table public.ai_configs add constraint ai_configs_bot_mode_check check (bot_mode in ('desligado', 'teste', 'todos'));
  end if;
end $$;

-- A equipe (proprietária ou gestão) liga, desliga e escolhe os números de teste
create or replace function public.ai_bot_settings(p_org uuid)
returns table (bot_mode text, test_numbers text[]) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member(p_org) then raise exception 'sem acesso'; end if;
  return query select coalesce(c.bot_mode, 'teste'), coalesce(c.test_numbers, '{}') from (select 1) d left join public.ai_configs c on c.org_id = p_org;
end $$;

create or replace function public.ai_set_bot(p_org uuid, p_mode text, p_numbers text[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_nums text[];
begin
  if not public.is_admin(p_org) then raise exception 'só a proprietária ou a gestão'; end if;
  if p_mode not in ('desligado', 'teste', 'todos') then raise exception 'modo inválido'; end if;
  select coalesce(array_agg(distinct d), '{}') into v_nums
    from (select regexp_replace(n, '\D', '', 'g') d from unnest(coalesce(p_numbers, '{}')) n) x where length(d) between 10 and 15;
  insert into public.ai_configs (org_id) values (p_org) on conflict (org_id) do nothing;
  update public.ai_configs set bot_mode = p_mode, test_numbers = v_nums, updated_at = now() where org_id = p_org;
  perform public.ai_audit_log(p_org, 'atendimento_automatico', jsonb_build_object('modo', p_mode, 'numeros_de_teste', coalesce(array_length(v_nums, 1), 0)));
end $$;

-- Tudo o que o servidor precisa para decidir e responder
create or replace function public.ai_bot_context(p_conv uuid, p_wa_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cv record; ct record; cfg record; v_phone text; v_reason text; v_at timestamptz; v_spent numeric;
begin
  select * into cv from public.conversations where id = p_conv;
  if cv.id is null then return jsonb_build_object('reply', false, 'reason', 'conversa não encontrada'); end if;
  select * into ct from public.contacts where id = cv.contact_id;
  select * into cfg from public.ai_configs where org_id = cv.org_id;
  v_phone := regexp_replace(coalesce(public.pii_dec(cv.org_id, ct.phone_enc), ''), '\D', '', 'g');
  if p_wa_id is not null then select created_at into v_at from public.messages where org_id = cv.org_id and meta->>'wa_id' = p_wa_id limit 1; end if;
  select coalesce(sum(cost_usd), 0) into v_spent from public.ai_usage where org_id = cv.org_id and day >= date_trunc('month', now())::date;

  v_reason := case
    when cfg.org_id is null or cfg.key_enc is null or cfg.key_source <> 'cliente' then 'sem chave de IA cadastrada'
    when cfg.paused then 'IA pausada no Painel Mestre'
    when cfg.bot_mode = 'desligado' then 'atendimento automático desligado'
    when cfg.bot_mode = 'teste' and not exists (select 1 from unnest(cfg.test_numbers) n where length(v_phone) >= 8 and right(n, 8) = right(v_phone, 8)) then 'número fora da lista de teste'
    when ct.do_not_contact then 'contato marcado como não contatar'
    when cv.status in ('human', 'closed') then 'conversa com a equipe'
    when cv.status = 'waiting_human' and exists (select 1 from public.messages m where m.conversation_id = p_conv and m.meta->>'origem' = 'handoff' and m.created_at > coalesce(cv.ai_resumed_at, '-infinity')) then 'a IA já passou para a equipe'
    when exists (select 1 from public.messages m where m.conversation_id = p_conv and m.sender = 'user' and m.meta->>'origem' in ('crm', 'celular') and m.created_at > greatest(now() - interval '12 hours', coalesce(cv.ai_resumed_at, '-infinity'))) then 'a equipe respondeu nas últimas 12 horas'
    when v_at is not null and exists (select 1 from public.messages m where m.conversation_id = p_conv and m.sender = 'lead' and m.created_at > v_at) then 'chegou mensagem mais nova'
    when cfg.monthly_cap_usd is not null and v_spent >= cfg.monthly_cap_usd then 'limite de gasto do mês atingido'
    else null end;
  if v_reason is not null then return jsonb_build_object('reply', false, 'reason', v_reason); end if;

  return jsonb_build_object(
    'reply', true, 'org_id', cv.org_id, 'contact_id', ct.id,
    'provider', coalesce(cfg.provider, 'anthropic'), 'model', cfg.model, 'api_key', public.pii_dec(cv.org_id, cfg.key_enc),
    'system_prompt', cfg.system_prompt, 'blocked_terms', to_jsonb(cfg.blocked_terms), 'handoff_terms', to_jsonb(cfg.handoff_terms),
    'ia_name', coalesce((select o.settings->'ia'->>'name' from public.organizations o where o.id = cv.org_id), 'Cibelle'),
    'first_reply', not exists (select 1 from public.messages m where m.conversation_id = p_conv and m.sender = 'ia'),
    'contact', jsonb_build_object('nome', ct.name, 'empresa', ct.company, 'segmento', ct.segment, 'cidade', ct.city,
      'credito_pretendido', ct.credit_wanted, 'entrada', ct.entry_path, 'origem', ct.source),
    'memory', (select public.pii_dec(m.org_id, m.notes_enc) from public.contact_memory m where m.contact_id = ct.id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('de', x.sender, 'texto', x.body) order by x.created_at) from (
      select m.sender, public.pii_dec(cv.org_id, m.body_enc) body, m.created_at from public.messages m
      where m.conversation_id = p_conv and m.sender in ('lead', 'ia', 'user') order by m.created_at desc limit 30) x), '[]'::jsonb),
    'session', (select i.external_id from public.whatsapp_instances i where i.id = cv.instance_id), 'chat_id', cv.chat_id);
end $$;

-- Busca na base da organização (qualquer palavra conta; as mais parecidas primeiro)
create or replace function public.ai_kb_find(p_org uuid, p_q text)
returns table (title text, content text) language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select k.title, c.content from public.kb_chunks c join public.kb_items k on k.id = c.kb_id
  where c.org_id = p_org and c.tsv @@ websearch_to_tsquery('portuguese', p_q)
  order by ts_rank(c.tsv, websearch_to_tsquery('portuguese', p_q)) desc limit 6;
end $$;

-- Grava a mensagem que a IA enviou (se o aviso da WAHA chegou antes, só corrige o autor)
create or replace function public.ai_bot_log(p_conv uuid, p_body text, p_wa_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.conversations where id = p_conv;
  if v_org is null then return; end if;
  if p_wa_id is not null and exists (select 1 from public.messages where org_id = v_org and meta->>'wa_id' = p_wa_id) then
    update public.messages set sender = 'ia', author_id = null, body = p_body, meta = jsonb_build_object('wa_id', p_wa_id, 'origem', 'ia')
      where org_id = v_org and meta->>'wa_id' = p_wa_id;
  else
    insert into public.messages (org_id, conversation_id, sender, body, meta) values (v_org, p_conv, 'ia', p_body, jsonb_build_object('wa_id', p_wa_id, 'origem', 'ia'));
  end if;
  update public.conversations set last_message_at = now(), unread = 0, status = 'ia' where id = p_conv;
end $$;

-- Ficha, memória e passagem para a equipe
create or replace function public.ai_bot_apply(p_conv uuid, p_fields jsonb, p_memory text, p_handoff boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare cv record; f jsonb := coalesce(p_fields, '{}'::jsonb);
  v_nome text := nullif(btrim(f->>'nome'), ''); v_emp text := nullif(btrim(f->>'empresa'), '');
begin
  select * into cv from public.conversations where id = p_conv;
  if cv.id is null then return; end if;
  update public.contacts set
    name = coalesce(left(v_nome, 200), name),
    company = coalesce(left(v_emp, 200), company),
    kind = case when v_emp is not null then 'pj'::public.contact_kind else kind end,
    segment = coalesce(left(nullif(btrim(f->>'segmento'), ''), 120), segment),
    city = coalesce(left(nullif(btrim(f->>'cidade'), ''), 120), city),
    credit_wanted = coalesce(left(nullif(btrim(f->>'credito_pretendido'), ''), 200), credit_wanted),
    updated_at = now()
  where id = cv.contact_id;
  if nullif(btrim(coalesce(p_memory, '')), '') is not null then
    insert into public.contact_memory (contact_id, org_id, notes_enc, updated_by, updated_at)
    values (cv.contact_id, cv.org_id, public.pii_enc(cv.org_id, left(p_memory, 8000)), 'ia', now())
    on conflict (contact_id) do update set notes_enc = excluded.notes_enc, updated_by = 'ia', updated_at = now();
  end if;
  if p_handoff then
    insert into public.messages (org_id, conversation_id, sender, body, meta)
    values (cv.org_id, p_conv, 'system', 'A IA passou a conversa para a equipe: ' || coalesce(nullif(p_reason, ''), 'precisa de uma pessoa'), jsonb_build_object('origem', 'handoff'));
    update public.conversations set status = 'waiting_human', unread = greatest(unread, 1) where id = p_conv;
  end if;
end $$;

-- A equipe devolve a conversa para a IA (vale também depois de uma passagem ou de uma resposta da equipe)
create or replace function public.ai_take_back(p_conv uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.conversations where id = p_conv;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a esta conversa'; end if;
  update public.conversations set status = 'ia', assigned_to = null, ai_resumed_at = now() where id = p_conv;
  insert into public.messages (org_id, conversation_id, sender, author_id, body, meta) values (v_org, p_conv, 'system', auth.uid(), 'Conversa devolvida para a IA', jsonb_build_object('origem', 'devolvida'));
end $$;

-- Gasto por dia e modelo (aparece na auditoria do Painel Mestre)
create or replace function public.ai_bot_usage(p_org uuid, p_model text, p_in bigint, p_out bigint, p_cache bigint, p_cost numeric, p_new_conv boolean)
returns void language sql security definer set search_path = '' as $$
  insert into public.ai_usage (org_id, day, model, conversations, input_tokens, output_tokens, cache_read_tokens, cost_usd)
  values (p_org, (now() at time zone 'America/Sao_Paulo')::date, p_model, case when p_new_conv then 1 else 0 end, p_in, p_out, p_cache, p_cost)
  on conflict (org_id, day, model) do update set
    conversations = public.ai_usage.conversations + excluded.conversations,
    input_tokens = public.ai_usage.input_tokens + excluded.input_tokens,
    output_tokens = public.ai_usage.output_tokens + excluded.output_tokens,
    cache_read_tokens = public.ai_usage.cache_read_tokens + excluded.cache_read_tokens,
    cost_usd = public.ai_usage.cost_usd + excluded.cost_usd;
$$;

revoke execute on function public.ai_bot_settings(uuid), public.ai_set_bot(uuid, text, text[]), public.ai_bot_context(uuid, text),
  public.ai_kb_find(uuid, text), public.ai_bot_log(uuid, text, text), public.ai_bot_apply(uuid, jsonb, text, boolean, text),
  public.ai_bot_usage(uuid, text, bigint, bigint, bigint, numeric, boolean), public.ai_take_back(uuid) from public, anon, authenticated;
grant execute on function public.ai_bot_settings(uuid), public.ai_set_bot(uuid, text, text[]), public.ai_take_back(uuid) to authenticated;
grant execute on function public.ai_bot_context(uuid, text), public.ai_kb_find(uuid, text), public.ai_bot_log(uuid, text, text),
  public.ai_bot_apply(uuid, jsonb, text, boolean, text), public.ai_bot_usage(uuid, text, bigint, bigint, bigint, numeric, boolean) to service_role;
