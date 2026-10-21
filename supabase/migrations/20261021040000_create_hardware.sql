create table public.site_hardware (
  position integer primary key check (position > 0),
  machine text check (machine is null or char_length(machine) between 1 and 60),
  component text check (component is null or char_length(component) between 1 and 40),
  name text check (name is null or char_length(name) between 1 and 160),
  detail text check (detail is null or char_length(detail) between 1 and 300),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (
      machine is not null
      and component is not null
      and name is not null
    )
  )
);

alter table public.site_hardware enable row level security;

create policy "Public can read published hardware"
on public.site_hardware
for select
to anon
using (enabled);

create policy "Authenticated users can read hardware"
on public.site_hardware
for select
to authenticated
using (true);

create policy "Authenticated users can update hardware"
on public.site_hardware
for update
to authenticated
using (true)
with check (position > 0);

create policy "Authenticated users can insert hardware"
on public.site_hardware
for insert
to authenticated
with check (position > 0);

create policy "Authenticated users can delete hardware"
on public.site_hardware
for delete
to authenticated
using (true);

revoke all on table public.site_hardware from anon, authenticated;
grant select on table public.site_hardware to anon, authenticated;
grant insert, update, delete on table public.site_hardware to authenticated;

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
    'hardware',
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
    'hardware',
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

revoke all on function public.record_site_analytics(text, text) from public;
grant execute on function public.record_site_analytics(text, text)
to anon, authenticated;
