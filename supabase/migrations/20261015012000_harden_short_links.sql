create or replace function public.set_short_link_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_site_short_links_updated_at
before update on public.site_short_links
for each row
execute function public.set_short_link_updated_at();

revoke all on function public.set_short_link_updated_at() from public;
