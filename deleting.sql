-- Run this once against your existing Supabase database.
-- Makes deleting a client wipe every booking (and therefore every
-- review/rating/comment) they ever left, everywhere.

-- Find and drop whatever the FK is actually named (usually
-- bookings_client_id_fkey, but this looks it up to be safe):
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.bookings'::regclass
    and confrelid = 'public.clients'::regclass
    and contype = 'f';

  if fk_name is not null then
    execute format('alter table public.bookings drop constraint %I', fk_name);
  end if;
end $$;

alter table public.bookings
  add constraint bookings_client_id_fkey
  foreign key (client_id) references public.clients(id)
  on delete cascade;

-- One-time cleanup: also purge any bookings left over from clients
-- already deleted under the old (set null) behavior.
delete from public.bookings where client_id is null and client_name is not null;