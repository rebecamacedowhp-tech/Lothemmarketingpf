-- Lothem Vendas · WhatsApp pela WAHA
-- Mensagem que chega na WAHA → servidor do CRM (chave de serviço) → wa_ingest: acha ou cria o contato e a conversa
-- e grava a mensagem (o texto é cifrado pelo gatilho). Mensagem enviada pelo CRM → wa_send_target + wa_log_sent.

alter table public.conversations add column if not exists chat_id text;
create index if not exists conversations_chat_idx on public.conversations (org_id, chat_id);
create unique index if not exists messages_wa_id_uidx on public.messages (org_id, (meta->>'wa_id')) where meta ? 'wa_id';
create index if not exists whatsapp_instances_ext_idx on public.whatsapp_instances (external_id);

create or replace function public.wa_ingest(p_session text, p_chat_id text, p_phone text, p_name text, p_body text,
  p_wa_id text, p_from_me boolean, p_ts timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_inst uuid; v_contact uuid; v_conv uuid; d text; h text;
begin
  select id, org_id into v_inst, v_org from public.whatsapp_instances where external_id = p_session and kind = 'nao_oficial' order by created_at limit 1;
  if v_org is null then return null; end if;
  if p_wa_id is not null and exists (select 1 from public.messages where org_id = v_org and meta->>'wa_id' = p_wa_id) then return null; end if;

  -- conversa já existente por esse chat
  select c.id, c.contact_id into v_conv, v_contact from public.conversations c where c.org_id = v_org and c.chat_id = p_chat_id order by c.created_at desc limit 1;

  -- contato pelo telefone (impressão digital, sem abrir o número)
  d := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  if v_contact is null and d is not null then
    h := encode(extensions.hmac(d, public.pii_key(), 'sha256'), 'hex');
    select id into v_contact from public.contacts where org_id = v_org and phone_hash = h limit 1;
  end if;
  if v_contact is null then
    insert into public.contacts (org_id, kind, name, source, lifecycle)
    values (v_org, 'pf', left(coalesce(nullif(btrim(p_name), ''), case when d is not null then '+' || d else 'Contato do WhatsApp' end), 200), 'WhatsApp', 'lead')
    returning id into v_contact;
    if d is not null then
      update public.contacts set phone_enc = public.pii_enc(v_org, '+' || d), phone_hint = right(d, 4),
        phone_hash = encode(extensions.hmac(d, public.pii_key(), 'sha256'), 'hex') where id = v_contact;
    end if;
  end if;

  if v_conv is null then
    select id into v_conv from public.conversations where org_id = v_org and contact_id = v_contact and status <> 'closed' order by created_at desc limit 1;
    if v_conv is null then
      insert into public.conversations (org_id, contact_id, instance_id, status, chat_id, last_message_at)
      values (v_org, v_contact, v_inst, 'waiting_human', p_chat_id, coalesce(p_ts, now())) returning id into v_conv;
    else
      update public.conversations set chat_id = p_chat_id where id = v_conv and chat_id is null;
    end if;
  end if;

  insert into public.messages (org_id, conversation_id, sender, body, meta, created_at)
  values (v_org, v_conv, (case when p_from_me then 'user' else 'lead' end)::public.msg_from, coalesce(nullif(p_body, ''), '[mídia]'),
    jsonb_build_object('wa_id', p_wa_id, 'origem', case when p_from_me then 'celular' else 'whatsapp' end), coalesce(p_ts, now()));

  update public.conversations set last_message_at = coalesce(p_ts, now()),
    unread = case when p_from_me then 0 else unread + 1 end,
    status = case when status = 'closed' and not p_from_me then 'waiting_human' else status end
  where id = v_conv;
  return v_conv;
end $$;

-- Para enviar: só quem é da organização descobre a sessão e o chat da conversa
create or replace function public.wa_send_target(p_conversation uuid)
returns table (session text, chat_id text) language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.conversations where id = p_conversation;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a esta conversa'; end if;
  return query select i.external_id, c.chat_id from public.conversations c join public.whatsapp_instances i on i.id = c.instance_id where c.id = p_conversation;
end $$;

create or replace function public.wa_log_sent(p_conversation uuid, p_body text, p_wa_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.conversations where id = p_conversation;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a esta conversa'; end if;
  if p_wa_id is not null and exists (select 1 from public.messages where org_id = v_org and meta->>'wa_id' = p_wa_id) then return; end if;
  insert into public.messages (org_id, conversation_id, sender, author_id, body, meta) values (v_org, p_conversation, 'user', auth.uid(), p_body, jsonb_build_object('wa_id', p_wa_id, 'origem', 'crm'));
  update public.conversations set last_message_at = now(), unread = 0, status = 'human', assigned_to = coalesce(assigned_to, auth.uid()) where id = p_conversation;
end $$;

revoke execute on function public.wa_ingest(text, text, text, text, text, text, boolean, timestamptz), public.wa_send_target(uuid), public.wa_log_sent(uuid, text, text) from public, anon, authenticated;
grant execute on function public.wa_ingest(text, text, text, text, text, text, boolean, timestamptz) to service_role;
grant execute on function public.wa_send_target(uuid), public.wa_log_sent(uuid, text, text) to authenticated;
