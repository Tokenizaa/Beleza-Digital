-- Establishment-owned catalog and media persistence.
-- Profile fields continue to use establishments.contact and establishments.brand_settings.
begin;

create table if not exists public.establishment_services (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(12,2),
  price_range text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  category text not null default 'Geral',
  image_url text,
  featured boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists establishment_services_tenant_order_idx
  on public.establishment_services(establishment_id, sort_order, created_at);

create table if not exists public.establishment_products (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  main_image text not null default '',
  additional_images jsonb not null default '[]'::jsonb,
  available boolean not null default true,
  category text not null default 'Geral',
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint establishment_products_additional_images_array
    check (jsonb_typeof(additional_images) = 'array')
);

create index if not exists establishment_products_tenant_order_idx
  on public.establishment_products(establishment_id, sort_order, created_at);

create table if not exists public.establishment_media (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  type text not null check (type in ('image','video')),
  title text not null default '',
  url text not null,
  thumbnail_url text,
  is_reel_vertical boolean not null default false,
  category text not null default 'Outros',
  date_added timestamptz not null default now(),
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists establishment_media_tenant_order_idx
  on public.establishment_media(establishment_id, sort_order, date_added desc);

alter table public.establishment_services enable row level security;
alter table public.establishment_products enable row level security;
alter table public.establishment_media enable row level security;

revoke all on public.establishment_services, public.establishment_products, public.establishment_media from anon;
grant select, insert, update, delete on public.establishment_services, public.establishment_products, public.establishment_media to authenticated;

drop policy if exists establishment_services_read_member on public.establishment_services;
create policy establishment_services_read_member
  on public.establishment_services for select to authenticated
  using ((select private.has_establishment_role(establishment_id, null)));

drop policy if exists establishment_services_write_manager on public.establishment_services;
create policy establishment_services_write_manager
  on public.establishment_services for all to authenticated
  using ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])))
  with check ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])));

drop policy if exists establishment_products_read_member on public.establishment_products;
create policy establishment_products_read_member
  on public.establishment_products for select to authenticated
  using ((select private.has_establishment_role(establishment_id, null)));

drop policy if exists establishment_products_write_manager on public.establishment_products;
create policy establishment_products_write_manager
  on public.establishment_products for all to authenticated
  using ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])))
  with check ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])));

drop policy if exists establishment_media_read_member on public.establishment_media;
create policy establishment_media_read_member
  on public.establishment_media for select to authenticated
  using ((select private.has_establishment_role(establishment_id, null)));

drop policy if exists establishment_media_write_manager on public.establishment_media;
create policy establishment_media_write_manager
  on public.establishment_media for all to authenticated
  using ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])))
  with check ((select private.has_establishment_role(establishment_id, array['owner','admin','editor']::text[])));

comment on table public.establishment_services is 'Tenant-scoped services managed by establishment members.';
comment on table public.establishment_products is 'Tenant-scoped product catalog managed by establishment members.';
comment on table public.establishment_media is 'Tenant-scoped image and video library managed by establishment members.';

commit;
