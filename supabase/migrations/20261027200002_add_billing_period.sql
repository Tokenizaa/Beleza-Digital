-- Add billing_period/recurrence column for commercial plans
begin;

alter table public.prospecting_candidates add column if not exists billing_period text check (billing_period in ('one-time','monthly','quarterly','yearly'));

create index if not exists prospecting_candidates_billing_period_idx
  on public.prospecting_candidates (billing_period);

commit;
