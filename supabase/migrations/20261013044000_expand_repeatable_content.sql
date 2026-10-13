drop policy "Authenticated users can update featured playlists"
on public.spotify_featured_playlists;

drop policy "Authenticated users can update featured tracks"
on public.spotify_featured_tracks;

drop policy "Authenticated users can update resume entries"
on public.site_resume_entries;

drop policy "Authenticated users can update changelog entries"
on public.site_changelog;

alter table public.spotify_featured_playlists
drop constraint spotify_featured_playlists_position_check;

alter table public.spotify_featured_playlists
alter column position type integer;

alter table public.spotify_featured_playlists
add constraint spotify_featured_playlists_position_check check (position > 0);

alter table public.spotify_featured_tracks
drop constraint spotify_featured_tracks_position_check;

alter table public.spotify_featured_tracks
alter column position type integer;

alter table public.spotify_featured_tracks
add constraint spotify_featured_tracks_position_check check (position > 0);

alter table public.site_resume_entries
drop constraint site_resume_entries_position_check;

alter table public.site_resume_entries
alter column position type integer;

alter table public.site_resume_entries
add constraint site_resume_entries_position_check check (position > 0);

alter table public.site_changelog
drop constraint site_changelog_position_check;

alter table public.site_changelog
alter column position type integer;

alter table public.site_changelog
add constraint site_changelog_position_check check (position > 0);

create policy "Authenticated users can update featured playlists"
on public.spotify_featured_playlists
for update
to authenticated
using (true)
with check (position > 0);

create policy "Authenticated users can insert featured playlists"
on public.spotify_featured_playlists
for insert
to authenticated
with check (position > 0);

create policy "Authenticated users can delete featured playlists"
on public.spotify_featured_playlists
for delete
to authenticated
using (true);

create policy "Authenticated users can update featured tracks"
on public.spotify_featured_tracks
for update
to authenticated
using (true)
with check (position > 0);

create policy "Authenticated users can insert featured tracks"
on public.spotify_featured_tracks
for insert
to authenticated
with check (position > 0);

create policy "Authenticated users can delete featured tracks"
on public.spotify_featured_tracks
for delete
to authenticated
using (true);

create policy "Authenticated users can update resume entries"
on public.site_resume_entries
for update
to authenticated
using (true)
with check (position > 0);

create policy "Authenticated users can insert resume entries"
on public.site_resume_entries
for insert
to authenticated
with check (position > 0);

create policy "Authenticated users can delete resume entries"
on public.site_resume_entries
for delete
to authenticated
using (true);

create policy "Authenticated users can update changelog entries"
on public.site_changelog
for update
to authenticated
using (true)
with check (position > 0);

create policy "Authenticated users can insert changelog entries"
on public.site_changelog
for insert
to authenticated
with check (position > 0);

create policy "Authenticated users can delete changelog entries"
on public.site_changelog
for delete
to authenticated
using (true);

grant insert, delete on table public.spotify_featured_playlists to authenticated;
grant insert, delete on table public.spotify_featured_tracks to authenticated;
grant insert, delete on table public.site_resume_entries to authenticated;
grant insert, delete on table public.site_changelog to authenticated;
