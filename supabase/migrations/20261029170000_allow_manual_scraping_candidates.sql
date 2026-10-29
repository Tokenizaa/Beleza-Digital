-- Manual discovery tasks intentionally have no commercial campaign.
-- Allow their discovered candidates to persist without inventing a campaign record.
begin;

alter table public.prospecting_candidates
  alter column campaign_id drop not null;

comment on column public.prospecting_candidates.campaign_id is
  'Optional campaign reference. Null for one-off/manual scraping runs; manual results remain globally deduplicated by dedupe_key.';

commit;
