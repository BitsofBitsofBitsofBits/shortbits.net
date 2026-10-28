create table public.site_social_links (
  position integer primary key check (position > 0),
  label text check (char_length(label) between 1 and 100),
  description text check (char_length(description) <= 300),
  url text check (char_length(url) <= 2000 and url ~ '^(https://[^/@[:space:]\\]+|/$|/[^/\\[:space:]])' and url !~ '[[:space:]\\]' and url !~ '^https://[^/]*@'),
  icon text check (icon in ('github','bluesky','youtube','twitch','discord','linkedin','spotify','facebook','reddit')),
  icon_text text check (char_length(icon_text) <= 8),
  image_url text check (char_length(image_url) <= 2000 and image_url ~ '^(https://[^/@[:space:]\\]+|/$|/[^/\\[:space:]])' and image_url !~ '[[:space:]\\]' and image_url !~ '^https://[^/]*@'),
  color text not null default '#66ff9a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  personal boolean not null default true,
  professional boolean not null default false,
  new_tab boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not enabled or (label is not null and btrim(label) <> '' and url is not null))
);
alter table public.site_social_links enable row level security;
create policy "Public can read published social links" on public.site_social_links
  for select to anon using (enabled and (personal or professional));
create policy "Authenticated users can manage social links" on public.site_social_links
  for all to authenticated using (true) with check (position > 0);
revoke all on public.site_social_links from anon, authenticated;
grant select on public.site_social_links to anon, authenticated;
grant insert, update, delete on public.site_social_links to authenticated;

insert into public.site_social_links
  (position, sort_order, label, description, url, icon_text, icon, color, personal, professional, new_tab, enabled) values
  (1,1,'GITHUB','Tiny Bits Production Factory','https://github.com/BitsofBitsofBitsofBits','GH','github','#66ff9a',true,true,true,true),
  (2,2,'PROJECTS','Things that escaped localhost','https://github.com/BitsofBitsofBitsofBits?tab=repositories','01',null,'#63d8ff',true,false,true,true),
  (3,3,'BLOG.LOG','Longer-form Bits and project notes','/blog/','BL',null,'#ffcf66',true,false,false,true),
  (4,4,'BLUESKY','Flying blue Bits in the Sky','https://bsky.app/profile/shortbits.net','BS','bluesky','#7aa7ff',true,false,true,true),
  (5,5,'YOUTUBE','Occasionally moving pixels','https://www.youtube.com/@BitsofBitsofBits','YT','youtube','#ff6d7a',true,false,true,true),
  (6,6,'TWITCH','Sometimes my Bits Twitch a little.','https://www.twitch.tv/bitsofbitsofbits','TV','twitch','#b99aff',true,false,true,true),
  (7,7,'DISCORD','Wumpus stole my bits :(','https://discord.com/users/202220288459538442','DC','discord','#5865f2',true,false,true,true),
  (8,8,'LINKEDIN','Professional Bits','https://www.linkedin.com/in/calebkmasters/','IN','linkedin','#0a66c2',true,true,true,true),
  (9,9,'Spotify','Musical Bits','https://open.spotify.com/user/22fainfo6ycgibjw5xlhmp3ba','SP','spotify','#1db954',true,false,true,true),
  (10,10,'Facebook','Bits with a book full of faces','https://www.facebook.com/calebkmasters','FB','facebook','#1877f2',true,false,true,true),
  (11,11,'REDDIT','Bits in the hivemind','https://www.reddit.com/user/BitsofBitsofBits/','RD','reddit','#ff4500',true,false,true,true);

create or replace function public.content_backup_tables()
returns text[] language sql immutable set search_path = public, pg_temp as $$
  select array[
    'pronoun_profiles', 'site_blog_posts', 'site_changelog', 'site_creators', 'site_favorite_games',
    'site_featured_project', 'site_hardware', 'site_hardware_machine_order', 'site_message_catalog',
    'site_message_pools', 'site_message_settings', 'site_now', 'site_resume_certifications',
    'site_resume_education', 'site_resume_entries', 'site_resume_profile', 'site_resume_skills',
    'site_social_links', 'spotify_featured_playlists', 'spotify_featured_tracks'
  ]::text[];
$$;
