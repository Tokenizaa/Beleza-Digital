-- Establishment clients table and authenticated member policies for appointments.
-- Enables operational daily management: clients CRM, visit history and appointment status updates.
begin;

create table if not exists public.establishment_clients (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone text not null check (char_length(trim(phone)) between 8 and 32),
  normalized_phone text not null check (char_length(trim(normalized_phone)) between 8 and 32),
  phone_hash text not null check (char_length(phone_hash) = 64),
  email text check (email is null or char_length(trim(email)) between 3 and 160),
  notes text,
  total_visits integer not null default 0 check (total_visits >= 0),
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint establishment_clients_unique_phone_per_tenant
    unique (establishment_id, phone_hash)
);

create index if not exists establishment_clients_tenant_phone_idx
  on public.establishment_clients(establishment_id, phone_hash);

create index if not exists establishment_clients_tenant_name_idx
  on public.establishment_clients(establishment_id, name);

alter table public.establishment_clients enable row level security;

revoke all on public.establishment_clients from anon;
grant select, insert, update, delete on public.establishment_clients to authenticated;

drop policy if exists establishment_clients_read_member on public.establishment_clients;
create policy establishment_clients_read_member
  on public.establishment_clients for select to authenticated
  using ((select private.has_establishment_role(establishment_id, null)));

drop policy if exists establishment_clients_write_manager on public.establishment_clients;
create policy establishment_clients_write_manager
  on public.establishment_clients for all to authenticated
  using ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])))
  with check ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])));

-- Permitir que membros autenticados do salão visualizem e gerenciem agendamentos do seu estabelecimento
grant select, insert, update, delete on public.establishment_appointments to authenticated;

drop policy if exists establishment_appointments_deny_client_access on public.establishment_appointments;

drop policy if exists establishment_appointments_read_member on public.establishment_appointments;
create policy establishment_appointments_read_member
  on public.establishment_appointments for select to authenticated
  using ((select private.has_establishment_role(establishment_id, null)));

drop policy if exists establishment_appointments_write_manager on public.establishment_appointments;
create policy establishment_appointments_write_manager
  on public.establishment_appointments for all to authenticated
  using ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])))
  with check ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])));

comment on table public.establishment_clients is 'Tenant-scoped client directory with cryptographic phone deduplication and visit history.';

commit;
