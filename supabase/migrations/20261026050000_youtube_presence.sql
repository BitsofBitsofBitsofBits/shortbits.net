create table public.youtube_presence_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table public.media_sessions (
  provider text primary key check (provider in ('spotify', 'youtube')),
  started_at timestamptz not null,
  last_seen_at timestamptz not null
);

create table public.youtube_presence (
  singleton boolean primary key default true check (singleton),
  device_id uuid not null references public.youtube_presence_devices(id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (char_length(title) between 1 and 300),
  channel text not null check (char_length(channel) between 1 and 200),
  is_playing boolean not null,
  progress_ms integer not null check (progress_ms >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  updated_at timestamptz not null,
  expires_at timestamptz not null
);

alter table public.youtube_presence_devices enable row level security;
alter table public.media_sessions enable row level security;
alter table public.youtube_presence enable row level security;
revoke all on public.youtube_presence_devices, public.media_sessions, public.youtube_presence from anon, authenticated;

-- Mint in the SQL editor; the raw token is returned once and never stored.
create function public.create_youtube_presence_device(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_token text := 'sbyt_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id uuid;
begin
  insert into public.youtube_presence_devices(name, token_hash)
  values (btrim(p_name), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;
revoke all on function public.create_youtube_presence_device(text) from public, anon, authenticated;
grant execute on function public.create_youtube_presence_device(text) to service_role;

create function public.observe_spotify_session(p_active boolean)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_started timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('public.media_sessions.spotify'));
  if not p_active then
    delete from public.media_sessions where provider = 'spotify';
    return null;
  end if;
  insert into public.media_sessions as session(provider, started_at, last_seen_at)
  values ('spotify', now(), now())
  on conflict (provider) do update
  set started_at = case when session.last_seen_at < now() - interval '90 seconds'
    then now() else session.started_at end, last_seen_at = now()
  returning started_at into v_started;
  return v_started;
end;
$$;
revoke all on function public.observe_spotify_session(boolean) from public, anon, authenticated;
grant execute on function public.observe_spotify_session(boolean) to service_role;

create function public.report_youtube_presence(p_token_hash text, p_item jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_device uuid;
begin
  perform pg_advisory_xact_lock(hashtext('public.media_sessions.youtube'));
  select id into v_device from public.youtube_presence_devices where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;
  update public.youtube_presence_devices set last_seen_at = now() where id = v_device;
  if p_item is null or p_item = 'null'::jsonb then
    delete from public.youtube_presence where device_id = v_device;
    if found then delete from public.media_sessions where provider = 'youtube'; end if;
    return jsonb_build_object('ok', true);
  end if;

  insert into public.media_sessions as session(provider, started_at, last_seen_at)
  values ('youtube', now(), now())
  on conflict (provider) do update
  set started_at = case when session.last_seen_at < now() - interval '90 seconds'
    then now() else session.started_at end, last_seen_at = now();

  insert into public.youtube_presence(singleton, device_id, video_id, title, channel, is_playing,
    progress_ms, duration_ms, updated_at, expires_at)
  values (true, v_device, p_item->>'videoId', p_item->>'title', p_item->>'channel',
    (p_item->>'isPlaying')::boolean, (p_item->>'progressMs')::integer,
    (p_item->>'durationMs')::integer, now(), now() + interval '90 seconds')
  on conflict (singleton) do update set device_id = excluded.device_id, video_id = excluded.video_id,
    title = excluded.title, channel = excluded.channel, is_playing = excluded.is_playing,
    progress_ms = excluded.progress_ms, duration_ms = excluded.duration_ms,
    updated_at = excluded.updated_at, expires_at = excluded.expires_at;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.report_youtube_presence(text, jsonb) from public, anon, authenticated;
grant execute on function public.report_youtube_presence(text, jsonb) to service_role;

create function public.read_youtube_presence()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'item', jsonb_build_object('videoId', presence.video_id, 'title', presence.title,
        'channel', presence.channel, 'durationMs', presence.duration_ms),
      'isPlaying', presence.is_playing, 'progressMs', presence.progress_ms,
      'updatedAt', presence.updated_at, 'expiresAt', presence.expires_at,
      'sessionStartedAt', session.started_at)
    from public.youtube_presence presence
    join public.media_sessions session on session.provider = 'youtube'
    where presence.expires_at > now()
  ), '{"item":null}'::jsonb);
$$;
revoke all on function public.read_youtube_presence() from public;
grant execute on function public.read_youtube_presence() to anon, authenticated, service_role;
