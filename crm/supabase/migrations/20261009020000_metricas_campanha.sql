-- Lothem Núcleo · métricas completas das campanhas (topo, meio e fundo de funil)
-- Guardadas em um campo flexível para não precisar mudar o banco a cada métrica nova.
alter table public.campaigns add column metrics jsonb not null default '{}'::jsonb;
