-- Lothem Vendas · WhatsApp com número escondido (LID)
-- Quando o WhatsApp manda só o código da conversa (@lid), o contato pode nascer sem telefone. Agora, se a mesma conversa
-- chegar depois com o número descoberto, o telefone é preenchido no contato (cifrado, com impressão digital).

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
  if d is not null then h := encode(extensions.hmac(d, public.pii_key(), 'sha256'), 'hex'); end if;
  if v_contact is null and d is not null then
    select id into v_contact from public.contacts where org_id = v_org and phone_hash = h limit 1;
  end if;
  if v_contact is null then
    insert into public.contacts (org_id, kind, name, source, lifecycle)
    values (v_org, 'pf', left(coalesce(nullif(btrim(p_name), ''), case when d is not null then '+' || d else 'Contato do WhatsApp' end), 200), 'WhatsApp', 'lead')
    returning id into v_contact;
  end if;
  -- telefone que faltava (contato criado quando o WhatsApp escondeu o número)
  if d is not null then
    update public.contacts set phone_enc = public.pii_enc(v_org, '+' || d), phone_hint = right(d, 4), phone_hash = h
    where id = v_contact and phone_enc is null;
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

revoke execute on function public.wa_ingest(text, text, text, text, text, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.wa_ingest(text, text, text, text, text, text, boolean, timestamptz) to service_role;
