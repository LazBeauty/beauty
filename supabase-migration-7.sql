-- Termin — migration 7
-- Копирај во Supabase → SQL Editor → New query → Run

-- 1) БАГ ФИКС: клиентскиот профил немаше дозвола за update (затоа не се зачувуваа промените)
create policy "public update clients" on clients for update using (true);

-- 2) Јавен профил на давателот (клиентите го гледаат)
alter table providers add column if not exists bio text;
alter table providers add column if not exists phone text;
alter table providers add column if not exists address text;

-- 3) Откажување со причина + кој откажал
alter table bookings add column if not exists cancel_reason text;
alter table bookings add column if not exists cancelled_by text; -- 'client' | 'provider'

-- 4) Реално време (без рефреш) — вклучи realtime на овие табели
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table availability;
