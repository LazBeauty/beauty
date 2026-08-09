-- Termin — migration 2: client accounts + custom services + cancel support
-- Копирај го ова во Supabase → SQL Editor → New query → Run
-- (не ги брише постоечките табели, само додава)

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  pin text not null,
  created_at timestamptz default now()
);

alter table bookings add column if not exists client_id uuid references clients(id) on delete set null;
alter table bookings add column if not exists service_name text;
alter table bookings add column if not exists category text;

alter table clients enable row level security;
create policy "public read clients" on clients for select using (true);
create policy "public insert clients" on clients for insert with check (true);

-- Забелешка: providers.services сега ќе чува листа со слободни услуги, пр:
-- [{"id": "abc123", "category": "manikir", "name": "Француски маникир", "price": 700}, ...]
-- Тоа е jsonb колона, веќе постои, не треба промена во структурата на табелата.
