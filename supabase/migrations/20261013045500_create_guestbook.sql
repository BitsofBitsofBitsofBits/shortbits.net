create table public.site_guestbook (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.site_guestbook enable row level security;

create policy "Public can read Guestbook entries"
on public.site_guestbook
for select
to anon, authenticated
using (true);

create policy "Public can sign the Guestbook"
on public.site_guestbook
for insert
to anon, authenticated
with check (
  char_length(name) between 1 and 80
  and char_length(message) between 1 and 500
);

create policy "Authenticated users can delete Guestbook entries"
on public.site_guestbook
for delete
to authenticated
using (true);

revoke all on table public.site_guestbook from anon, authenticated;

grant select on table public.site_guestbook to anon, authenticated;
grant insert (name, message) on table public.site_guestbook to anon, authenticated;
grant delete on table public.site_guestbook to authenticated;
