create table public.site_short_links (
  slug text primary key check (
    slug ~ '^[a-z0-9][a-z0-9_-]{2,63}$'
  ),
  title text check (
    title is null
    or char_length(title) between 1 and 120
  ),
  destination_url text not null check (
    char_length(destination_url) <= 2000
    and destination_url ~ '^https://[^[:space:]]+$'
  ),
  enabled boolean not null default true,
  expires_at timestamptz,
  click_count bigint not null default 0 check (click_count >= 0),
  last_clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_short_links enable row level security;

create policy "Authenticated users can read short links"
on public.site_short_links
for select
to authenticated
using (true);

create policy "Authenticated users can insert short links"
on public.site_short_links
for insert
to authenticated
with check (true);

create policy "Authenticated users can update short links"
on public.site_short_links
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete short links"
on public.site_short_links
for delete
to authenticated
using (true);

revoke all on table public.site_short_links from anon, authenticated;
grant select, insert, update, delete on table public.site_short_links to authenticated;

create or replace function public.resolve_short_link(p_slug text)
returns table (destination_url text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9_-]{2,63}$' then
    return;
  end if;

  return query
  update public.site_short_links
  set click_count = click_count + 1,
      last_clicked_at = now()
  where slug = p_slug
    and enabled
    and (expires_at is null or expires_at > now())
  returning site_short_links.destination_url;
end;
$$;

revoke all on function public.resolve_short_link(text) from public;
grant execute on function public.resolve_short_link(text) to anon, authenticated;
