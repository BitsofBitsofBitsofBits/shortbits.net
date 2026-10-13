create table public.site_resume_profile (
  id text primary key check (id = 'primary'),
  headline text check (headline is null or char_length(headline) between 1 and 120),
  summary text check (summary is null or char_length(summary) between 1 and 1200),
  availability text check (availability is null or char_length(availability) between 1 and 120),
  location text check (location is null or char_length(location) between 1 and 120),
  resume_url text check (
    resume_url is null
    or resume_url ~ '^https://[^[:space:]]+$'
  ),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not enabled or (headline is not null and summary is not null))
);

insert into public.site_resume_profile (id) values ('primary');

create table public.site_resume_entries (
  position smallint primary key check (position between 1 and 6),
  role text check (role is null or char_length(role) between 1 and 120),
  organization text check (
    organization is null
    or char_length(organization) between 1 and 120
  ),
  period text check (period is null or char_length(period) between 1 and 100),
  summary text check (summary is null or char_length(summary) between 1 and 1000),
  technologies text check (
    technologies is null
    or char_length(technologies) between 1 and 300
  ),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (
      role is not null
      and organization is not null
      and period is not null
      and summary is not null
    )
  )
);

insert into public.site_resume_entries (position)
select generate_series(1, 6);

create table public.site_now (
  id text primary key check (id = 'primary'),
  headline text check (headline is null or char_length(headline) between 1 and 120),
  summary text check (summary is null or char_length(summary) between 1 and 1000),
  building text check (building is null or char_length(building) between 1 and 300),
  learning text check (learning is null or char_length(learning) between 1 and 300),
  playing text check (playing is null or char_length(playing) between 1 and 300),
  reading text check (reading is null or char_length(reading) between 1 and 300),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not enabled or (headline is not null and summary is not null))
);

insert into public.site_now (id) values ('primary');

create table public.site_changelog (
  position smallint primary key check (position between 1 and 10),
  entry_date date,
  title text check (title is null or char_length(title) between 1 and 120),
  summary text check (summary is null or char_length(summary) between 1 and 800),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (entry_date is not null and title is not null and summary is not null)
  )
);

insert into public.site_changelog (position)
select generate_series(1, 10);

alter table public.site_resume_profile enable row level security;
alter table public.site_resume_entries enable row level security;
alter table public.site_now enable row level security;
alter table public.site_changelog enable row level security;

create policy "Public can read published resume profile"
on public.site_resume_profile
for select
to anon
using (enabled);

create policy "Public can read published resume entries"
on public.site_resume_entries
for select
to anon
using (enabled);

create policy "Public can read published now profile"
on public.site_now
for select
to anon
using (enabled);

create policy "Public can read published changelog entries"
on public.site_changelog
for select
to anon
using (enabled);

create policy "Authenticated users can read resume profile"
on public.site_resume_profile
for select
to authenticated
using (true);

create policy "Authenticated users can read resume entries"
on public.site_resume_entries
for select
to authenticated
using (true);

create policy "Authenticated users can read now profile"
on public.site_now
for select
to authenticated
using (true);

create policy "Authenticated users can read changelog entries"
on public.site_changelog
for select
to authenticated
using (true);

create policy "Authenticated users can update resume profile"
on public.site_resume_profile
for update
to authenticated
using (id = 'primary')
with check (id = 'primary');

create policy "Authenticated users can update resume entries"
on public.site_resume_entries
for update
to authenticated
using (position between 1 and 6)
with check (position between 1 and 6);

create policy "Authenticated users can update now profile"
on public.site_now
for update
to authenticated
using (id = 'primary')
with check (id = 'primary');

create policy "Authenticated users can update changelog entries"
on public.site_changelog
for update
to authenticated
using (position between 1 and 10)
with check (position between 1 and 10);

revoke all on table public.site_resume_profile from anon, authenticated;
revoke all on table public.site_resume_entries from anon, authenticated;
revoke all on table public.site_now from anon, authenticated;
revoke all on table public.site_changelog from anon, authenticated;

grant select on table public.site_resume_profile to anon, authenticated;
grant select on table public.site_resume_entries to anon, authenticated;
grant select on table public.site_now to anon, authenticated;
grant select on table public.site_changelog to anon, authenticated;

grant update on table public.site_resume_profile to authenticated;
grant update on table public.site_resume_entries to authenticated;
grant update on table public.site_now to authenticated;
grant update on table public.site_changelog to authenticated;
