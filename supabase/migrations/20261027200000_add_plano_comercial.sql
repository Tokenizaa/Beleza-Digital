-- Add columns for commercial plan selection
begin;

-- Add plano_comercial: A, B, or C (null if not chosen yet)
alter table public.prospecting_candidates add column if not exists plano_comercial text check (plano_comercial in ('A','B','C'));

-- Add data_escolha_plano: date of when the plan was chosen
alter table public.prospecting_candidates add column if not exists data_escolha_plano timestamptz;

-- Add escolhido_por: who made the choice (always 'cliente' in this flow)
alter table public.prospecting_candidates add column if not exists escolhido_por text default 'cliente';

create index if not exists prospecting_candidates_plano_idx
  on public.prospecting_candidates (plano_comercial);

commit;
