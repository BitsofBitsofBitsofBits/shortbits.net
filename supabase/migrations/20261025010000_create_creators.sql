create table public.site_creators (
  position integer primary key check (position > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  title text check (title is null or char_length(title) between 1 and 120),
  platform text check (platform is null or char_length(platform) between 1 and 80),
  channel_url text check (channel_url is null or (
    char_length(channel_url) <= 500 and channel_url ~ '^https://[^[:space:]]+$'
  )),
  youtube_channel_id text check (
    youtube_channel_id is null or youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$'
  ),
  note text check (note is null or char_length(note) between 1 and 500),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not enabled or (title is not null and platform is not null and channel_url is not null))
);

alter table public.site_creators enable row level security;
create policy "Public can read enabled creators" on public.site_creators
  for select to anon using (enabled);
create policy "Authenticated users can manage creators" on public.site_creators
  for all to authenticated using (true) with check (position > 0);
revoke all on table public.site_creators from anon, authenticated;
grant select on table public.site_creators to anon, authenticated;
grant insert, update, delete on table public.site_creators to authenticated;

create or replace function public.content_backup_tables()
returns text[]
language sql immutable
set search_path = public, pg_temp
as $$
  select array[
    'pronoun_profiles', 'site_blog_posts', 'site_changelog', 'site_creators', 'site_favorite_games',
    'site_hardware', 'site_hardware_machine_order', 'site_now',
    'site_resume_certifications', 'site_resume_education', 'site_resume_entries',
    'site_resume_profile', 'spotify_featured_playlists', 'spotify_featured_tracks'
  ]::text[];
$$;

alter table public.site_analytics_windows_daily
  drop constraint site_analytics_windows_daily_window_slug_check;
alter table public.site_analytics_windows_daily
  add constraint site_analytics_windows_daily_window_slug_check check (
    window_slug in (
      'about', 'pronouns', 'spotify', 'source', 'monitor', 'settings', 'resume',
      'now', 'changelog', 'guestbook', 'filesystem', 'games', 'creators',
      'hardware', 'notifications', 'stats'
    )
  );

create or replace function public.record_site_analytics(p_event text, p_target text default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  analytics_day date := timezone('utc', now())::date;
begin
  if p_event = 'view' then
    insert into public.site_analytics_daily (day, views) values (analytics_day, 1)
    on conflict (day) do update
      set views = site_analytics_daily.views + 1, updated_at = now();
  elsif p_event = 'session' then
    insert into public.site_analytics_daily (day, sessions) values (analytics_day, 1)
    on conflict (day) do update
      set sessions = site_analytics_daily.sessions + 1, updated_at = now();
  elsif p_event = 'window_open' and p_target in (
    'about', 'pronouns', 'spotify', 'source', 'monitor', 'settings', 'resume',
    'now', 'changelog', 'guestbook', 'filesystem', 'games', 'creators',
    'hardware', 'notifications', 'stats'
  ) then
    insert into public.site_analytics_windows_daily (day, window_slug, opens)
    values (analytics_day, p_target, 1)
    on conflict (day, window_slug) do update
      set opens = site_analytics_windows_daily.opens + 1, updated_at = now();
  else
    raise exception 'Unsupported analytics event';
  end if;
end;
$$;
