-- Lothem Vendas · reativação mais certeira
-- A lista passa a trazer a primeira mensagem do lead (o que ele pediu: ebook, diagnóstico, falar com a ex-analista)
-- e dois sinais de quem estava perto de fechar: mandou o CNPJ ou estava marcando horário com a Rebeca.

drop function if exists public.reativacao_lista(uuid, int);
create function public.reativacao_lista(p_org uuid, p_dias int default 2)
returns table (conversation_id uuid, contact_id uuid, nome text, objetivo text, quem text, link boolean,
               parado_desde timestamptz, ultima_lead text, ultima_lead_em timestamptz, reactivation jsonb,
               primeira_lead text, cnpj boolean, agenda boolean)
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
  ), prim as (
    select distinct on (m.conversation_id) m.conversation_id, public.pii_dec(p_org, m.body_enc) as body
      from public.messages m join cv on cv.id = m.conversation_id
     where m.sender = 'lead'
     order by m.conversation_id, m.created_at
  ), sinais as (
    select m.conversation_id,
           bool_or(m.sender = 'lead' and public.pii_dec(p_org, m.body_enc) ~ '\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}') as cnpj,
           bool_or(m.sender in ('ia', 'user') and public.pii_dec(p_org, m.body_enc) ~* '(hor[aá]rio|agendar|agenda |link da reuni)') as agenda
      from public.messages m join cv on cv.id = m.conversation_id
     group by m.conversation_id
  ), lnk as (
    select m.conversation_id, true as tem
      from public.messages m join cv on cv.id = m.conversation_id
     where m.sender in ('ia', 'user') and public.pii_dec(p_org, m.body_enc) ilike '%pay.cakto.com.br%'
     group by m.conversation_id
  )
  select cv.id, cv.contact_id, ct.name, ct.credit_wanted,
         case when ult.sender = 'lead' then 'lead' else 'nos' end,
         coalesce(lnk.tem, false), cv.last_message_at,
         left(lead.body, 160), lead.created_at, cv.reactivation,
         left(prim.body, 160), coalesce(sinais.cnpj, false), coalesce(sinais.agenda, false)
    from cv
    join ult on ult.conversation_id = cv.id
    left join public.contacts ct on ct.id = cv.contact_id
    left join lead on lead.conversation_id = cv.id
    left join lnk on lnk.conversation_id = cv.id
    left join prim on prim.conversation_id = cv.id
    left join sinais on sinais.conversation_id = cv.id
   order by cv.last_message_at desc
   limit 500;
end $$;
grant execute on function public.reativacao_lista(uuid, int) to authenticated;
