alter table public.providers
alter column services
set default '[]'::jsonb;

update public.providers
set services = '[]'::jsonb
where services is null
   or jsonb_typeof(services) <> 'array';