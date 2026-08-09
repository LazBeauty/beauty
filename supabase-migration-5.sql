-- Termin — migration 5: слики од претходна работа (портфолио), по категорија
-- Копирај во Supabase → SQL Editor → New query → Run

create table if not exists portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  category text not null, -- manikir | pedikir | masaza | vegi
  image_url text not null,
  created_at timestamptz default now()
);

alter table portfolio_photos enable row level security;
create policy "public read portfolio" on portfolio_photos for select using (true);
create policy "public insert portfolio" on portfolio_photos for insert with check (true);
create policy "public delete portfolio" on portfolio_photos for delete using (true);

-- Забелешка: сликите се чуваат во истиот "avatars" storage bucket (веќе постои и е јавен),
-- само во посебна папка "portfolio/", нема потреба од нов bucket.
