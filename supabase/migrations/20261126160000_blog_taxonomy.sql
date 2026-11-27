begin;

-- Taxonomy belongs to the revision, not a public catalog that private edits could change.
alter function public.blog_snapshot_valid(jsonb) rename to blog_content_snapshot_valid;

create function public.blog_taxonomy_item_valid(item jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
begin
  if item is null or jsonb_typeof(item) <> 'object' then return false; end if;
  if (select array_agg(k order by k) from jsonb_object_keys(item) k)
    is distinct from array['name','slug'] then return false; end if;
  return coalesce(jsonb_typeof(item->'name') = 'string'
    and char_length(item->>'name') between 1 and 80
    and btrim(item->>'name') = item->>'name'
    and (item->>'name') !~ '[[:cntrl:]]'
    and jsonb_typeof(item->'slug') = 'string'
    and char_length(item->>'slug') between 1 and 80
    and (item->>'slug') ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$', false);
end;
$$;

create function public.blog_taxonomy_valid(tags jsonb, series jsonb, reading_order integer)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare item jsonb;
begin
  if jsonb_typeof(tags) is distinct from 'array' or jsonb_array_length(tags) > 10 then return false; end if;
  for item in select value from jsonb_array_elements(tags) loop
    if not public.blog_taxonomy_item_valid(item) or (item->>'name') like '%,%' then return false; end if;
  end loop;
  if (select count(distinct value->>'slug') from jsonb_array_elements(tags)) <> jsonb_array_length(tags)
    or (select count(distinct lower(value->>'name')) from jsonb_array_elements(tags)) <> jsonb_array_length(tags)
    then return false; end if;
  if series is null or series = 'null'::jsonb then return reading_order is null; end if;
  return coalesce(public.blog_taxonomy_item_valid(series) and reading_order between 1 and 100000,false);
end;
$$;

create function public.blog_snapshot_valid(s jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
begin
  if s is null or jsonb_typeof(s) <> 'object' then return false; end if;
  if (select array_agg(k order by k) from jsonb_object_keys(s) k)
    is distinct from array['body_markdown','body_rich','excerpt','published_at','series','series_order','slug','tags','title']
    then return false; end if;
  if not public.blog_content_snapshot_valid(s - 'tags' - 'series' - 'series_order') then return false; end if;
  if jsonb_typeof(s->'series_order') not in ('null','number') then return false; end if;
  if s->'series_order' <> 'null'::jsonb and (s->>'series_order') !~ '^[1-9][0-9]{0,5}$' then return false; end if;
  return public.blog_taxonomy_valid(s->'tags', s->'series', (s->>'series_order')::integer);
end;
$$;

alter table public.site_blog_posts
  add column tags jsonb not null default '[]',
  add column series jsonb,
  add column series_order integer,
  add constraint blog_posts_taxonomy_check check (public.blog_taxonomy_valid(tags,series,series_order));
alter table public.site_blog_approved_revisions
  add column tags jsonb not null default '[]',
  add column series jsonb,
  add column series_order integer,
  add constraint blog_approved_taxonomy_check check (public.blog_taxonomy_valid(tags,series,series_order));

alter table public.site_blog_drafts drop constraint site_blog_drafts_snapshot_check;
alter table public.site_blog_draft_history drop constraint site_blog_draft_history_snapshot_check;
update public.site_blog_drafts set
  snapshot=snapshot || '{"tags":[],"series":null,"series_order":null}'::jsonb,
  version=gen_random_uuid(),last_request_id=null,last_request=null,last_receipt=null;
update public.site_blog_draft_history set
  snapshot=snapshot || '{"tags":[],"series":null,"series_order":null}'::jsonb;
alter table public.site_blog_drafts add constraint site_blog_drafts_snapshot_check check (public.blog_snapshot_valid(snapshot));
alter table public.site_blog_draft_history add constraint site_blog_draft_history_snapshot_check check (public.blog_snapshot_valid(snapshot));

create or replace view public.site_blog_public_posts with (security_invoker=true) as
select p.id,coalesce(a.slug,p.slug) as slug,coalesce(a.title,p.title) as title,
  coalesce(a.excerpt,p.excerpt) as excerpt,coalesce(a.body_markdown,p.body_markdown) as body_markdown,
  case when a.id is not null then a.body_rich else p.body_rich end as body_rich,
  p.published,coalesce(a.published_at,p.published_at) as published_at,
  p.created_at,coalesce(a.updated_at,p.updated_at) as updated_at,
  case when a.id is not null then a.tags else p.tags end as tags,
  case when a.id is not null then a.series else p.series end as series,
  case when a.id is not null then a.series_order else p.series_order end as series_order
from public.site_blog_posts p left join public.site_blog_approved_revisions a
  on a.id=p.id and a.published_at<=now()
where p.published and p.published_at<=now();

create or replace function public.blog_effective_post(p_id uuid)
returns public.site_blog_posts language sql stable set search_path = pg_catalog as $$
  select p.id,coalesce(a.slug,p.slug),coalesce(a.title,p.title),coalesce(a.excerpt,p.excerpt),
    coalesce(a.body_markdown,p.body_markdown),p.published,
    coalesce(a.published_at,p.published_at),p.created_at,coalesce(a.updated_at,p.updated_at),
    case when a.id is not null then a.body_rich else p.body_rich end,
    case when a.id is not null then a.tags else p.tags end,
    case when a.id is not null then a.series else p.series end,
    case when a.id is not null then a.series_order else p.series_order end
  from public.site_blog_posts p left join public.site_blog_approved_revisions a
    on a.id=p.id and a.published_at<=now() and p.published and p.published_at<=now()
  where p.id=p_id;
$$;
create or replace function public.blog_post_snapshot(p public.site_blog_posts)
returns jsonb language sql stable set search_path = pg_catalog set timezone = 'UTC' as $$
  select jsonb_build_object('title',p.title,'slug',p.slug,'excerpt',p.excerpt,
    'body_markdown',p.body_markdown,'body_rich',p.body_rich,'published_at',p.published_at,
    'tags',p.tags,'series',p.series,'series_order',p.series_order);
$$;

create or replace function public.blog_draft_state(p_id uuid)
returns jsonb language plpgsql stable set search_path = pg_catalog set timezone = 'UTC' as $$
declare
  h public.site_blog_drafts%rowtype;
  p public.site_blog_posts%rowtype;
  a public.site_blog_approved_revisions%rowtype;
  s jsonb;
  approved jsonb;
  scheduled timestamptz;
begin
  select * into h from public.site_blog_drafts where id=p_id;
  select * into p from public.blog_effective_post(p_id);
  if h.id is null and p.id is null then raise exception using errcode='P0002',message='Blog identity not found'; end if;
  select * into a from public.site_blog_approved_revisions where id=p_id;
  s := case when h.id is not null then h.snapshot else public.blog_post_snapshot(p) end;
  approved := case when a.id is not null then jsonb_build_object('title',a.title,'slug',a.slug,
    'excerpt',a.excerpt,'body_markdown',a.body_markdown,'body_rich',a.body_rich,'published_at',a.published_at,
    'tags',a.tags,'series',a.series,'series_order',a.series_order)
    when p.id is not null then public.blog_post_snapshot(p) else null end;
  scheduled := case when a.published_at>now() and p.published then a.published_at
    when p.published and p.published_at>now() then p.published_at else null end;
  return jsonb_build_object('draft_id',p_id,'post_id',p.id,'version',h.version,'revision',coalesce(h.revision,0),
    'snapshot',s,'base_public_version',case when h.id is not null then h.base_public_version else p.updated_at end,
    'live',case when p.id is null then null else jsonb_build_object('id',p.id,'title',p.title,'slug',p.slug,
      'published',p.published and p.published_at<=now(),'published_at',p.published_at,'updated_at',p.updated_at) end,
    'scheduled_at',scheduled,'has_unpublished_changes',s is distinct from approved);
end;
$$;
create or replace function public.load_blog_draft(p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform public.blog_editor_authorize();
  if p_id is not null then return public.blog_draft_state(p_id); end if;
  return jsonb_build_object('draft_id',gen_random_uuid(),'post_id',null,'version',null,'revision',0,
    'snapshot',jsonb_build_object('title','','slug','','excerpt','','body_markdown','','body_rich',null,
      'published_at',null,'tags','[]'::jsonb,'series',null,'series_order',null),
    'base_public_version',null,'live',null,'scheduled_at',null,'has_unpublished_changes',false);
end;
$$;

-- Reuse the guarded publication transaction, then promote metadata under its same lock.
alter function public.publish_blog_draft(uuid,uuid,uuid,timestamptz,boolean) rename to blog_publish_content_draft;
revoke all on function public.blog_publish_content_draft(uuid,uuid,uuid,timestamptz,boolean) from public,anon,authenticated;
create function public.publish_blog_draft(p_id uuid,p_expected_version uuid,p_request_id uuid,
  p_expected_public_version timestamptz,p_accept_live_change boolean default false)
returns jsonb language plpgsql security definer set search_path = pg_catalog set timezone = 'UTC' as $$
declare h public.site_blog_drafts%rowtype; p public.site_blog_posts%rowtype; result jsonb;
begin
  perform public.blog_editor_authorize();
  perform public.blog_editor_lock();
  select * into h from public.site_blog_drafts where id=p_id;
  select * into p from public.blog_effective_post(p_id);
  result := public.blog_publish_content_draft(p_id,p_expected_version,p_request_id,p_expected_public_version,p_accept_live_change);
  if h.last_request_id=p_request_id then return result; end if;
  if p.published and p.published_at<=now() and (h.snapshot->>'published_at')::timestamptz>now() then
    update public.site_blog_posts set tags=p.tags,series=p.series,series_order=p.series_order where id=p_id;
    update public.site_blog_approved_revisions set tags=h.snapshot->'tags',
      series=nullif(h.snapshot->'series','null'::jsonb),series_order=(h.snapshot->>'series_order')::integer where id=p_id;
  else
    update public.site_blog_posts set tags=h.snapshot->'tags',
      series=nullif(h.snapshot->'series','null'::jsonb),series_order=(h.snapshot->>'series_order')::integer where id=p_id;
  end if;
  return public.blog_draft_receipt(p_id,p_request_id,(select last_request from public.site_blog_drafts where id=p_id));
end;
$$;
alter function public.unpublish_blog_draft(uuid,uuid,uuid) rename to blog_unpublish_content_draft;
revoke all on function public.blog_unpublish_content_draft(uuid,uuid,uuid) from public,anon,authenticated;
create function public.unpublish_blog_draft(p_id uuid,p_expected_version uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare h public.site_blog_drafts%rowtype; p public.site_blog_posts%rowtype; result jsonb;
begin
  perform public.blog_editor_authorize();
  perform public.blog_editor_lock();
  select * into h from public.site_blog_drafts where id=p_id;
  select * into p from public.blog_effective_post(p_id);
  result := public.blog_unpublish_content_draft(p_id,p_expected_version,p_request_id);
  if h.last_request_id=p_request_id then return result; end if;
  update public.site_blog_posts set tags=p.tags,series=p.series,series_order=p.series_order where id=p_id;
  return public.blog_draft_receipt(p_id,p_request_id,(select last_request from public.site_blog_drafts where id=p_id));
end;
$$;
revoke all on function public.blog_snapshot_valid(jsonb),public.blog_taxonomy_item_valid(jsonb),
  public.blog_taxonomy_valid(jsonb,jsonb,integer) from public,anon,authenticated;
revoke all on function public.publish_blog_draft(uuid,uuid,uuid,timestamptz,boolean),
  public.unpublish_blog_draft(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.publish_blog_draft(uuid,uuid,uuid,timestamptz,boolean),
  public.unpublish_blog_draft(uuid,uuid,uuid) to authenticated;

create function public.list_blog_taxonomy()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare result jsonb;
begin
  perform public.blog_editor_authorize();
  with metadata as (
    select snapshot->'tags' as tags,snapshot->'series' as series from public.site_blog_drafts
    union all select tags,series from public.site_blog_public_posts
    union all select tags,series from public.site_blog_approved_revisions
  ), tags as (
    select distinct on (value->>'slug') value from metadata cross join lateral jsonb_array_elements(tags)
    order by value->>'slug',value->>'name'
  ), series as (
    select distinct on (series->>'slug') series as value from metadata
    where series is not null and series <> 'null'::jsonb order by series->>'slug',series->>'name'
  )
  select jsonb_build_object('tags',(select coalesce(jsonb_agg(value order by value->>'name',value->>'slug'),'[]'::jsonb) from tags),
    'series',(select coalesce(jsonb_agg(value order by value->>'name',value->>'slug'),'[]'::jsonb) from series)) into result;
  return result;
end;
$$;
revoke all on function public.list_blog_taxonomy() from public,anon,authenticated;
grant execute on function public.list_blog_taxonomy() to authenticated;
commit;
