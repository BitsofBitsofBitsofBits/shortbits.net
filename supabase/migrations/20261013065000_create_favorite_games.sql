create table public.site_favorite_games (
  position integer primary key check (position > 0),
  title text check (title is null or char_length(title) between 1 and 120),
  platform text check (platform is null or char_length(platform) between 1 and 80),
  store_url text check (
    store_url is null
    or (
      char_length(store_url) <= 500
      and store_url ~ '^https://[^[:space:]]+$'
    )
  ),
  note text check (note is null or char_length(note) between 1 and 500),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (
      title is not null
      and platform is not null
      and store_url is not null
    )
  )
);

insert into public.site_favorite_games (
  position,
  title,
  platform,
  store_url,
  note,
  enabled
)
values
  (
    1,
    'Minecraft',
    'OFFICIAL SITE',
    'https://www.minecraft.net/',
    'Creative survival, questionable redstone, and an unreasonable number of blocks.',
    true
  ),
  (
    2,
    'Portal',
    'STEAM',
    'https://store.steampowered.com/app/400/Portal/',
    'Thinking with portals, one test chamber at a time.',
    true
  ),
  (
    3,
    'Portal 2',
    'STEAM',
    'https://store.steampowered.com/app/620/Portal_2/',
    'Cooperative science and aggressively helpful robots.',
    true
  ),
  (
    4,
    'Life is Strange',
    'SQUARE ENIX',
    'https://lifeisstrange.square-enix-games.com/en-us',
    'Time travel, difficult choices, and emotional damage.',
    true
  );

alter table public.site_favorite_games enable row level security;

create policy "Public can read published favorite games"
on public.site_favorite_games
for select
to anon
using (enabled);

create policy "Authenticated users can read favorite games"
on public.site_favorite_games
for select
to authenticated
using (true);

create policy "Authenticated users can update favorite games"
on public.site_favorite_games
for update
to authenticated
using (true)
with check (position > 0);

create policy "Authenticated users can insert favorite games"
on public.site_favorite_games
for insert
to authenticated
with check (position > 0);

create policy "Authenticated users can delete favorite games"
on public.site_favorite_games
for delete
to authenticated
using (true);

revoke all on table public.site_favorite_games from anon, authenticated;
grant select on table public.site_favorite_games to anon, authenticated;
grant insert, update, delete on table public.site_favorite_games to authenticated;

alter table public.site_analytics_windows_daily
drop constraint site_analytics_windows_daily_window_slug_check;

alter table public.site_analytics_windows_daily
add constraint site_analytics_windows_daily_window_slug_check check (
  window_slug in (
    'about',
    'pronouns',
    'spotify',
    'source',
    'monitor',
    'settings',
    'resume',
    'now',
    'changelog',
    'guestbook',
    'filesystem',
    'arcade',
    'games',
    'notifications',
    'stats'
  )
);

create or replace function public.record_site_analytics(
  p_event text,
  p_target text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  analytics_day date := timezone('utc', now())::date;
begin
  if p_event = 'view' then
    insert into public.site_analytics_daily (day, views)
    values (analytics_day, 1)
    on conflict (day) do update
    set views = site_analytics_daily.views + 1,
        updated_at = now();
  elsif p_event = 'session' then
    insert into public.site_analytics_daily (day, sessions)
    values (analytics_day, 1)
    on conflict (day) do update
    set sessions = site_analytics_daily.sessions + 1,
        updated_at = now();
  elsif p_event = 'arcade_play' then
    insert into public.site_analytics_daily (day, arcade_plays)
    values (analytics_day, 1)
    on conflict (day) do update
    set arcade_plays = site_analytics_daily.arcade_plays + 1,
        updated_at = now();
  elsif p_event = 'window_open' and p_target in (
    'about',
    'pronouns',
    'spotify',
    'source',
    'monitor',
    'settings',
    'resume',
    'now',
    'changelog',
    'guestbook',
    'filesystem',
    'arcade',
    'games',
    'notifications',
    'stats'
  ) then
    insert into public.site_analytics_windows_daily (day, window_slug, opens)
    values (analytics_day, p_target, 1)
    on conflict (day, window_slug) do update
    set opens = site_analytics_windows_daily.opens + 1,
        updated_at = now();
  else
    raise exception 'Unsupported analytics event';
  end if;
end;
$$;
