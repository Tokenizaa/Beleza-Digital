-- Add payment_mode column for A/B plan charging options
begin;

-- payment_mode: 'code-download' | 'specialist-assistance' | 'one-time'
alter table public.prospecting_candidates add column if not exists payment_mode text check (payment_mode in ('code-download','specialist-assistance','one-time'));

create index if not exists prospecting_candidates_payment_mode_idx
  on public.prospecting_candidates (payment_mode);

commit;
