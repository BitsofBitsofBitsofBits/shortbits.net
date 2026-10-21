create table public.site_resume_education (
  position integer primary key check (position > 0),
  school text check (school is null or char_length(school) between 1 and 120),
  credential text check (
    credential is null
    or char_length(credential) between 1 and 160
  ),
  period text check (period is null or char_length(period) between 1 and 100),
  details text check (details is null or char_length(details) between 1 and 600),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (
      school is not null
      and credential is not null
      and period is not null
    )
  )
);

alter table public.site_resume_education enable row level security;

create policy "Public can read published resume education"
on public.site_resume_education
for select
to anon
using (enabled);

create policy "Authenticated users can read resume education"
on public.site_resume_education
for select
to authenticated
using (true);

create policy "Authenticated users can update resume education"
on public.site_resume_education
for update
to authenticated
using (true)
with check (position > 0);

create policy "Authenticated users can insert resume education"
on public.site_resume_education
for insert
to authenticated
with check (position > 0);

create policy "Authenticated users can delete resume education"
on public.site_resume_education
for delete
to authenticated
using (true);

revoke all on table public.site_resume_education from anon, authenticated;
grant select on table public.site_resume_education to anon, authenticated;
grant insert, update, delete on table public.site_resume_education to authenticated;

insert into public.site_resume_education (
  position,
  school,
  credential,
  period,
  details,
  enabled
) values
  (
    1,
    'Purdue Global',
    'Bachelor of Science, Information Technology',
    'May 2026 - Apr 2029 · Expected',
    null,
    true
  ),
  (
    2,
    'Washburn Institute of Technology',
    'Certificate',
    '2018 - 2020',
    E'• National Technical Honors Society\n• SkillsUSA chapter leader: ran and organized all local SkillsUSA events and meetings',
    true
  );
