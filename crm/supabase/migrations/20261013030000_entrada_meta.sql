-- Entrada do lead do Meta: quem já comprou o diagnóstico e quem fez o quiz e não comprou.
-- A Cibelle usa uma trilha de atendimento diferente para cada um.
alter table public.contacts add column if not exists entry_path text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_entry_path_check') then
    alter table public.contacts add constraint contacts_entry_path_check check (entry_path in ('comprou', 'quiz'));
  end if;
end $$;

comment on column public.contacts.entry_path is 'Entrada do Meta: comprou (já pagou o diagnóstico) ou quiz (fez o quiz e não comprou). Nulo quando não se aplica.';

create index if not exists contacts_entry_path_idx on public.contacts (org_id, entry_path) where entry_path is not null;
