-- Elite Travel Hub — initial schema
-- Works on Supabase (Postgres 15+) and on any plain PostgreSQL 15+.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administrators (no public registration — created with `npm run admin:create`)
-- ---------------------------------------------------------------------------
create table public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text not null default '',
  password_hash text not null,
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint admin_users_email_lower check (email = lower(email))
);
create unique index admin_users_email_key on public.admin_users (email);
create trigger admin_users_touch before update on public.admin_users
  for each row execute function public.touch_updated_at();

create table public.admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.admin_users (id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  ip           text,
  user_agent   text
);
create index admin_sessions_admin_idx on public.admin_sessions (admin_id);
create index admin_sessions_expires_idx on public.admin_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           text not null check (char_length(name) between 2 and 120),
  category       text not null check (category in ('bus', 'car')),
  make_model     text,
  registration   text,
  seats          integer check (seats between 1 and 80),
  tagline        text,
  description    text,
  amenities      text[] not null default '{}',
  specs          jsonb not null default '[]'::jsonb check (jsonb_typeof(specs) = 'array'),
  -- Pricing: every field optional. Nothing is shown publicly unless configured.
  day_rate       numeric(10, 2) check (day_rate >= 0),
  rate_per_km    numeric(10, 2) check (rate_per_km >= 0),
  min_km_per_day integer check (min_km_per_day >= 0),
  price_note     text,
  is_active      boolean not null default true,
  is_featured    boolean not null default false,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index vehicles_listing_idx on public.vehicles (is_active, category, sort_order);
create trigger vehicles_touch before update on public.vehicles
  for each row execute function public.touch_updated_at();

-- Images are stored as responsive WebP variants: `${src_base}-${width}.webp`
create table public.vehicle_images (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  src_base   text not null,
  widths     integer[] not null check (cardinality(widths) > 0),
  width      integer not null check (width > 0),
  height     integer not null check (height > 0),
  alt        text not null default '',
  storage    text not null default 'static' check (storage in ('static', 'local', 'supabase')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index vehicle_images_vehicle_idx on public.vehicle_images (vehicle_id, sort_order);

-- Dates a vehicle cannot be booked (servicing, private use, …)
create table public.vehicle_blocks (
  id         uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  reason     text,
  created_at timestamptz not null default now(),
  constraint vehicle_blocks_range check (end_date >= start_date)
);
create index vehicle_blocks_vehicle_idx on public.vehicle_blocks (vehicle_id, start_date);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique check (reference ~ '^ETH-[0-9]{4}-[A-Z0-9]{5}$'),
  customer_name    text not null check (char_length(customer_name) between 2 and 120),
  customer_phone   text not null check (customer_phone ~ '^\+[0-9]{8,15}$'),
  customer_email   text,
  vehicle_category text not null check (vehicle_category in ('bus', 'car')),
  vehicle_id       uuid references public.vehicles (id) on delete restrict,
  pickup_location  text not null,
  destination      text not null,
  trip_type        text not null check (trip_type in ('one_way', 'round_trip', 'multi_day', 'local')),
  trip_date        date not null,
  return_date      date,
  pickup_time      time not null,
  passengers       integer not null check (passengers between 1 and 80),
  requirements     text,
  estimated_price  numeric(12, 2),   -- computed by the server from the vehicle's day rate, if configured
  quoted_fare      numeric(12, 2) check (quoted_fare >= 0), -- fare agreed by the business
  status          text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
  admin_notes      text,
  trip_range       daterange generated always as (daterange(trip_date, coalesce(return_date, trip_date), '[]')) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint bookings_return_after_trip check (return_date is null or return_date >= trip_date),
  constraint bookings_confirmed_has_vehicle check (status not in ('confirmed', 'completed') or vehicle_id is not null),
  -- The database itself guarantees a vehicle can never hold two confirmed trips on overlapping dates,
  -- even when two administrators confirm at the same moment.
  constraint bookings_no_overlap exclude using gist (vehicle_id with =, trip_range with &&)
    where (status in ('confirmed', 'completed'))
);
create index bookings_status_idx on public.bookings (status, trip_date);
create index bookings_created_idx on public.bookings (created_at desc);
create index bookings_phone_idx on public.bookings (customer_phone);
create index bookings_vehicle_idx on public.bookings (vehicle_id, trip_date);
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

create table public.booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  kind        text not null check (kind in ('created', 'status', 'edit', 'note')),
  from_status text,
  to_status   text,
  note        text,
  admin_id    uuid references public.admin_users (id) on delete set null,
  actor       text not null default 'system',
  created_at  timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- Enquiries from the contact form
-- ---------------------------------------------------------------------------
create table public.enquiries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  email      text,
  message    text not null,
  status     text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now()
);
create index enquiries_created_idx on public.enquiries (created_at desc);

-- ---------------------------------------------------------------------------
-- Editable content
-- ---------------------------------------------------------------------------
create table public.services (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title      text not null,
  summary    text not null default '',
  body       text not null default '',
  icon       text not null default 'route',
  image      text,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();

-- Only genuine reviews supplied by the business. Nothing is shown until published.
create table public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  author_name  text not null,
  author_place text,
  quote        text not null,
  trip_label   text,
  source_note  text,
  is_published boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create table public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Supabase exposes the public schema through its REST API. All access goes through
-- the Node server (service connection), so lock the tables away from anon/authenticated.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['admin_users','admin_sessions','vehicles','vehicle_images','vehicle_blocks',
                           'bookings','booking_events','enquiries','services','testimonials','site_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
    end if;
  end loop;
end $$;
