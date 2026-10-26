create table public.site_featured_project (
  position smallint primary key check (position = 1),
  title text not null default '' check (char_length(title) <= 120),
  summary text not null default '' check (char_length(summary) <= 1000),
  status text not null default '' check (char_length(status) <= 120),
  tags text not null default '' check (char_length(tags) <= 300),
  link_url text not null default '' check (
    char_length(link_url) <= 2000
    and (link_url = '' or link_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$')
  ),
  link_label text not null default '' check (char_length(link_label) <= 60),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not enabled or (
    btrim(title) <> '' and btrim(summary) <> ''
    and link_url <> '' and btrim(link_label) <> ''
  ))
);

insert into public.site_featured_project (position, title, summary, status, tags, link_url, link_label)
values (
  1, 'BITSOFBITS WEBSITE',
  'Where I keep my personal projects and experiments, sharing them with the world.',
  'PID 0101 // RUNNING', 'HTML, CSS, JAVASCRIPT, SUPABASE',
  'https://github.com/BitsofBitsofBitsofBits/shortbits.net', 'SOURCE'
);

alter table public.site_featured_project enable row level security;
create policy "Public can read the published featured project" on public.site_featured_project
  for select to anon using (enabled);
create policy "Authenticated users can manage the featured project" on public.site_featured_project
  for all to authenticated using (true) with check (position = 1);
revoke all on public.site_featured_project from anon, authenticated;
grant select on public.site_featured_project to anon, authenticated;
grant insert, update, delete on public.site_featured_project to authenticated;

create or replace function public.content_backup_tables()
returns text[] language sql immutable
set search_path = public, pg_temp
as $$
  select array[
    'pronoun_profiles', 'site_blog_posts', 'site_changelog', 'site_creators', 'site_favorite_games',
    'site_featured_project', 'site_hardware', 'site_hardware_machine_order', 'site_message_catalog',
    'site_message_pools', 'site_message_settings', 'site_now', 'site_resume_certifications',
    'site_resume_education', 'site_resume_entries', 'site_resume_profile',
    'spotify_featured_playlists', 'spotify_featured_tracks'
  ]::text[];
$$;
