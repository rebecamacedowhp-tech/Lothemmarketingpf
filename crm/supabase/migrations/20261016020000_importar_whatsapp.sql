-- Lothem Vendas · importar conversas antigas do WhatsApp (por etiqueta)
-- O servidor lê o histórico na WAHA, a IA resume a conversa e preenche a ficha, e tudo entra aqui de uma vez:
-- contato (sem apagar o que já existe), conversa, mensagens que ainda não estavam no CRM e a etiqueta de origem.

create or replace function public.wa_import_chat(p_session text, p_chat_id text, p_phone text, p_name text, p_label text,
  p_msgs jsonb, p_ficha jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_inst uuid; v_contact uuid; v_conv uuid; d text; h text; v_last timestamptz; v_old text; f jsonb := coalesce(p_ficha, '{}'::jsonb);
begin
  select id, org_id into v_inst, v_org from public.whatsapp_instances where external_id = p_session and kind = 'nao_oficial' order by created_at limit 1;
  if v_org is null then return null; end if;
  select max((x->>'ts')::timestamptz) into v_last from jsonb_array_elements(coalesce(p_msgs, '[]'::jsonb)) x;

  select c.id, c.contact_id into v_conv, v_contact from public.conversations c where c.org_id = v_org and c.chat_id = p_chat_id order by c.created_at desc limit 1;
  d := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  if d is not null then h := encode(extensions.hmac(d, public.pii_key(), 'sha256'), 'hex'); end if;
  if v_contact is null and d is not null then
    select id into v_contact from public.contacts where org_id = v_org and phone_hash = h limit 1;
  end if;
  if v_contact is null then
    insert into public.contacts (org_id, kind, name, source, lifecycle)
    values (v_org, 'pf', left(coalesce(nullif(btrim(p_name), ''), case when d is not null then '+' || d else 'Contato do WhatsApp' end), 200),
      left('WhatsApp · ' || coalesce(p_label, ''), 120), 'lead')
    returning id into v_contact;
  end if;
  if d is not null then
    update public.contacts set phone_enc = public.pii_enc(v_org, '+' || d), phone_hint = right(d, 4), phone_hash = h
    where id = v_contact and phone_hash is distinct from h;
  end if;

  -- ficha: só preenche o que está vazio; o nome dito na conversa vale mais que o nome do perfil do WhatsApp
  update public.contacts set
    name = case when nullif(btrim(f->>'nome'), '') is not null and (name ~ '^\+?\d' or name = 'Contato do WhatsApp' or name = btrim(coalesce(p_name, '')))
                then left(btrim(f->>'nome'), 200) else name end,
    company = coalesce(company, nullif(left(btrim(f->>'empresa'), 200), '')),
    kind = case when nullif(btrim(f->>'empresa'), '') is not null then 'pj'::public.contact_kind else kind end,
    segment = coalesce(segment, nullif(left(btrim(f->>'segmento'), 120), '')),
    city = coalesce(city, nullif(left(btrim(f->>'cidade'), 120), '')),
    credit_wanted = coalesce(credit_wanted, nullif(left(btrim(f->>'credito_pretendido'), 200), '')),
    source = case when source is null or source = 'WhatsApp' then left('WhatsApp · ' || coalesce(p_label, ''), 120) else source end,
    updated_at = now()
  where id = v_contact;

  select public.pii_dec(m.org_id, m.notes_enc) into v_old from public.contact_memory m where m.contact_id = v_contact;
  if nullif(btrim(coalesce(v_old, '')), '') is null and nullif(btrim(coalesce(f->>'resumo', '')), '') is not null then
    insert into public.contact_memory (contact_id, org_id, notes_enc, updated_by, updated_at)
    values (v_contact, v_org, public.pii_enc(v_org, left('Do WhatsApp (' || coalesce(p_label, '') || '): ' || (f->>'resumo'), 4000)), 'ia', now())
    on conflict (contact_id) do update set notes_enc = excluded.notes_enc, updated_by = 'ia', updated_at = now();
  end if;

  if v_conv is null then
    select id into v_conv from public.conversations where org_id = v_org and contact_id = v_contact and status <> 'closed' order by created_at desc limit 1;
    if v_conv is null then
      insert into public.conversations (org_id, contact_id, instance_id, status, chat_id, last_message_at, unread)
      values (v_org, v_contact, v_inst, 'waiting_human', p_chat_id, coalesce(v_last, now()), 0) returning id into v_conv;
    else
      update public.conversations set chat_id = p_chat_id where id = v_conv and chat_id is null;
    end if;
  end if;

  insert into public.messages (org_id, conversation_id, sender, body, meta, created_at)
  select v_org, v_conv, (case when x.from_me then 'user' else 'lead' end)::public.msg_from, coalesce(nullif(x.body, ''), '[mídia]'),
         jsonb_build_object('wa_id', x.wa_id, 'origem', 'importado'), x.ts
    from jsonb_to_recordset(coalesce(p_msgs, '[]'::jsonb)) as x(wa_id text, from_me boolean, body text, ts timestamptz)
   where x.wa_id is not null and not exists (select 1 from public.messages m where m.org_id = v_org and m.meta->>'wa_id' = x.wa_id);

  update public.conversations set
    last_message_at = greatest(coalesce(last_message_at, v_last), coalesce(v_last, last_message_at)),
    reactivation = coalesce(reactivation, '{}'::jsonb) || jsonb_build_object('etiqueta', p_label, 'situacao', coalesce(f->>'situacao', ''))
  where id = v_conv;
  return v_conv;
end $$;

revoke execute on function public.wa_import_chat(text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.wa_import_chat(text, text, text, text, text, jsonb, jsonb) to service_role;

-- a reativação mostra a etiqueta e deixa de fora quem já comprou ou fechou
drop function if exists public.reativacao_lista(uuid, int);
create function public.reativacao_lista(p_org uuid, p_dias int default 2)
returns table (conversation_id uuid, contact_id uuid, nome text, objetivo text, quem text, link boolean,
               parado_desde timestamptz, ultima_lead text, ultima_lead_em timestamptz, reactivation jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member(p_org) then raise exception 'sem acesso a esta organização'; end if;
  return query
  with cv as (
    select c.id, c.contact_id, c.reactivation, c.last_message_at
      from public.conversations c
     where c.org_id = p_org and c.status <> 'closed'
       and c.last_message_at < now() - make_interval(days => p_dias)
       and coalesce(c.reactivation->>'parar', '') = ''
       and coalesce(c.reactivation->>'situacao', '') <> 'comprou'
       and coalesce(c.reactivation->>'etiqueta', '') not in ('Diagnóstico comprado', 'CONSULTORIA FECHADA', 'Clientes meekah')
  ), ult as (
    select distinct on (m.conversation_id) m.conversation_id, m.sender
      from public.messages m join cv on cv.id = m.conversation_id
     where m.sender in ('lead', 'ia', 'user')
     order by m.conversation_id, m.created_at desc
  ), lead as (
    select distinct on (m.conversation_id) m.conversation_id, public.pii_dec(p_org, m.body_enc) as body, m.created_at
      from public.messages m join cv on cv.id = m.conversation_id
     where m.sender = 'lead'
     order by m.conversation_id, m.created_at desc
  ), lnk as (
    select m.conversation_id, true as tem
      from public.messages m join cv on cv.id = m.conversation_id
     where m.sender in ('ia', 'user') and public.pii_dec(p_org, m.body_enc) ilike '%pay.cakto.com.br%'
     group by m.conversation_id
  )
  select cv.id, cv.contact_id, ct.name, ct.credit_wanted,
         case when ult.sender = 'lead' then 'lead' else 'nos' end,
         coalesce(lnk.tem, false), cv.last_message_at,
         left(lead.body, 160), lead.created_at, cv.reactivation
    from cv
    join ult on ult.conversation_id = cv.id
    left join public.contacts ct on ct.id = cv.contact_id
    left join lead on lead.conversation_id = cv.id
    left join lnk on lnk.conversation_id = cv.id
   order by cv.last_message_at desc
   limit 500;
end $$;
grant execute on function public.reativacao_lista(uuid, int) to authenticated;
