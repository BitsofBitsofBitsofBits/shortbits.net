-- Private editorial state is deliberately separate from the public publication row.
create function public.blog_snapshot_valid(s jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare t timestamptz;
begin
  if s is null or jsonb_typeof(s) <> 'object' then return false; end if;
  if (select array_agg(k order by k) from jsonb_object_keys(s) k)
    is distinct from array['body_markdown','body_rich','excerpt','published_at','slug','title'] then return false; end if;
  if jsonb_typeof(s->'title') is distinct from 'string'
    or jsonb_typeof(s->'slug') is distinct from 'string'
    or jsonb_typeof(s->'excerpt') is distinct from 'string'
    or jsonb_typeof(s->'body_markdown') is distinct from 'string'
    or char_length(s->>'title') > 160 or char_length(s->>'slug') > 100
    or char_length(s->>'excerpt') > 500 or char_length(s->>'body_markdown') > 200000 then return false; end if;
  if s->'body_rich' <> 'null'::jsonb and not coalesce((
    jsonb_typeof(s->'body_rich') = 'object' and s->'body_rich'->'version' = '1'::jsonb
    and jsonb_typeof(s->'body_rich'->'doc') = 'object'
    and s->'body_rich'->'doc'->>'type' = 'doc'
    and jsonb_typeof(s->'body_rich'->'doc'->'content') = 'array'
    and octet_length((s->'body_rich')::text) <= 1000000), false) then return false; end if;
  if s->'published_at' <> 'null'::jsonb then
    if jsonb_typeof(s->'published_at') <> 'string' then return false; end if;
    if (s->>'published_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[Tt ][0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?([Zz]|[+-][0-9]{2}(:?[0-9]{2})?)$'
      then return false; end if;
    t := (s->>'published_at')::timestamptz;
    if not isfinite(t) or t < '1000-01-01 UTC'::timestamptz or t >= '10000-01-01 UTC'::timestamptz then return false; end if;
  end if;
  return true;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;

create table public.site_blog_drafts (
  id uuid primary key,
  post_id uuid unique references public.site_blog_posts(id) on delete cascade,
  version uuid not null default gen_random_uuid(),
  revision integer not null check (revision >= 1),
  snapshot jsonb not null check (public.blog_snapshot_valid(snapshot)),
  base_public_version timestamptz,
  last_request_id uuid,
  last_request jsonb,
  last_receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (post_id is null or post_id = id),
  check ((last_request_id is null and last_request is null and last_receipt is null)
    or (last_request_id is not null and last_request is not null and last_receipt is not null))
);
create table public.site_blog_draft_history (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.site_blog_drafts(id) on delete cascade,
  revision integer not null check (revision >= 0),
  snapshot jsonb not null check (public.blog_snapshot_valid(snapshot)),
  reason text not null check (reason in ('baseline','autosave','manual','publish','restore')),
  created_at timestamptz not null default now(),
  unique (draft_id, revision)
);
create index site_blog_draft_history_order on public.site_blog_draft_history(draft_id, revision desc);

-- These are approved public documents, not private drafts. RLS reveals only due
-- snapshots with a still-eligible parent, even when the view is queried as anon.
create table public.site_blog_approved_revisions (
  id uuid primary key references public.site_blog_posts(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 100),
  title text not null check (char_length(title) between 1 and 160),
  excerpt text not null check (char_length(excerpt) between 1 and 500),
  body_markdown text not null,
  body_rich jsonb,
  published boolean not null check (published),
  published_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check (public.blog_snapshot_valid(jsonb_build_object('title',title,'slug',slug,'excerpt',excerpt,
    'body_markdown',body_markdown,'body_rich',body_rich,'published_at',published_at))
    and (char_length(body_markdown) >= 1 or body_rich is not null))
);
alter table public.site_blog_drafts enable row level security;
alter table public.site_blog_draft_history enable row level security;
alter table public.site_blog_approved_revisions enable row level security;
create policy blog_drafts_editor_read on public.site_blog_drafts for select to authenticated using (true);
create policy blog_history_editor_read on public.site_blog_draft_history for select to authenticated using (true);
create policy blog_approved_editor_read on public.site_blog_approved_revisions for select to authenticated using (true);
create policy blog_approved_public_read on public.site_blog_approved_revisions for select to anon using (
  published_at <= now() and exists (select 1 from public.site_blog_posts p
    where p.id = site_blog_approved_revisions.id and p.published and p.published_at <= now())
);
revoke all on public.site_blog_drafts, public.site_blog_draft_history, public.site_blog_approved_revisions from public, anon, authenticated;
grant select on public.site_blog_drafts, public.site_blog_draft_history, public.site_blog_approved_revisions to authenticated;
grant select on public.site_blog_approved_revisions to anon;
revoke insert, update on public.site_blog_posts from authenticated;

create view public.site_blog_public_posts with (security_invoker = true) as
select p.id, coalesce(a.slug,p.slug) as slug, coalesce(a.title,p.title) as title,
  coalesce(a.excerpt,p.excerpt) as excerpt, coalesce(a.body_markdown,p.body_markdown) as body_markdown,
  case when a.id is not null then a.body_rich else p.body_rich end as body_rich,
  p.published, coalesce(a.published_at,p.published_at) as published_at,
  p.created_at, coalesce(a.updated_at,p.updated_at) as updated_at
from public.site_blog_posts p
left join public.site_blog_approved_revisions a on a.id = p.id and a.published_at <= now()
where p.published and p.published_at <= now();
revoke all on public.site_blog_public_posts from public, anon, authenticated;
grant select on public.site_blog_public_posts to anon, authenticated;

create or replace function public.get_blog_post_views(p_slug text, p_token uuid default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_post_id uuid;
  v_day date := (statement_timestamp() at time zone 'UTC')::date;
  v_inserted integer;
  v_views bigint;
begin
  select id into v_post_id from public.site_blog_public_posts where slug=p_slug;
  if v_post_id is null then return null; end if;

  -- Lock the parent, not the nullable approved side of the public view. Recheck
  -- after waiting so a concurrent publication/deletion cannot count a stale slug.
  perform 1 from public.site_blog_posts where id=v_post_id for share;
  if not found or not exists (select 1 from public.site_blog_public_posts
    where id=v_post_id and slug=p_slug) then return null; end if;

  if p_token is not null then
    delete from public.site_blog_view_receipts where day < v_day;
    insert into public.site_blog_view_receipts(post_id,day,token)
      values(v_post_id,v_day,p_token) on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      insert into public.site_blog_view_counts(post_id,views) values(v_post_id,1)
        on conflict(post_id) do update set views=public.site_blog_view_counts.views+1;
    end if;
  end if;
  select views into v_views from public.site_blog_view_counts where post_id=v_post_id;
  return coalesce(v_views,0);
end;
$$;
revoke all on function public.get_blog_post_views(text,uuid) from public;
grant execute on function public.get_blog_post_views(text,uuid) to anon,authenticated;

create function public.blog_editor_authorize()
returns void language plpgsql stable set search_path = pg_catalog as $$
begin
  if current_setting('role', true) is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'Authenticated editorial access required';
  end if;
end;
$$;

create function public.blog_post_snapshot(p public.site_blog_posts)
returns jsonb language sql stable set search_path = pg_catalog set timezone = 'UTC' as $$
  select jsonb_build_object('title',p.title,'slug',p.slug,'excerpt',p.excerpt,
    'body_markdown',p.body_markdown,'body_rich',p.body_rich,'published_at',p.published_at);
$$;

create function public.blog_effective_post(p_id uuid)
returns public.site_blog_posts language sql stable set search_path = pg_catalog as $$
  select p.id, coalesce(a.slug,p.slug), coalesce(a.title,p.title), coalesce(a.excerpt,p.excerpt),
    coalesce(a.body_markdown,p.body_markdown), p.published,
    coalesce(a.published_at,p.published_at), p.created_at, coalesce(a.updated_at,p.updated_at),
    case when a.id is not null then a.body_rich else p.body_rich end
  from public.site_blog_posts p left join public.site_blog_approved_revisions a
    on a.id = p.id and a.published_at <= now() and p.published and p.published_at <= now()
  where p.id = p_id;
$$;

create function public.blog_draft_state(p_id uuid)
returns jsonb language plpgsql stable set search_path = pg_catalog set timezone = 'UTC' as $$
declare
  h public.site_blog_drafts%rowtype;
  p public.site_blog_posts%rowtype;
  a public.site_blog_approved_revisions%rowtype;
  s jsonb;
  approved jsonb;
  scheduled timestamptz;
begin
  select * into h from public.site_blog_drafts where id = p_id;
  select * into p from public.blog_effective_post(p_id);
  if h.id is null and p.id is null then
    raise exception using errcode = 'P0002', message = 'Blog identity not found';
  end if;
  select * into a from public.site_blog_approved_revisions where id = p_id;
  s := case when h.id is not null then h.snapshot else public.blog_post_snapshot(p) end;
  approved := case when a.id is not null then jsonb_build_object('title',a.title,'slug',a.slug,
    'excerpt',a.excerpt,'body_markdown',a.body_markdown,'body_rich',a.body_rich,'published_at',a.published_at)
    when p.id is not null then public.blog_post_snapshot(p) else null end;
  scheduled := case when a.published_at > now() and p.published then a.published_at
    when p.published and p.published_at > now() then p.published_at else null end;
  return jsonb_build_object('draft_id',p_id,'post_id',p.id,'version',h.version,
    'revision',coalesce(h.revision,0),'snapshot',s,
    'base_public_version',case when h.id is not null then h.base_public_version else p.updated_at end,
    'live',case when p.id is null then null else jsonb_build_object('id',p.id,'title',p.title,
      'slug',p.slug,'published',p.published and p.published_at <= now(),
      'published_at',p.published_at,'updated_at',p.updated_at) end,
    'scheduled_at',scheduled,'has_unpublished_changes',s is distinct from approved);
end;
$$;

create function public.load_blog_draft(p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform public.blog_editor_authorize();
  if p_id is not null then return public.blog_draft_state(p_id); end if;
  return jsonb_build_object('draft_id',gen_random_uuid(),'post_id',null,'version',null,'revision',0,
    'snapshot',jsonb_build_object('title','','slug','','excerpt','','body_markdown','','body_rich',null,'published_at',null),
    'base_public_version',null,'live',null,'scheduled_at',null,'has_unpublished_changes',false);
end;
$$;

-- One lock order for save/publish/restore/delete and full-content restoration.
-- The base-table lock also serializes slug reservations against native writes/deletes.
create function public.blog_editor_lock()
returns void language plpgsql set search_path = pg_catalog as $$
begin
  lock table public.site_blog_posts in share row exclusive mode;
  lock table public.site_blog_drafts in share row exclusive mode;
  lock table public.site_blog_draft_history in share row exclusive mode;
  lock table public.site_blog_approved_revisions in share row exclusive mode;
end;
$$;

create function public.blog_draft_retry(p_id uuid, p_expected uuid, p_request_id uuid, p_request jsonb)
returns jsonb language plpgsql set search_path = pg_catalog as $$
declare h public.site_blog_drafts%rowtype;
begin
  if p_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'Draft and request UUID required';
  end if;
  select * into h from public.site_blog_drafts where id = p_id for update;
  if h.id is not null and h.last_request_id = p_request_id then
    if h.last_request is distinct from p_request then
      raise exception using errcode = '40001', message = 'Request UUID payload conflict';
    end if;
    return h.last_receipt;
  end if;
  if h.version is distinct from p_expected then
    raise exception using errcode = '40001', message = 'Draft version conflict';
  end if;
  return null;
end;
$$;

create function public.blog_draft_checkpoint(p_id uuid, p_reason text, p_force boolean)
returns void language plpgsql set search_path = pg_catalog as $$
begin
  if p_force or not exists (select 1 from public.site_blog_draft_history
    where draft_id = p_id and created_at > now() - interval '5 minutes') then
    insert into public.site_blog_draft_history(draft_id,revision,snapshot,reason)
      select id,revision,snapshot,p_reason from public.site_blog_drafts where id = p_id;
    delete from public.site_blog_draft_history where draft_id = p_id and id in (
      select id from public.site_blog_draft_history where draft_id = p_id order by revision desc offset 100);
  end if;
end;
$$;

create function public.blog_draft_receipt(p_id uuid, p_request_id uuid, p_request jsonb)
returns jsonb language plpgsql set search_path = pg_catalog as $$
declare result jsonb;
begin
  result := public.blog_draft_state(p_id) || jsonb_build_object('request_id',p_request_id);
  update public.site_blog_drafts set last_request_id = p_request_id,
    last_request = p_request, last_receipt = result where id = p_id;
  return result;
end;
$$;

create function public.blog_ensure_public_head(p_id uuid)
returns void language plpgsql set search_path = pg_catalog as $$
declare p public.site_blog_posts%rowtype;
begin
  if exists (select 1 from public.site_blog_drafts where id=p_id) then return; end if;
  select * into p from public.blog_effective_post(p_id);
  if p.id is null then raise exception using errcode='P0002',message='Blog identity not found'; end if;
  insert into public.site_blog_drafts(id,post_id,revision,snapshot,base_public_version)
    values(p_id,p_id,1,public.blog_post_snapshot(p),p.updated_at);
  insert into public.site_blog_draft_history(draft_id,revision,snapshot,reason)
    values(p_id,0,public.blog_post_snapshot(p),'baseline');
end;
$$;

create function public.save_blog_draft(p_id uuid, p_expected_version uuid, p_base_public_version timestamptz,
  p_snapshot jsonb, p_request_id uuid, p_checkpoint boolean default false)
returns jsonb language plpgsql security definer set search_path = pg_catalog set timezone = 'UTC' as $$
declare
  request jsonb;
  retry jsonb;
  s jsonb;
  p public.site_blog_posts%rowtype;
begin
  perform public.blog_editor_authorize();
  if not public.blog_snapshot_valid(p_snapshot) or p_checkpoint is null then
    raise exception using errcode = '22023', message = 'Invalid draft snapshot';
  end if;
  s := p_snapshot || jsonb_build_object('published_at',(p_snapshot->>'published_at')::timestamptz);
  request := jsonb_build_object('op','save','expected',p_expected_version,'base',p_base_public_version,
    'snapshot',s,'checkpoint',p_checkpoint);
  perform public.blog_editor_lock();
  retry := public.blog_draft_retry(p_id,p_expected_version,p_request_id,request);
  if retry is not null then return retry; end if;
  if not exists (select 1 from public.site_blog_drafts where id = p_id) then
    select * into p from public.blog_effective_post(p_id);
    if p.id is null and p_base_public_version is not null then
      raise exception using errcode = '40001', message = 'Original public post was deleted';
    end if;
    if p.id is not null and p_base_public_version is null then
      raise exception using errcode = '40001', message = 'Public load version required';
    end if;
    insert into public.site_blog_drafts(id,post_id,revision,snapshot,base_public_version)
      values (p_id,p.id,1,s,p_base_public_version);
    if p.id is not null then
      insert into public.site_blog_draft_history(draft_id,revision,snapshot,reason)
        values (p_id,0,public.blog_post_snapshot(p),'baseline');
    end if;
  else
    update public.site_blog_drafts set snapshot = s,version = gen_random_uuid(),
      revision = revision + 1,updated_at = clock_timestamp() where id = p_id;
  end if;
  perform public.blog_draft_checkpoint(p_id,case when p_checkpoint then 'manual' else 'autosave' end,
    p_checkpoint or not exists (select 1 from public.site_blog_draft_history where draft_id = p_id and revision > 0));
  return public.blog_draft_receipt(p_id,p_request_id,request);
end;
$$;

create function public.publish_blog_draft(p_id uuid,p_expected_version uuid,p_request_id uuid,
  p_expected_public_version timestamptz,p_accept_live_change boolean default false)
returns jsonb language plpgsql security definer set search_path = pg_catalog set timezone = 'UTC' as $$
declare
  request jsonb := jsonb_build_object('op','publish','expected',p_expected_version,
    'public',p_expected_public_version,'accept',p_accept_live_change);
  retry jsonb;
  h public.site_blog_drafts%rowtype;
  p public.site_blog_posts%rowtype;
  s jsonb;
  due timestamptz;
  stamp timestamptz := clock_timestamp();
  effective_version timestamptz;
begin
  perform public.blog_editor_authorize();
  perform public.blog_editor_lock();
  retry := public.blog_draft_retry(p_id,p_expected_version,p_request_id,request);
  if retry is not null then return retry; end if;
  select * into h from public.site_blog_drafts where id = p_id;
  if h.id is null then raise exception using errcode = 'P0002', message = 'Private draft not found'; end if;
  select * into p from public.blog_effective_post(p_id);
  stamp := greatest(clock_timestamp(),p.updated_at + interval '1 microsecond',
    (select updated_at + interval '1 microsecond' from public.site_blog_approved_revisions where id=p_id));
  if h.post_id is not null and p.id is null then
    raise exception using errcode = '40001', message = 'Original public post was deleted';
  end if;
  if p_accept_live_change is null
    or p.updated_at is distinct from p_expected_public_version
    or (p.updated_at is distinct from h.base_public_version and not p_accept_live_change) then
    raise exception using errcode = '40001', message = 'Public version conflict; reload and explicitly acknowledge';
  end if;
  s := h.snapshot;
  due := coalesce((s->>'published_at')::timestamptz,now());
  if char_length(btrim(s->>'title')) not between 1 and 160
    or char_length(btrim(s->>'excerpt')) not between 1 and 500
    or (s->>'slug') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(s->>'slug') not between 3 and 100
    or (char_length(s->>'body_markdown') = 0 and s->'body_rich' = 'null'::jsonb) then
    raise exception using errcode = '22023', message = 'Incomplete publication';
  end if;
  if exists (select 1 from public.site_blog_posts where slug = s->>'slug' and id <> p_id)
    or exists (select 1 from public.site_blog_approved_revisions where slug = s->>'slug' and id <> p_id) then
    raise exception using errcode = '23505', message = 'Blog slug reserved by another post';
  end if;
  s := s || jsonb_build_object('published_at',due);
  if p.published and p.published_at <= now() and due > now() then
    -- Materialize any previous due snapshot before replacing its reservation.
    update public.site_blog_posts set slug = p.slug,title = p.title,excerpt = p.excerpt,
      body_markdown = p.body_markdown,body_rich = p.body_rich,published_at = p.published_at,
      updated_at = p.updated_at where id = p_id;
    insert into public.site_blog_approved_revisions
      (id,slug,title,excerpt,body_markdown,body_rich,published,published_at,created_at,updated_at)
      values (p_id,s->>'slug',s->>'title',s->>'excerpt',s->>'body_markdown',nullif(s->'body_rich','null'::jsonb),
        true,due,p.created_at,stamp)
      on conflict (id) do update set slug=excluded.slug,title=excluded.title,excerpt=excluded.excerpt,
        body_markdown=excluded.body_markdown,body_rich=excluded.body_rich,published_at=excluded.published_at,
        updated_at=excluded.updated_at;
    effective_version := p.updated_at;
  else
    insert into public.site_blog_posts(id,slug,title,excerpt,body_markdown,body_rich,published,published_at,updated_at)
      values (p_id,s->>'slug',s->>'title',s->>'excerpt',s->>'body_markdown',nullif(s->'body_rich','null'::jsonb),
        true,due,stamp)
      on conflict (id) do update set slug=excluded.slug,title=excluded.title,excerpt=excluded.excerpt,
        body_markdown=excluded.body_markdown,body_rich=excluded.body_rich,published=true,
        published_at=excluded.published_at,updated_at=excluded.updated_at;
    delete from public.site_blog_approved_revisions where id = p_id;
    effective_version := stamp;
  end if;
  update public.site_blog_drafts set post_id=p_id,snapshot=s,base_public_version=effective_version,
    version=gen_random_uuid(),revision=revision+1,updated_at=stamp where id=p_id;
  perform public.blog_draft_checkpoint(p_id,'publish',true);
  return public.blog_draft_receipt(p_id,p_request_id,request);
end;
$$;

create function public.list_blog_draft_history(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  perform public.blog_editor_authorize();
  perform public.blog_draft_state(p_id);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,
    'created_at',created_at,'reason',reason,'title',snapshot->>'title') order by revision desc),'[]'::jsonb)
    from (select * from public.site_blog_draft_history where draft_id=p_id order by revision desc limit 100) h);
end;
$$;

create function public.get_blog_draft_revision(p_id uuid,p_revision_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare result jsonb;
begin
  perform public.blog_editor_authorize();
  select jsonb_build_object('id',id,'revision',revision,'created_at',created_at,'reason',reason,
    'title',snapshot->>'title','snapshot',snapshot) into result
    from public.site_blog_draft_history where draft_id=p_id and id=p_revision_id;
  if result is null then raise exception using errcode='P0002',message='Draft checkpoint not found'; end if;
  return result;
end;
$$;

create function public.restore_blog_draft_revision(p_id uuid,p_revision_id uuid,p_expected_version uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  request jsonb := jsonb_build_object('op','restore','revision_id',p_revision_id,'expected',p_expected_version);
  retry jsonb;
  s jsonb;
begin
  perform public.blog_editor_authorize();
  perform public.blog_editor_lock();
  retry := public.blog_draft_retry(p_id,p_expected_version,p_request_id,request);
  if retry is not null then return retry; end if;
  select snapshot into s from public.site_blog_draft_history where draft_id=p_id and id=p_revision_id;
  if s is null then raise exception using errcode='P0002',message='Draft checkpoint not found'; end if;
  update public.site_blog_drafts set snapshot=s,version=gen_random_uuid(),revision=revision+1,
    updated_at=clock_timestamp() where id=p_id;
  perform public.blog_draft_checkpoint(p_id,'restore',true);
  return public.blog_draft_receipt(p_id,p_request_id,request);
end;
$$;

create function public.cancel_blog_draft_schedule(p_id uuid,p_expected_version uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  request jsonb := jsonb_build_object('op','cancel','expected',p_expected_version);
  retry jsonb;
  old_public_version timestamptz;
  changed integer;
begin
  perform public.blog_editor_authorize();
  perform public.blog_editor_lock();
  retry := public.blog_draft_retry(p_id,p_expected_version,p_request_id,request);
  if retry is not null then return retry; end if;
  perform public.blog_ensure_public_head(p_id);
  select updated_at into old_public_version from public.blog_effective_post(p_id);
  delete from public.site_blog_approved_revisions where id=p_id and published_at > now();
  update public.site_blog_posts set published=false,updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond')
    where id=p_id and published and published_at > now();
  get diagnostics changed = row_count;
  update public.site_blog_drafts set version=gen_random_uuid(),revision=revision+1,
    updated_at=clock_timestamp(),base_public_version=case
      when changed > 0 and base_public_version is not distinct from old_public_version
      then (select updated_at from public.blog_effective_post(p_id)) else base_public_version end
    where id=p_id;
  return public.blog_draft_receipt(p_id,p_request_id,request);
end;
$$;

create function public.unpublish_blog_draft(p_id uuid,p_expected_version uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  request jsonb := jsonb_build_object('op','unpublish','expected',p_expected_version);
  retry jsonb;
  p public.site_blog_posts%rowtype;
  stamp timestamptz := clock_timestamp();
begin
  perform public.blog_editor_authorize();
  perform public.blog_editor_lock();
  retry := public.blog_draft_retry(p_id,p_expected_version,p_request_id,request);
  if retry is not null then return retry; end if;
  perform public.blog_ensure_public_head(p_id);
  select * into p from public.blog_effective_post(p_id);
  if p.id is null then raise exception using errcode='22023',message='Draft has no public post'; end if;
  stamp := greatest(clock_timestamp(),p.updated_at + interval '1 microsecond',
    (select updated_at + interval '1 microsecond' from public.site_blog_approved_revisions where id=p_id));
  update public.site_blog_posts set slug=p.slug,title=p.title,excerpt=p.excerpt,
    body_markdown=p.body_markdown,body_rich=p.body_rich,published_at=p.published_at,
    published=false,updated_at=stamp where id=p_id;
  delete from public.site_blog_approved_revisions where id=p_id;
  update public.site_blog_drafts set base_public_version=stamp,version=gen_random_uuid(),
    revision=revision+1,updated_at=stamp where id=p_id;
  return public.blog_draft_receipt(p_id,p_request_id,request);
end;
$$;

create function public.delete_blog_draft(p_id uuid,p_expected_version uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare h public.site_blog_drafts%rowtype;
begin
  perform public.blog_editor_authorize();
  perform public.blog_editor_lock();
  select * into h from public.site_blog_drafts where id=p_id for update;
  if h.id is null then raise exception using errcode='P0002',message='Private draft not found'; end if;
  if h.version is distinct from p_expected_version then
    raise exception using errcode='40001',message='Draft version conflict';
  end if;
  if h.post_id is not null then raise exception using errcode='22023',message='Use explicit public-post deletion'; end if;
  delete from public.site_blog_drafts where id=p_id;
end;
$$;

create function public.list_blog_editor_entries()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  perform public.blog_editor_authorize();
  return (select coalesce(jsonb_agg(public.blog_draft_state(id)||jsonb_build_object('id',id) order by id),'[]'::jsonb)
    from (select id from public.site_blog_posts union select id from public.site_blog_drafts) ids);
end;
$$;

-- Helpers are owner-only; callable RPCs have both an auth-only grant and a guard.
revoke all on function public.blog_snapshot_valid(jsonb),public.blog_editor_authorize(),
  public.blog_post_snapshot(public.site_blog_posts),public.blog_effective_post(uuid),
  public.blog_draft_state(uuid),public.blog_editor_lock(),public.blog_draft_retry(uuid,uuid,uuid,jsonb),
  public.blog_draft_checkpoint(uuid,text,boolean),public.blog_draft_receipt(uuid,uuid,jsonb),
  public.blog_ensure_public_head(uuid)
  from public,anon,authenticated;
revoke all on function public.load_blog_draft(uuid),
  public.save_blog_draft(uuid,uuid,timestamptz,jsonb,uuid,boolean),
  public.publish_blog_draft(uuid,uuid,uuid,timestamptz,boolean),
  public.list_blog_draft_history(uuid),public.get_blog_draft_revision(uuid,uuid),
  public.restore_blog_draft_revision(uuid,uuid,uuid,uuid),
  public.cancel_blog_draft_schedule(uuid,uuid,uuid),public.unpublish_blog_draft(uuid,uuid,uuid),
  public.delete_blog_draft(uuid,uuid),
  public.list_blog_editor_entries() from public,anon,authenticated;
grant execute on function public.load_blog_draft(uuid),
  public.save_blog_draft(uuid,uuid,timestamptz,jsonb,uuid,boolean),
  public.publish_blog_draft(uuid,uuid,uuid,timestamptz,boolean),
  public.list_blog_draft_history(uuid),public.get_blog_draft_revision(uuid,uuid),
  public.restore_blog_draft_revision(uuid,uuid,uuid,uuid),
  public.cancel_blog_draft_schedule(uuid,uuid,uuid),public.unpublish_blog_draft(uuid,uuid,uuid),
  public.delete_blog_draft(uuid,uuid),
  public.list_blog_editor_entries() to authenticated;

create or replace function public.content_backup_tables()
returns text[] language sql immutable set search_path = pg_catalog as $$
  select array[
    'pronoun_profiles','site_blog_approved_revisions','site_blog_draft_history','site_blog_drafts',
    'site_blog_posts','site_changelog','site_creators','site_favorite_games',
    'site_featured_project','site_hardware','site_hardware_machine_order','site_message_catalog',
    'site_message_pools','site_message_settings','site_now','site_resume_certifications',
    'site_resume_education','site_resume_entries','site_resume_profile','site_resume_skills',
    'site_social_links','spotify_featured_playlists','spotify_featured_tracks'
  ]::text[];
$$;

create or replace function public.restore_site_content(p_backup jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  table_name text;
  row_data jsonb;
  columns text[];
  assignments text;
  rows_count integer := 0;
  affected_rows integer;
  actual_keys text[];
  expected_tables text[] := public.content_backup_tables();
  singletons text[] := array['pronoun_profiles','site_now','site_resume_profile','site_message_settings'];
  insertion_order text[];
begin
  perform public.blog_editor_authorize();
  if p_backup is null or jsonb_typeof(p_backup) <> 'object'
    or octet_length(p_backup::text) > 10485760
    or p_backup->>'format' is distinct from 'shortbits-content'
    or p_backup->'version' is distinct from '1'::jsonb
    or jsonb_typeof(p_backup->'tables') is distinct from 'object'
    then raise exception 'Invalid content backup format or version.'; end if;
  select array_agg(key order by key) into actual_keys from jsonb_object_keys(p_backup) key;
  if actual_keys is distinct from array['exportedAt','format','tables','version'] then
    raise exception 'Unexpected content backup fields.'; end if;
  select array_agg(key order by key) into actual_keys from jsonb_object_keys(p_backup->'tables') key;
  if actual_keys is distinct from expected_tables then
    raise exception 'The backup must contain exactly the supported content tables.'; end if;
  perform public.blog_editor_lock();
  foreach table_name in array expected_tables loop
    if jsonb_typeof(p_backup->'tables'->table_name) is distinct from 'array' then
      raise exception 'Invalid rows for %.',table_name; end if;
    rows_count := rows_count + jsonb_array_length(p_backup->'tables'->table_name);
    if rows_count > 10000 then raise exception 'Backup exceeds 10000 rows.'; end if;
    if table_name = any(singletons) and (jsonb_array_length(p_backup->'tables'->table_name) <> 1
      or p_backup->'tables'->table_name->0->>'id' is distinct from 'primary') then
      raise exception 'Invalid singleton content for %.',table_name; end if;
    select array_agg(a.attname::text order by a.attname) into columns from pg_catalog.pg_attribute a
      where a.attrelid=format('public.%I',table_name)::regclass and a.attnum>0 and not a.attisdropped;
    for row_data in select value from jsonb_array_elements(p_backup->'tables'->table_name) loop
      if jsonb_typeof(row_data) <> 'object' then raise exception 'Invalid row for %.',table_name; end if;
      select array_agg(key order by key) into actual_keys from jsonb_object_keys(row_data) key;
      if actual_keys is distinct from columns then
        raise exception 'Backup schema does not match %. Export a backup from the current version.',table_name; end if;
    end loop;
    execute format('lock table public.%I in share row exclusive mode',table_name);
  end loop;
  -- Delete every child before its parent, then restore parents before children.
  insertion_order := array['site_blog_posts','site_blog_drafts','site_blog_draft_history',
    'site_blog_approved_revisions','site_message_pools','site_message_catalog']
    || array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(
      expected_tables,'site_blog_posts'),'site_blog_drafts'),'site_blog_draft_history'),
      'site_blog_approved_revisions'),'site_message_pools'),'site_message_catalog');
  for affected_rows in reverse cardinality(insertion_order)..1 loop
    table_name := insertion_order[affected_rows];
    if not table_name = any(singletons) then execute format('delete from public.%I',table_name); end if;
  end loop;
  foreach table_name in array insertion_order loop
    if table_name = any(singletons) then
      select string_agg(format('%1$I = restored.%1$I',a.attname),', ' order by a.attnum)
        into assignments from pg_catalog.pg_attribute a
        where a.attrelid=format('public.%I',table_name)::regclass and a.attnum>0 and not a.attisdropped and a.attname<>'id';
      execute format('update public.%1$I target set %2$s from jsonb_populate_record(null::public.%1$I,$1) restored where target.id=''primary''',
        table_name,assignments) using p_backup->'tables'->table_name->0;
      get diagnostics affected_rows = row_count;
      if affected_rows <> 1 then raise exception 'Primary content row is missing from %.',table_name; end if;
    else
      execute format('insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I,$1)',table_name)
        using p_backup->'tables'->table_name;
    end if;
  end loop;
  if exists (select 1 from public.site_blog_draft_history group by draft_id having count(*) > 100) then
    raise exception 'Backup exceeds 100 checkpoints per draft.'; end if;
  if exists (select 1 from public.site_blog_draft_history h join public.site_blog_drafts d
    on d.id=h.draft_id where h.revision>d.revision) then
    raise exception 'Backup checkpoint revision exceeds its draft head.'; end if;
  if exists (select 1 from public.site_blog_approved_revisions a join public.site_blog_posts p
    on p.slug=a.slug and p.id<>a.id) then raise exception 'Backup contains conflicting reserved blog slugs.'; end if;
  update public.site_blog_drafts set version=gen_random_uuid(),last_request_id=null,last_request=null,last_receipt=null;
  return jsonb_build_object('tables',cardinality(expected_tables),'rows',rows_count);
end;
$$;
revoke all on function public.restore_site_content(jsonb) from public,anon,authenticated;
grant execute on function public.restore_site_content(jsonb) to authenticated;
