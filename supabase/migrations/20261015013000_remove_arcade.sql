drop table if exists public.arcade_scores;

delete from public.site_analytics_windows_daily
where window_slug = 'arcade';

alter table public.site_analytics_windows_daily
drop constraint if exists site_analytics_windows_daily_window_slug_check;

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

create or replace function public.get_site_analytics()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with today as (
    select
      coalesce(views, 0) as views,
      coalesce(sessions, 0) as sessions
    from public.site_analytics_daily
    where day = timezone('utc', now())::date
  ),
  totals as (
    select
      coalesce(sum(views), 0) as views,
      coalesce(sum(sessions), 0) as sessions,
      max(updated_at) as updated_at
    from public.site_analytics_daily
  ),
  popular as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('slug', ranked.window_slug, 'opens', ranked.opens)
        order by ranked.opens desc, ranked.window_slug
      ),
      '[]'::jsonb
    ) as windows
    from (
      select window_slug, sum(opens) as opens
      from public.site_analytics_windows_daily
      group by window_slug
      order by opens desc, window_slug
      limit 6
    ) ranked
  )
  select jsonb_build_object(
    'today', jsonb_build_object(
      'views', coalesce((select views from today), 0),
      'sessions', coalesce((select sessions from today), 0)
    ),
    'totals', jsonb_build_object(
      'views', totals.views,
      'sessions', totals.sessions
    ),
    'popular_windows', popular.windows,
    'updated_at', totals.updated_at
  )
  from totals
  cross join popular;
$$;

alter table public.site_analytics_daily
drop column if exists arcade_plays;

revoke all on function public.record_site_analytics(text, text) from public;
revoke all on function public.get_site_analytics() from public;

grant execute on function public.record_site_analytics(text, text)
to anon, authenticated;
grant execute on function public.get_site_analytics()
to anon, authenticated;
