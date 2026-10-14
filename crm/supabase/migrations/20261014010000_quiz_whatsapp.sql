-- Lothem Vendas · lead que chega do quiz pelo WhatsApp
-- A mensagem do funil traz nome, empresa, CNPJ, faturamento, prontidão e objetivo. O servidor lê o texto,
-- guarda tudo na ficha (CNPJ cifrado) e marca a entrada como "fez o quiz e não comprou", para a IA não perguntar de novo.

create or replace function public.ai_bot_quiz(p_conv uuid, p_nome text, p_empresa text, p_cnpj text, p_credito text, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare cv record; d text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'); v_old text;
begin
  select * into cv from public.conversations where id = p_conv;
  if cv.id is null then return; end if;
  update public.contacts set
    name = coalesce(nullif(left(btrim(p_nome), 200), ''), name),
    company = coalesce(nullif(left(btrim(p_empresa), 200), ''), company),
    kind = case when nullif(btrim(p_empresa), '') is not null or length(d) = 14 then 'pj'::public.contact_kind else kind end,
    credit_wanted = coalesce(nullif(left(btrim(p_credito), 200), ''), credit_wanted),
    entry_path = coalesce(entry_path, 'quiz'),
    source = case when source is null or source = 'WhatsApp' then 'Quiz do site' else source end,
    updated_at = now()
  where id = cv.contact_id;
  if length(d) = 14 then
    update public.contacts set document_enc = public.pii_enc(cv.org_id, p_cnpj), document_hint = right(d, 3) where id = cv.contact_id and document_enc is null;
  end if;
  -- anotações do quiz entram na memória só se ela ainda estiver vazia (não apaga o que a IA ou a equipe já escreveram)
  select public.pii_dec(m.org_id, m.notes_enc) into v_old from public.contact_memory m where m.contact_id = cv.contact_id;
  if nullif(btrim(coalesce(v_old, '')), '') is null and nullif(btrim(coalesce(p_notes, '')), '') is not null then
    insert into public.contact_memory (contact_id, org_id, notes_enc, updated_by, updated_at)
    values (cv.contact_id, cv.org_id, public.pii_enc(cv.org_id, left(p_notes, 4000)), 'ia', now())
    on conflict (contact_id) do update set notes_enc = excluded.notes_enc, updated_by = 'ia', updated_at = now();
  end if;
end $$;

revoke execute on function public.ai_bot_quiz(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ai_bot_quiz(uuid, text, text, text, text, text) to service_role;
