-- Lothem Vendas · administração separada dos clientes
-- Só rebeca.macedo.whp@gmail.com entra no Painel Mestre. As contas da Lothem (Crédito PJ, PF e Marketing)
-- continuam como clientes, no login delas, sem Painel Mestre.
-- A conta rebeca.macedo.whp@gmail.com precisa existir antes (Criar conta no CRM, confirmar o e-mail).

do $$
declare v uuid;
begin
  select id into v from auth.users where lower(email) = 'rebeca.macedo.whp@gmail.com';
  if v is null then
    raise exception 'A conta rebeca.macedo.whp@gmail.com ainda não existe. Crie em crm.lothem.com.br (Criar conta), confirme o e-mail e rode de novo.';
  end if;
  delete from public.platform_admins where user_id <> v;
  insert into public.platform_admins (user_id) values (v) on conflict do nothing;
end $$;

-- confere: deve aparecer só um e-mail
select u.email as administracao from public.platform_admins a join auth.users u on u.id = a.user_id;
