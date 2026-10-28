create table public.site_resume_skills (
  position integer primary key check (position > 0),
  category text check (category is null or char_length(category) between 1 and 120),
  skills text check (skills is null or char_length(skills) between 1 and 6000),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not enabled or (
    category is not null and btrim(category) <> ''
    and skills is not null and btrim(skills) <> ''
  ))
);

alter table public.site_resume_skills enable row level security;
create policy "Public can read published resume skills" on public.site_resume_skills
  for select to anon using (enabled);
create policy "Authenticated users can manage resume skills" on public.site_resume_skills
  for all to authenticated using (true) with check (position > 0);
revoke all on public.site_resume_skills from anon, authenticated;
grant select on public.site_resume_skills to anon, authenticated;
grant insert, update, delete on public.site_resume_skills to authenticated;

insert into public.site_resume_skills (position, category, skills, enabled) values
  (1, 'Systems & identity', 'Windows Server, Active Directory, SMB shares, RDP', true),
  (2, 'Virtualization & containers', 'Proxmox, UnRAID, Docker, Virtual machines', true),
  (3, 'Automation', 'PowerShell, Bash, Batch', true),
  (4, 'Endpoint management', 'Microsoft 365, Intune', true),
  (5, 'Networking', 'VLAN segmentation, Firewall configuration', true),
  (6, 'Backup & recovery', 'Veeam, Windows Backup Services, Google Drive, OneDrive', true);

-- Import only published experience data; private drafts must not become public skills.
with existing as (
  select lower(btrim(value)) as name
  from public.site_resume_skills,
    lateral regexp_split_to_table(skills, ',') as value
), candidates as (
  select btrim(value) as name, entry.position, ordinal,
    row_number() over (partition by lower(btrim(value)) order by entry.position, ordinal) as duplicate
  from public.site_resume_entries as entry,
    lateral regexp_split_to_table(coalesce(entry.technologies, ''), '[,;|' || chr(8226) || E'\\n]|[[:space:]]{2,}')
      with ordinality as split(value, ordinal)
  where entry.enabled
), imported as (
  select string_agg(name, ', ' order by position, ordinal) as skills
  from candidates
  where name <> '' and duplicate = 1
    and lower(name) not in (select name from existing)
)
insert into public.site_resume_skills (position, category, skills, enabled)
select 7, 'Additional experience skills', skills, true from imported where skills is not null;

create or replace function public.content_backup_tables()
returns text[] language sql immutable
set search_path = public, pg_temp
as $$
  select array[
    'pronoun_profiles', 'site_blog_posts', 'site_changelog', 'site_creators', 'site_favorite_games',
    'site_featured_project', 'site_hardware', 'site_hardware_machine_order', 'site_message_catalog',
    'site_message_pools', 'site_message_settings', 'site_now', 'site_resume_certifications',
    'site_resume_education', 'site_resume_entries', 'site_resume_profile', 'site_resume_skills',
    'spotify_featured_playlists', 'spotify_featured_tracks'
  ]::text[];
$$;
