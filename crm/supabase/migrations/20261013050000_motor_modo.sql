-- Lothem Vendas · modo de operação da SDR IA no motor do WhatsApp
-- Copiloto: a IA não envia; deixa a resposta sugerida na conversa para a equipe revisar e enviar.
-- Supervisionado: envia; quando precisa passar para a equipe, segura a mensagem e deixa como sugestão.
-- Autônomo: envia tudo, inclusive o aviso de que vai chamar a equipe.
-- O modo é o mesmo escolhido em SDR IA › Visão geral › Modo de operação (organizations.settings.ia.mode).

create or replace function public.ai_bot_context(p_conv uuid, p_wa_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cv record; ct record; cfg record; v_phone text; v_reason text; v_at timestamptz; v_spent numeric; v_op text;
begin
  select * into cv from public.conversations where id = p_conv;
  if cv.id is null then return jsonb_build_object('reply', false, 'reason', 'conversa não encontrada'); end if;
  select * into ct from public.contacts where id = cv.contact_id;
  select * into cfg from public.ai_configs where org_id = cv.org_id;
  v_phone := regexp_replace(coalesce(public.pii_dec(cv.org_id, ct.phone_enc), ''), '\D', '', 'g');
  if p_wa_id is not null then select created_at into v_at from public.messages where org_id = cv.org_id and meta->>'wa_id' = p_wa_id limit 1; end if;
  select coalesce(o.settings->'ia'->>'mode', 'sup') into v_op from public.organizations o where o.id = cv.org_id;
  select coalesce(sum(cost_usd), 0) into v_spent from public.ai_usage where org_id = cv.org_id and day >= date_trunc('month', now())::date;

  v_reason := case
    when cfg.org_id is null or cfg.key_enc is null or cfg.key_source <> 'cliente' then 'sem chave de IA cadastrada'
    when cfg.paused then 'IA pausada no Painel Mestre'
    when cfg.bot_mode = 'desligado' then 'atendimento automático desligado'
    when cfg.bot_mode = 'teste' and not exists (select 1 from unnest(cfg.test_numbers) n where length(v_phone) >= 8 and right(n, 8) = right(v_phone, 8)) then 'número fora da lista de teste'
    when ct.do_not_contact then 'contato marcado como não contatar'
    when cv.status = 'closed' then 'conversa encerrada'
    when v_op <> 'cop' and cv.status = 'human' then 'conversa com a equipe'
    when cv.status = 'waiting_human' and exists (select 1 from public.messages m where m.conversation_id = p_conv and m.meta->>'origem' = 'handoff' and m.created_at > coalesce(cv.ai_resumed_at, '-infinity')) then 'a IA já passou para a equipe'
    when v_op <> 'cop' and exists (select 1 from public.messages m where m.conversation_id = p_conv and m.sender = 'user' and m.meta->>'origem' in ('crm', 'celular') and m.created_at > greatest(now() - interval '12 hours', coalesce(cv.ai_resumed_at, '-infinity'))) then 'a equipe respondeu nas últimas 12 horas'
    when v_at is not null and exists (select 1 from public.messages m where m.conversation_id = p_conv and m.sender = 'lead' and m.created_at > v_at) then 'chegou mensagem mais nova'
    when cfg.monthly_cap_usd is not null and v_spent >= cfg.monthly_cap_usd then 'limite de gasto do mês atingido'
    else null end;
  if v_reason is not null then return jsonb_build_object('reply', false, 'reason', v_reason); end if;

  return jsonb_build_object(
    'reply', true, 'org_id', cv.org_id, 'contact_id', ct.id, 'op_mode', v_op,
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

-- Sugestão da IA (copiloto ou mensagem segurada): nota interna na conversa, só a equipe vê
create or replace function public.ai_bot_suggest(p_conv uuid, p_text text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.conversations where id = p_conv;
  if v_org is null then return; end if;
  insert into public.messages (org_id, conversation_id, sender, body, meta)
  values (v_org, p_conv, 'note', 'Sugestão da IA' || case when nullif(p_reason, '') is not null then ' (' || p_reason || ')' else '' end || ': ' || chr(10) || p_text, jsonb_build_object('origem', 'sugestao'));
  update public.conversations set status = case when status = 'human' then status else 'waiting_human' end, unread = greatest(unread, 1), last_message_at = now() where id = p_conv;
end $$;

revoke execute on function public.ai_bot_context(uuid, text), public.ai_bot_suggest(uuid, text, text) from public, anon, authenticated;
grant execute on function public.ai_bot_context(uuid, text), public.ai_bot_suggest(uuid, text, text) to service_role;
