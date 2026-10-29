-- Corrigir índice único em prospects.dedupe_key (necessário para ON CONFLICT na RPC promote_prospecting_candidate)
create unique index if not exists prospects_dedupe_key_uidx
  on public.prospects (dedupe_key)
  where dedupe_key is not null;

-- Recriar RPC promote_prospecting_candidate sem ON CONFLICT condicional (funciona com ou sem índice único)
create or replace function public.promote_prospecting_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.prospecting_candidates%rowtype;
  v_data jsonb;
  v_columns text;
  v_prospect_id uuid;
begin
  select * into v_candidate
  from public.prospecting_candidates
  where id = p_candidate_id
  for update;

  if not found then raise exception 'prospecting_candidate_not_found'; end if;

  if v_candidate.prospect_id is not null then
    return jsonb_build_object('prospectId', v_candidate.prospect_id, 'created', false, 'alreadyPromoted', true);
  end if;

  if v_candidate.status in ('blocked','disqualified') then
    raise exception 'prospecting_candidate_not_promotable';
  end if;

  v_data := jsonb_build_object(
    'dedupe_key', v_candidate.dedupe_key,
    'business_name', v_candidate.business_name,
    'name', v_candidate.business_name,
    'company_name', v_candidate.business_name,
    'category', v_candidate.category,
    'business_category', v_candidate.category,
    'website_url', v_candidate.website_url,
    'website', v_candidate.website_url,
    'normalized_website', v_candidate.normalized_website,
    'phone', v_candidate.phone,
    'phone_number', v_candidate.phone,
    'normalized_phone', v_candidate.normalized_phone,
    'email', v_candidate.email,
    'address', v_candidate.address,
    'city', v_candidate.city,
    'region', v_candidate.region,
    'state', v_candidate.region,
    'country_code', v_candidate.country_code,
    'description', v_candidate.description,
    'source_url', v_candidate.source_url,
    'qualification_score', v_candidate.qualification_score,
    'qualification_reasons', v_candidate.qualification_reasons,
    'source_captured_at', v_candidate.source_captured_at,
    'last_seen_at', now(),
    'outreach_eligibility', 'unknown',
    'captured_data', jsonb_build_object(
      'address', v_candidate.address,
      'description', v_candidate.description,
      'source_url', v_candidate.source_url,
      'provider', v_candidate.provider,
      'provider_record_id', v_candidate.provider_record_id,
      'raw_evidence', v_candidate.raw_evidence
    ),
    'qualification', jsonb_build_object(
      'score', v_candidate.qualification_score,
      'reasons', v_candidate.qualification_reasons,
      'missing_fields', v_candidate.missing_fields
    ),
    'public_source_urls', case when v_candidate.source_url is null then array[]::text[] else array[v_candidate.source_url] end,
    'source_name', v_candidate.provider
  );

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position)
  into v_columns
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'prospects'
    and c.column_name = any(array[
      'dedupe_key','business_name','name','company_name','category','business_category',
      'website_url','website','normalized_website','phone','phone_number','normalized_phone',
      'email','address','city','region','state','country_code','description','source_url',
      'qualification_score','qualification_reasons','source_captured_at','last_seen_at',
      'outreach_eligibility','captured_data','qualification','public_source_urls','source_name'
    ]);

  if v_columns is null then raise exception 'prospects_schema_not_compatible'; end if;

  -- INSERT simples (sem ON CONFLICT) — funciona mesmo sem índice único em dedupe_key
  execute format(
    'insert into public.prospects (%1$s) select %1$s from jsonb_populate_record(null::public.prospects, $1) returning id',
    v_columns
  ) into v_prospect_id using v_data;

  if v_prospect_id is null then
    -- fallback: buscar por dedupe_key caso o insert não tenha retornado id
    select p.id into v_prospect_id
    from public.prospects p
    where p.dedupe_key = v_candidate.dedupe_key
    limit 1;
  end if;

  if v_prospect_id is null then raise exception 'prospect_promotion_failed'; end if;

  update public.prospecting_candidates
  set prospect_id = v_prospect_id, status = 'promoted', updated_at = now()
  where id = v_candidate.id;

  insert into public.prospect_events (
    prospect_id, campaign_id, event_type, source_provider, idempotency_key, evidence
  ) values (
    v_prospect_id, v_candidate.campaign_id, 'captured', v_candidate.provider,
    'candidate:' || v_candidate.id::text || ':captured',
    jsonb_build_object('candidateId', v_candidate.id, 'dedupeKey', v_candidate.dedupe_key, 'sourceUrl', v_candidate.source_url)
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object('prospectId', v_prospect_id, 'created', true, 'alreadyPromoted', false);
end;
$$;

revoke all on function public.promote_prospecting_candidate(uuid) from public, anon, authenticated;
grant execute on function public.promote_prospecting_candidate(uuid) to service_role;
