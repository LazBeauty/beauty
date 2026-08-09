-- Termin — migration 4: оценки, слики за профил, датум на термин
-- Копирај во Supabase → SQL Editor → New query → Run

-- Оценки (се пополнуваат 2 часа откако ќе заврши терминот)
alter table bookings add column if not exists rating int;          -- 1-5, или 0 = прескокнато
alter table bookings add column if not exists review text;
alter table bookings add column if not exists date date;           -- вистински датум на терминот (за пресметка на "2 часа подоцна")
alter table bookings add column if not exists provider_salon text; -- снимка на името на салонот во моментот на закажување

-- Слики за профил
alter table providers add column if not exists avatar_url text;
alter table clients add column if not exists avatar_url text;

-- Storage bucket за слики (јавно читливи)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "public read avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "public upload avatars" on storage.objects for insert with check (bucket_id = 'avatars');
create policy "public update avatars" on storage.objects for update using (bucket_id = 'avatars');
create policy "public delete avatars" on storage.objects for delete using (bucket_id = 'avatars');
