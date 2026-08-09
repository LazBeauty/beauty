-- Termin — migration 6: известувања за откажани термини
-- Копирај во Supabase → SQL Editor → New query → Run

alter table bookings add column if not exists provider_notified boolean default true;
-- default true за постоечките редови (не сакаме стари откажувања одеднаш да "искочат" како нови)
