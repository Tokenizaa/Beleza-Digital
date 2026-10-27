-- Add hospedagem_preferida column for Plano B
begin;

alter table public.prospecting_candidates add column if not exists hospedagem_preferida text;

create index if not exists prospecting_candidates_hospedagem_idx
  on public.prospecting_candidates (hospedagem_preferida);

commit;
