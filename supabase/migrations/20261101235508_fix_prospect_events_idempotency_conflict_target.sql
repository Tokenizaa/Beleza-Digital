-- PostgREST and the prospecting worker use ON CONFLICT (idempotency_key).
-- A partial unique index cannot be inferred by that conflict target.
-- A normal UNIQUE index preserves multiple NULL values while enforcing uniqueness
-- for every populated idempotency key.
drop index if exists public.prospect_events_idempotency_uidx;

create unique index prospect_events_idempotency_uidx
  on public.prospect_events (idempotency_key);

comment on index public.prospect_events_idempotency_uidx is
  'Unique non-null idempotency keys; NULL values remain distinct and ON CONFLICT(idempotency_key) is inferable.';
