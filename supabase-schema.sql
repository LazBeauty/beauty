-- =========================================================
-- TERMIN - CLEAN DATABASE SCHEMA
-- Fresh setup for Supabase
-- Google / Email authentication
-- =========================================================


-- =========================================================
-- 0. EXTENSIONS
-- =========================================================

create extension if not exists "pgcrypto";


-- =========================================================
-- 1. REMOVE OLD TABLES
-- =========================================================
-- WARNING: this deletes existing data from these tables.

drop table if exists public.portfolio_photos cascade;
drop table if exists public.availability cascade;
drop table if exists public.bookings cascade;
drop table if exists public.clients cascade;
drop table if exists public.providers cascade;


-- =========================================================
-- 2. PROVIDERS
-- =========================================================

create table public.providers (
  id uuid primary key default gen_random_uuid(),

  -- Authentication
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text,

  -- Basic profile
  name text not null,
  salon text not null,
  city text not null,
  pin text,

  -- Profile
  avatar text,
  avatar_url text,
  bio text,
  phone text,
  address text,

  -- Business
  rating numeric not null default 5.0,
  services jsonb not null default '{}'::jsonb,
  available boolean not null default true,

  created_at timestamptz not null default now()
);


-- =========================================================
-- 3. CLIENTS
-- =========================================================

create table public.clients (
  id uuid primary key default gen_random_uuid(),

  -- Authentication
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text,

  -- Profile
  name text not null,
  phone text not null,
  pin text,
  avatar_url text,

  created_at timestamptz not null default now()
);


-- =========================================================
-- 4. AVAILABILITY
-- =========================================================

create table public.availability (
  id uuid primary key default gen_random_uuid(),

  provider_id uuid not null
    references public.providers(id)
    on delete cascade,

  date date not null,
  time text not null,

  -- free | booked
  status text not null default 'free',

  created_at timestamptz not null default now()
);


-- =========================================================
-- 5. BOOKINGS
-- =========================================================

create table public.bookings (
  id uuid primary key default gen_random_uuid(),

  provider_id uuid
    references public.providers(id)
    on delete cascade,

  client_id uuid
    references public.clients(id)
    on delete set null,

  availability_id uuid
    references public.availability(id)
    on delete set null,

  -- Client information snapshot
  client_name text not null,
  client_phone text not null,

  -- Service
  service_id text not null,
  service_name text,
  category text,
  price integer not null,

  -- Appointment
  day text not null,
  time text not null,
  date date,

  -- Status
  status text not null default 'pending',

  -- Cancellation
  cancel_reason text,
  cancelled_by text,

  -- Provider information snapshot
  provider_salon text,

  -- Review
  rating integer,
  review text,

  -- Notification
  provider_notified boolean not null default true,

  created_at timestamptz not null default now()
);


-- =========================================================
-- 6. PORTFOLIO PHOTOS
-- =========================================================

create table public.portfolio_photos (
  id uuid primary key default gen_random_uuid(),

  provider_id uuid not null
    references public.providers(id)
    on delete cascade,

  -- manikir | pedikir | masaza | vegi
  category text not null,

  image_url text not null,

  created_at timestamptz not null default now()
);


-- =========================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- =========================================================

alter table public.providers enable row level security;
alter table public.clients enable row level security;
alter table public.availability enable row level security;
alter table public.bookings enable row level security;
alter table public.portfolio_photos enable row level security;


-- =========================================================
-- 8. PROVIDER POLICIES
-- =========================================================

-- Everyone can see provider profiles
create policy "public read providers"
on public.providers
for select
to anon, authenticated
using (true);


-- Logged-in user can create ONLY their own provider profile
create policy "owner insert provider"
on public.providers
for insert
to authenticated
with check (auth.uid() = auth_user_id);


-- Logged-in user can update ONLY their own provider profile
create policy "owner update provider"
on public.providers
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);


-- Logged-in user can delete ONLY their own provider profile
create policy "owner delete provider"
on public.providers
for delete
to authenticated
using (auth.uid() = auth_user_id);


-- =========================================================
-- 9. CLIENT POLICIES
-- =========================================================

-- Everyone can read client profiles if needed by the app
create policy "public read clients"
on public.clients
for select
to anon, authenticated
using (true);


-- Client can create only their own profile
create policy "owner insert client"
on public.clients
for insert
to authenticated
with check (auth.uid() = auth_user_id);


-- Client can update only their own profile
create policy "owner update client"
on public.clients
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);


-- Client can delete only their own profile
create policy "owner delete client"
on public.clients
for delete
to authenticated
using (auth.uid() = auth_user_id);


-- =========================================================
-- 10. AVAILABILITY POLICIES
-- =========================================================

-- Clients need to see available appointments
create policy "public read availability"
on public.availability
for select
to anon, authenticated
using (true);


-- Logged-in providers can create availability
create policy "authenticated insert availability"
on public.availability
for insert
to authenticated
with check (
  exists (
    select 1
    from public.providers p
    where p.id = provider_id
      and p.auth_user_id = auth.uid()
  )
);


-- Provider can update own availability
create policy "owner update availability"
on public.availability
for update
to authenticated
using (
  exists (
    select 1
    from public.providers p
    where p.id = provider_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.providers p
    where p.id = provider_id
      and p.auth_user_id = auth.uid()
  )
);


-- Provider can delete own availability
create policy "owner delete availability"
on public.availability
for delete
to authenticated
using (
  exists (
    select 1
    from public.providers p
    where p.id = provider_id
      and p.auth_user_id = auth.uid()
  )
);


-- =========================================================
-- 11. BOOKING POLICIES
-- =========================================================

-- Clients need to see bookings
create policy "public read bookings"
on public.bookings
for select
to anon, authenticated
using (true);


-- Allow authenticated users to create bookings
create policy "authenticated insert bookings"
on public.bookings
for insert
to authenticated
with check (true);


-- Allow authenticated users to update bookings
create policy "authenticated update bookings"
on public.bookings
for update
to authenticated
using (true)
with check (true);


-- =========================================================
-- 12. PORTFOLIO POLICIES
-- =========================================================

-- Everyone can see portfolio photos
create policy "public read portfolio"
on public.portfolio_photos
for select
to anon, authenticated
using (true);


-- Provider can upload own portfolio photos
create policy "owner insert portfolio"
on public.portfolio_photos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.providers p
    where p.id = provider_id
      and p.auth_user_id = auth.uid()
  )
);


-- Provider can delete own portfolio photos
create policy "owner delete portfolio"
on public.portfolio_photos
for delete
to authenticated
using (
  exists (
    select 1
    from public.providers p
    where p.id = provider_id
      and p.auth_user_id = auth.uid()
  )
);


-- =========================================================
-- 13. STORAGE - AVATARS + PORTFOLIO
-- =========================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = true;


-- Anyone can view images
create policy "public read avatar images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');


-- Logged-in users can upload images
create policy "authenticated upload avatar images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avatars');


-- Logged-in users can update images
create policy "authenticated update avatar images"
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars')
with check (bucket_id = 'avatars');


-- Logged-in users can delete images
create policy "authenticated delete avatar images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'avatars');


-- =========================================================
-- 14. REALTIME
-- =========================================================

do $$
begin

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;


  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'availability'
  ) then
    alter publication supabase_realtime add table public.availability;
  end if;

end $$;


-- =========================================================
-- DONE
-- =========================================================