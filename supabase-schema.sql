-- Termin — Supabase schema
-- Copy this whole file into Supabase → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

create table providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  salon text not null,
  city text not null,
  pin text not null,              -- 4-digit code the provider sets, used to "log in" from any device
  avatar text,
  rating numeric default 5.0,
  services jsonb not null default '{}'::jsonb,   -- e.g. {"manikir": 600, "gel": 900}
  available boolean default true,
  created_at timestamptz default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  client_name text not null,
  client_phone text not null,
  service_id text not null,
  day text not null,
  time text not null,
  price integer not null,
  status text not null default 'pending', -- pending | accepted | declined
  created_at timestamptz default now()
);

-- Row Level Security: allow public read/write for now (no payments/sensitive data yet).
-- Tighten this later once real auth is added.
alter table providers enable row level security;
alter table bookings enable row level security;

create policy "public read providers" on providers for select using (true);
create policy "public insert providers" on providers for insert with check (true);
create policy "public update own provider" on providers for update using (true);

create policy "public read bookings" on bookings for select using (true);
create policy "public insert bookings" on bookings for insert with check (true);
create policy "public update bookings" on bookings for update using (true);
