create table public.spotify_featured_playlists (
  position smallint primary key check (position between 1 and 5),
  title text check (title is null or char_length(title) between 1 and 100),
  spotify_url text check (
    spotify_url is null
    or spotify_url ~ '^https://open\.spotify\.com/playlist/[A-Za-z0-9]+([?].*)?$'
  ),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (title is not null and spotify_url is not null)
  )
);

insert into public.spotify_featured_playlists (position)
select generate_series(1, 5);

alter table public.spotify_featured_playlists enable row level security;

create policy "Public can read featured playlists"
on public.spotify_featured_playlists
for select
to anon, authenticated
using (true);

create policy "Authenticated users can update featured playlists"
on public.spotify_featured_playlists
for update
to authenticated
using (position between 1 and 5)
with check (position between 1 and 5);

revoke all on table public.spotify_featured_playlists from anon, authenticated;
grant select on table public.spotify_featured_playlists to anon, authenticated;
grant update on table public.spotify_featured_playlists to authenticated;
