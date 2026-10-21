create table public.site_resume_certifications (
  position integer primary key check (position > 0),
  name text check (name is null or char_length(name) between 1 and 160),
  issuer text check (issuer is null or char_length(issuer) between 1 and 120),
  issued text check (issued is null or char_length(issued) between 1 and 100),
  credential_id text check (
    credential_id is null
    or char_length(credential_id) between 1 and 100
  ),
  credential_url text check (
    credential_url is null
    or (
      char_length(credential_url) <= 500
      and credential_url ~ '^https://[^[:space:]]+$'
    )
  ),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (
      name is not null
      and issuer is not null
      and issued is not null
    )
  )
);

alter table public.site_resume_certifications enable row level security;

create policy "Public can read published resume certifications"
on public.site_resume_certifications
for select
to anon
using (enabled);

create policy "Authenticated users can read resume certifications"
on public.site_resume_certifications
for select
to authenticated
using (true);

create policy "Authenticated users can update resume certifications"
on public.site_resume_certifications
for update
to authenticated
using (true)
with check (position > 0);

create policy "Authenticated users can insert resume certifications"
on public.site_resume_certifications
for insert
to authenticated
with check (position > 0);

create policy "Authenticated users can delete resume certifications"
on public.site_resume_certifications
for delete
to authenticated
using (true);

revoke all on table public.site_resume_certifications from anon, authenticated;
grant select on table public.site_resume_certifications to anon, authenticated;
grant insert, update, delete on table public.site_resume_certifications to authenticated;

insert into public.site_resume_certifications (
  position,
  name,
  issuer,
  issued,
  credential_id,
  credential_url,
  enabled
) values (
  1,
  'Microsoft 365 Fundamentals',
  'Microsoft',
  'Jan 2023',
  'I584-8484',
  'https://learn.microsoft.com/api/credentials/share/en-us/CalebKMasters/DF197D6093573F0D?sharingId=C122D072BED21EC',
  true
);
