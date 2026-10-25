-- Manual discovery is independent of commercial campaigns.
-- A null campaign_id identifies a candidate collected by an explicit one-off search.
begin;

alter table public.prospecting_candidates
  alter column campaign_id drop not null;

comment on column public.prospecting_candidates.campaign_id is
  'Optional commercial campaign association. Manual discovery candidates are not required to belong to a campaign.';

commit;
