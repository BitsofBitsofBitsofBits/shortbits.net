alter table public.site_short_links
add column display_mode text not null default 'redirect' check (
  display_mode in ('redirect', 'embed', 'landing')
),
add column description text check (
  description is null
  or char_length(description) between 1 and 500
);

create or replace function public.set_short_link_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if row(
    new.slug,
    new.title,
    new.description,
    new.destination_url,
    new.display_mode,
    new.enabled,
    new.expires_at
  ) is distinct from row(
    old.slug,
    old.title,
    old.description,
    old.destination_url,
    old.display_mode,
    old.enabled,
    old.expires_at
  ) then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;

drop function public.resolve_short_link(text);

create function public.resolve_short_link(p_slug text)
returns table (
  destination_url text,
  display_mode text,
  title text,
  description text
)
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
  returning
    site_short_links.destination_url,
    site_short_links.display_mode,
    site_short_links.title,
    site_short_links.description;
end;
$$;

revoke all on function public.resolve_short_link(text) from public;
grant execute on function public.resolve_short_link(text) to anon, authenticated;
