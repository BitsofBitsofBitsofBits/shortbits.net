create table public.site_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) between 3 and 100
  ),
  title text not null check (char_length(title) between 1 and 160),
  excerpt text not null check (char_length(excerpt) between 1 and 500),
  body_markdown text not null check (char_length(body_markdown) between 1 and 50000),
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not published or published_at is not null)
);

create index site_blog_posts_public_order_idx
on public.site_blog_posts (published_at desc)
where published;

alter table public.site_blog_posts enable row level security;

create policy "Public can read published blog posts"
on public.site_blog_posts
for select
to anon
using (published and published_at <= now());

create policy "Authenticated users can read blog posts"
on public.site_blog_posts
for select
to authenticated
using (true);

create policy "Authenticated users can create blog posts"
on public.site_blog_posts
for insert
to authenticated
with check (true);

create policy "Authenticated users can update blog posts"
on public.site_blog_posts
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete blog posts"
on public.site_blog_posts
for delete
to authenticated
using (true);

revoke all on table public.site_blog_posts from anon, authenticated;
grant select on table public.site_blog_posts to anon, authenticated;
grant insert, update, delete on table public.site_blog_posts to authenticated;
