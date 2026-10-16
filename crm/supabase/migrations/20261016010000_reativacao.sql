-- Reativação: conversas paradas há 2 dias ou mais, separadas em 3 abas
-- (eu não respondi · pararam de responder · receberam o link e não pagaram)
-- e o andamento da sequência de mensagens de cada uma.

alter table public.conversations add column if not exists reactivation jsonb not null default '{}'::jsonb;

create or replace function public.reativacao_lista(p_org uuid, p_dias int default 2)
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

-- grava o passo da sequência (enviada, data) ou "não contatar"
create or replace function public.reativacao_marcar(p_conversation uuid, p_dados jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.conversations where id = p_conversation;
  if v_org is null or not public.is_member(v_org) then raise exception 'sem acesso a esta conversa'; end if;
  update public.conversations set reactivation = coalesce(reactivation, '{}'::jsonb) || p_dados where id = p_conversation;
end $$;
grant execute on function public.reativacao_marcar(uuid, jsonb) to authenticated;
