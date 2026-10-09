-- Lothem Vendas · nenhuma função do schema public pode ser chamada por visitante sem login.
-- Funções novas ganham permissão para PUBLIC por padrão no Postgres; aqui ela é retirada de todas
-- e devolvida só para quem está logado, função por função.

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- usadas pelas regras de acesso (RLS)
grant execute on function public.is_member(uuid), public.is_admin(uuid), public.jwt_org_ids(), public.org_active(uuid) to authenticated;
-- usadas pelo CRM
grant execute on function
  public.create_organization(text, text),
  public.set_contact_sensitive(uuid, text, text, text), public.get_contact_sensitive(uuid), public.find_contact_by_phone(uuid, text),
  public.get_deal_qualification(uuid), public.get_conversation_messages(uuid), public.get_profile_phone(uuid),
  public.set_org_billing_data(uuid, text, text, text, text), public.get_org_billing_data(uuid), public.set_instance_token(uuid, text),
  public.request_plan(text, text, text), public.org_billing(uuid), public.import_rows(uuid, uuid, jsonb),
  public.is_platform_admin(), public.admin_tenants(), public.admin_save_settings(jsonb, jsonb, jsonb, int),
  public.admin_set_subscription(uuid, text, text, text, timestamptz, timestamptz, boolean)
to authenticated;
-- login: o Supabase Auth monta o token com as organizações
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
-- servidor do WhatsApp (chave de serviço, nunca no navegador)
grant execute on function public.pii_enc(uuid, text), public.pii_dec(uuid, bytea), public.pii_hash(text) to service_role;
