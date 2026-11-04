create table public.site_blog_view_counts (
  post_id uuid primary key references public.site_blog_posts(id) on delete cascade,
  views bigint not null default 0 check (views >= 0)
);

create table public.site_blog_view_receipts (
  post_id uuid not null references public.site_blog_posts(id) on delete cascade,
  day date not null,
  token uuid not null,
  primary key (post_id, day, token)
);
create index site_blog_view_receipts_day_idx on public.site_blog_view_receipts(day);

alter table public.site_blog_view_counts enable row level security;
alter table public.site_blog_view_receipts enable row level security;
revoke all on public.site_blog_view_counts, public.site_blog_view_receipts from public, anon, authenticated;

-- A null token reads only. Callers cannot supply a total, date, or unpublished post ID.
create function public.get_blog_post_views(p_slug text, p_token uuid default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_id uuid;
  v_day date := (statement_timestamp() at time zone 'UTC')::date;
  v_inserted integer;
  v_views bigint;
begin
  select id into v_post_id from public.site_blog_posts
  where slug = p_slug and published and published_at <= statement_timestamp()
  for share;
  if v_post_id is null then
    return null;
  end if;

  if p_token is not null then
    delete from public.site_blog_view_receipts where day < v_day;
    insert into public.site_blog_view_receipts (post_id, day, token)
    values (v_post_id, v_day, p_token)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      insert into public.site_blog_view_counts (post_id, views)
      values (v_post_id, 1)
      on conflict (post_id) do update
      set views = public.site_blog_view_counts.views + 1;
    end if;
  end if;

  select views into v_views from public.site_blog_view_counts where post_id = v_post_id;
  return coalesce(v_views, 0);
end;
$$;

revoke all on function public.get_blog_post_views(text, uuid) from public;
grant execute on function public.get_blog_post_views(text, uuid) to anon, authenticated;
