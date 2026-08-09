-- Termin — migration 3: реални термини (датум + час) кои давателката сама ги отвора
-- Копирај во Supabase → SQL Editor → New query → Run

create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  date date not null,
  time text not null,
  status text not null default 'free', -- free | booked
  created_at timestamptz default now()
);

alter table bookings add column if not exists availability_id uuid references availability(id) on delete set null;

alter table availability enable row level security;
create policy "public read availability" on availability for select using (true);
create policy "public insert availability" on availability for insert with check (true);
create policy "public update availability" on availability for update using (true);
create policy "public delete availability" on availability for delete using (true);
