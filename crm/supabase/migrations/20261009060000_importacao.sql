-- Lothem Vendas · importação de outro CRM ou planilha
-- Recebe até 500 linhas por vez, cifra telefone, e-mail e documento, ignora quem já existe
-- (mesmo telefone ou e-mail) e cria o negócio na etapa escolhida.

create or replace function public.import_rows(p_org uuid, p_pipeline uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; v_c uuid; v_stage uuid; d text; e text; doc text; ph_hash text; em_hash text;
  n_new int := 0; n_skip int := 0; n_deal int := 0;
begin
  if auth.uid() is null or not public.is_member(p_org) then raise exception 'sem acesso a esta organização'; end if;
  if not public.org_active(p_org) then raise exception 'Sua assinatura não está ativa. Escolha um plano para importar.'; end if;
  if p_pipeline is not null and not exists (select 1 from public.pipelines where id = p_pipeline and org_id = p_org) then raise exception 'funil inválido'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'envie no máximo 500 linhas por vez'; end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    if coalesce(btrim(r->>'name'), '') = '' then n_skip := n_skip + 1; continue; end if;
    d := nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), '');
    e := nullif(lower(btrim(coalesce(r->>'email', ''))), '');
    doc := nullif(btrim(coalesce(r->>'document', '')), '');
    ph_hash := case when d is null then null else encode(extensions.hmac(d, public.pii_key(), 'sha256'), 'hex') end;
    em_hash := public.pii_hash(e);
    if (ph_hash is not null and exists (select 1 from public.contacts c where c.org_id = p_org and c.phone_hash = ph_hash))
       or (em_hash is not null and exists (select 1 from public.contacts c where c.org_id = p_org and c.email_hash = em_hash)) then
      n_skip := n_skip + 1; continue;
    end if;

    insert into public.contacts (org_id, kind, name, company, email, city, segment, source, owner_id, lifecycle)
    values (p_org,
      (case when length(regexp_replace(coalesce(doc, ''), '\D', '', 'g')) = 14 or coalesce(btrim(r->>'company'), '') <> '' then 'pj' else 'pf' end)::public.contact_kind,
      left(btrim(r->>'name'), 200), nullif(left(btrim(coalesce(r->>'company', '')), 200), ''), e,
      nullif(left(btrim(coalesce(r->>'city', '')), 120), ''), nullif(left(btrim(coalesce(r->>'segment', '')), 120), ''),
      coalesce(nullif(left(btrim(coalesce(r->>'source', '')), 120), ''), 'Importado'), auth.uid(), 'lead')
    returning id into v_c;
    if d is not null then
      update public.contacts set phone_enc = public.pii_enc(p_org, btrim(r->>'phone')), phone_hint = right(d, 4), phone_hash = ph_hash where id = v_c;
    end if;
    if doc is not null then
      update public.contacts set document_enc = public.pii_enc(p_org, doc), document_hint = right(regexp_replace(doc, '\D', '', 'g'), 3) where id = v_c;
    end if;
    n_new := n_new + 1;

    v_stage := null;
    if p_pipeline is not null and coalesce(r->>'stage_id', '') <> '' then
      select s.id into v_stage from public.stages s where s.id::text = r->>'stage_id' and s.pipeline_id = p_pipeline;
    end if;
    if v_stage is not null then
      insert into public.deals (org_id, contact_id, pipeline_id, stage_id, title, value, owner_id, product, next_step, qualification)
      values (p_org, v_c, p_pipeline, v_stage, coalesce(nullif(btrim(coalesce(r->>'company', '')), ''), btrim(r->>'name')),
        coalesce(nullif(r->>'value', '')::numeric, 0), auth.uid(), nullif(left(btrim(coalesce(r->>'product', '')), 120), ''), 'Importado de outro CRM',
        case when coalesce(btrim(r->>'notes'), '') <> '' then jsonb_build_object('obs', left(r->>'notes', 4000)) else '{}'::jsonb end);
      n_deal := n_deal + 1;
    end if;
  end loop;

  insert into public.activity_log (org_id, actor_id, entity, action, data)
  values (p_org, auth.uid(), 'import', 'importacao', jsonb_build_object('novos', n_new, 'ignorados', n_skip, 'negocios', n_deal));
  return jsonb_build_object('created', n_new, 'skipped', n_skip, 'deals', n_deal);
end $$;

revoke execute on function public.import_rows(uuid, uuid, jsonb) from public, anon;
grant execute on function public.import_rows(uuid, uuid, jsonb) to authenticated;
