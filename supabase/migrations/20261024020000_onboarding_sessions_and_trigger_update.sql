-- Migration: onboarding_sessions + trigger provision_salon_owner update
-- Adds onboarding session tracking and updates signup trigger to handle
-- demo context reconciliation and lead→establishment deduplication.

begin;

-- Track onboarding sessions from demo link to active establishment
create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  establishment_id uuid references public.establishments(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  demo_token_hash text not null,
  selected_version_id uuid references public.site_project_versions(id) on delete set null,
  plan_id uuid references public.billing_plans(id) on delete set null,
  status text not null default 'signup'
    check (status in ('signup','plan_selection','payment_pending','paid','active','failed','canceled')),
  payment_id uuid references public.billing_payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists onboarding_sessions_prospect_idx
  on public.onboarding_sessions (prospect_id, created_at desc);

create index if not exists onboarding_sessions_user_idx
  on public.onboarding_sessions (user_id, created_at desc);

create index if not exists onboarding_sessions_demo_token_idx
  on public.onboarding_sessions (demo_token_hash)
  where status in ('signup','plan_selection','payment_pending','paid');

alter table public.onboarding_sessions enable row level security;
revoke all on public.onboarding_sessions from anon, authenticated;
grant select, insert, update on public.onboarding_sessions to authenticated;

drop policy if exists onboarding_sessions_admin_all on public.onboarding_sessions;
create policy onboarding_sessions_admin_all
  on public.onboarding_sessions for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

drop policy if exists onboarding_sessions_user_own on public.onboarding_sessions;
create policy onboarding_sessions_user_own
  on public.onboarding_sessions for select to authenticated
  using (user_id = auth.uid());

comment on table public.onboarding_sessions is 'Tracks the conversion funnel from demo link click to active establishment, preventing duplicate establishments and preserving demo context.';

-- Update provision_salon_owner trigger to:
-- 1. Accept demo_token in raw_user_meta_data
-- 2. Reconcile prospect via demo link
-- 3. Prevent duplicate establishment creation via dedupe_key/phone/email
-- 4. Copy site_project and selected version from prospect
-- 5. Set converted_establishment_id on prospect
-- 6. Create onboarding_session record

create or replace function private.provision_salon_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
  requested_slug text;
  safe_slug text;
  new_establishment_id uuid;
  demo_token text;
  demo_token_hash text;
  demo_link public.site_demo_public_links%rowtype;
  prospect_rec public.prospects%rowtype;
  site_project_rec public.site_projects%rowtype;
  selected_version_rec public.site_project_versions%rowtype;
  existing_establishment_id uuid;
  onboarding_session_id uuid;
begin
  if coalesce(new.raw_user_meta_data ->> 'signup_type', '') <> 'salon_owner' then
    return new;
  end if;

  requested_name := left(trim(coalesce(new.raw_user_meta_data ->> 'establishment_name', '')), 120);
  if requested_name = '' then
    raise exception 'Nome do salão é obrigatório';
  end if;

  requested_slug := lower(coalesce(new.raw_user_meta_data ->> 'establishment_slug', ''));
  safe_slug := trim(both '-' from regexp_replace(requested_slug, '[^a-z0-9-]+', '-', 'g'));
  safe_slug := trim(both '-' from regexp_replace(safe_slug, '-+', '-', 'g'));
  if safe_slug = '' then
    safe_slug := trim(both '-' from regexp_replace(lower(requested_name), '[^a-z0-9]+', '-', 'g'));
  end if;
  safe_slug := left(safe_slug, 45);
  if safe_slug = '' then
    safe_slug := 'salao';
  end if;

  if exists (select 1 from public.establishments e where e.slug = safe_slug) then
    safe_slug := left(safe_slug, 34) || '-' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  -- Extract demo context from signup metadata
  demo_token := new.raw_user_meta_data ->> 'demo_token';
  demo_token_hash := null;

  if demo_token is not null then
    demo_token_hash := encode(digest(demo_token, 'sha256'), 'hex');

    -- Find the demo link and associated prospect
    select * into demo_link
    from public.site_demo_public_links
    where token_hash = demo_token_hash
      and status in ('active','selected')
      and expires_at > now()
    for update;

    if not found then
      raise exception 'Demo link inválido ou expirado';
    end if;

    -- Get the prospect from the site project
    select p.*, sp.id as site_project_id, sp.prospect_id
    into prospect_rec
    from public.prospects p
    join public.site_projects sp on sp.prospect_id = p.id
    where sp.id = demo_link.site_project_id;

    if not found then
      raise exception 'Prospect não encontrado para este link de demonstração';
    end if;

    -- Anti-duplication: check if prospect already converted to an establishment
    if prospect_rec.converted_establishment_id is not null then
      existing_establishment_id := prospect_rec.converted_establishment_id;
    else
      -- Check for existing establishment with same dedupe_key, normalized_phone, normalized_website, or email
      select e.id into existing_establishment_id
      from public.establishments e
      join public.prospects p on p.converted_establishment_id = e.id
      where p.dedupe_key = prospect_rec.dedupe_key
         or (p.normalized_phone is not null and p.normalized_phone = prospect_rec.normalized_phone)
         or (p.normalized_website is not null and p.normalized_website = prospect_rec.normalized_website)
         or (p.email is not null and p.email = prospect_rec.email)
      limit 1;
    end if;

    if existing_establishment_id is not null then
      -- Reuse existing establishment
      new_establishment_id := existing_establishment_id;

      -- Update prospect if not already linked
      if prospect_rec.converted_establishment_id is null then
        update public.prospects
        set converted_establishment_id = new_establishment_id,
            updated_at = now()
        where id = prospect_rec.id;
      end if;
    else
      -- Create new establishment with demo context
      insert into public.establishments (slug, name, status, billing_status, contact)
      values (
        safe_slug,
        requested_name,
        'draft',
        'pending',
        jsonb_build_object(
          'owner_name', left(trim(coalesce(new.raw_user_meta_data ->> 'owner_name', '')), 120),
          'owner_email', lower(new.email),
          'demo_source', true,
          'prospect_id', prospect_rec.id
        )
      )
      returning id into new_establishment_id;

      -- Link prospect to establishment
      update public.prospects
      set converted_establishment_id = new_establishment_id,
          updated_at = now()
      where id = prospect_rec.id;

      -- Copy site_project from prospect to establishment (preserving selected version)
      select * into site_project_rec
      from public.site_projects
      where prospect_id = prospect_rec.id
      limit 1;

      if found then
        -- Copy the site project to the new establishment
        insert into public.site_projects (
          establishment_id, prospect_id, template_version_id,
          generated_content, design_overrides, status
        )
        select
          new_establishment_id,
          prospect_rec.id,
          sp.template_version_id,
          sp.generated_content,
          sp.design_overrides,
          'draft'
        from public.site_projects sp
        where sp.id = site_project_rec.id
        returning id into site_project_rec.id;

        -- Copy site_project_versions preserving selection_source = 'public_landing'
        insert into public.site_project_versions (
          site_project_id, version, template_version_id,
          generated_content, design_overrides,
          selected_by_prospect, selection_source
        )
        select
          site_project_rec.id,
          spv.version,
          spv.template_version_id,
          spv.generated_content,
          spv.design_overrides,
          spv.selected_by_prospect,
          'public_landing'
        from public.site_project_versions spv
        where spv.site_project_id = sp.id;

        -- If a version was selected by the prospect, ensure it's marked as selected
        if demo_link.selected_version_id is not null then
          update public.site_project_versions
          set selected_by_prospect = true, selection_source = 'public_landing'
          where site_project_id = site_project_rec.id
            and template_version_id = (
              select template_version_id from public.site_project_versions
              where id = demo_link.selected_version_id
            );
        end if;
      end if;
    end if;
  else
    -- No demo context: create establishment normally
    insert into public.establishments (slug, name, status, billing_status, contact)
    values (
      safe_slug,
      requested_name,
      'draft',
      'pending',
      jsonb_build_object('owner_name', left(trim(coalesce(new.raw_user_meta_data ->> 'owner_name', '')), 120),
                         'owner_email', lower(new.email))
    )
    returning id into new_establishment_id;
  end if;

  -- Create membership
  insert into public.establishment_memberships (establishment_id, user_id, role, created_by)
  values (new_establishment_id, new.id, 'owner', new.id);

  -- Create onboarding session record
  insert into public.onboarding_sessions (
    prospect_id, establishment_id, user_id,
    demo_token_hash, selected_version_id, status
  )
  values (
    prospect_rec.id,
    new_establishment_id,
    new.id,
    demo_token_hash,
    (demo_link.selected_version_id)::uuid,
    'signup'
  )
  returning id into onboarding_session_id;

  -- Audit event
  insert into public.audit_events (actor_user_id, establishment_id, action, details)
  values (new.id, new_establishment_id, 'salon_signup_created',
          jsonb_build_object('source', 'supabase_auth_trigger',
                             'demo_context', demo_token is not null,
                             'onboarding_session_id', onboarding_session_id));

  -- Prospect conversion event (if demo context)
  if prospect_rec.id is not null and existing_establishment_id is null then
    insert into public.prospect_events (
      prospect_id, campaign_id, site_project_id, event_type,
      source_provider, idempotency_key, evidence
    )
    values (
      prospect_rec.id,
      (select campaign_id from public.site_projects where prospect_id = prospect_rec.id limit 1),
      (select id from public.site_projects where prospect_id = prospect_rec.id limit 1),
      'converted',
      'onboarding',
      'prospect:' || prospect_rec.id || ':converted:' || new_establishment_id::text,
      jsonb_build_object('establishmentId', new_establishment_id, 'userId', new.id)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.provision_salon_owner() from public, anon, authenticated;
drop trigger if exists provision_salon_owner_after_signup on auth.users;
create trigger provision_salon_owner_after_signup
  after insert on auth.users
  for each row execute function private.provision_salon_owner();

comment on function private.provision_salon_owner() is 'Creates establishment and membership on salon owner signup. Handles demo context reconciliation and prevents duplicate establishments via dedupe_key/phone/email.';

commit;