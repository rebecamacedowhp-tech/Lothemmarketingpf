-- Lothem Vendas · recomeçar as conversas de teste da IA
-- Só para contatos cujo telefone está na lista de teste. Nada é apagado: a conversa antiga é encerrada e
-- desligada do chat (a próxima mensagem abre uma conversa nova), e a memória da IA é guardada como nota
-- dentro da conversa antiga antes de ser zerada.

create or replace function public.ai_test_reset_all(p_org uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare cfg record; r record; v_n int := 0; v_mem text;
begin
  if not public.is_admin(p_org) then raise exception 'só a proprietária ou a gestão'; end if;
  select * into cfg from public.ai_configs where org_id = p_org;
  if cfg.org_id is null or coalesce(array_length(cfg.test_numbers, 1), 0) = 0 then raise exception 'não há números de teste cadastrados'; end if;
  for r in
    select c.id conv, c.contact_id, regexp_replace(coalesce(public.pii_dec(p_org, ct.phone_enc), ''), '\D', '', 'g') phone
    from public.conversations c join public.contacts ct on ct.id = c.contact_id
    where c.org_id = p_org and c.status <> 'closed'
  loop
    if length(r.phone) >= 8 and exists (select 1 from unnest(cfg.test_numbers) n where right(n, 8) = right(r.phone, 8)) then
      select public.pii_dec(m.org_id, m.notes_enc) into v_mem from public.contact_memory m where m.contact_id = r.contact_id;
      if nullif(btrim(coalesce(v_mem, '')), '') is not null then
        insert into public.messages (org_id, conversation_id, sender, author_id, body, meta)
        values (p_org, r.conv, 'note', auth.uid(), 'Memória da IA guardada ao recomeçar o teste:' || chr(10) || v_mem, jsonb_build_object('origem', 'recomeco'));
      end if;
      update public.contact_memory set notes_enc = null, updated_by = 'equipe', updated_at = now() where contact_id = r.contact_id;
      insert into public.messages (org_id, conversation_id, sender, author_id, body, meta)
      values (p_org, r.conv, 'system', auth.uid(), 'Teste recomeçado. A próxima mensagem abre uma conversa nova.', jsonb_build_object('origem', 'recomeco'));
      update public.conversations set status = 'closed', chat_id = null, unread = 0 where id = r.conv;
      v_n := v_n + 1;
    end if;
  end loop;
  perform public.ai_audit_log(p_org, 'teste_recomecado', jsonb_build_object('conversas', v_n));
  return v_n;
end $$;

revoke execute on function public.ai_test_reset_all(uuid) from public, anon, authenticated;
grant execute on function public.ai_test_reset_all(uuid) to authenticated;
