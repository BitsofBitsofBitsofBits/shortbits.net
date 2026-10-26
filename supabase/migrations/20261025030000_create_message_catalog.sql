create function public.valid_message_format(value jsonb)
returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select case when jsonb_typeof(value) <> 'object' then false else not exists (
    select from jsonb_each(value) field
    where field.key <> all(array['color', 'fontWeight', 'fontFamily', 'fontSize', 'fontStyle',
      'letterSpacing', 'textDecoration', 'textTransform'])
      or jsonb_typeof(field.value) <> 'string'
      or char_length(field.value #>> '{}') > 200
      or (field.value #>> '{}') ~* '[;<>{}]|url[[:space:]]*\('
  ) end;
$$;

create table public.site_message_catalog (
  position integer primary key check (position > 0),
  profile text not null check (profile in (
    'standard', 'new-year', 'christmas', 'halloween', 'birthday', 'valentines',
    'st-patricks', 'easter', 'earth-day', 'independence-day', 'pi-day', 'april-fools',
    '404-day', 'may-fourth', 'leap-day', 'thanksgiving', 'friday-the-13th'
  )),
  category text not null check (category in (
    'messages', 'activities', 'shutdownMessages', 'bootMessages', 'initialBootSteps',
    'playingDeadMessages', 'glitchMessages', 'monitor.cpu', 'monitor.gpu', 'monitor.network',
    'monitor.ram', 'monitor.storage', 'monitor.thermal'
  )),
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  weight double precision not null default 1 check (weight > 0 and weight <= 1000),
  colorful boolean not null default false,
  format jsonb not null default '{}'::jsonb check (public.valid_message_format(format)),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (category in ('messages', 'activities') or (weight = 1 and not colorful and format = '{}'::jsonb))
);

create index site_message_catalog_pool on public.site_message_catalog (profile, category, position);
alter table public.site_message_catalog enable row level security;
create policy "Public can read enabled message entries" on public.site_message_catalog
  for select to anon using (enabled);
create policy "Authenticated users can manage message entries" on public.site_message_catalog
  for all to authenticated using (true) with check (position > 0);
revoke all on table public.site_message_catalog from anon, authenticated;
grant select on table public.site_message_catalog to anon, authenticated;
grant insert, update, delete on table public.site_message_catalog to authenticated;

create or replace function public.content_backup_tables()
returns text[]
language sql immutable
set search_path = public, pg_temp
as $$
  select array[
    'pronoun_profiles', 'site_blog_posts', 'site_changelog', 'site_creators', 'site_favorite_games',
    'site_hardware', 'site_hardware_machine_order', 'site_message_catalog', 'site_now',
    'site_resume_certifications', 'site_resume_education', 'site_resume_entries',
    'site_resume_profile', 'spotify_featured_playlists', 'spotify_featured_tracks'
  ]::text[];
$$;
