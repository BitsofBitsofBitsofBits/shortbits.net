alter table public.youtube_presence add column channel_avatar_url text
  check (channel_avatar_url is null or (char_length(channel_avatar_url) <= 2048
    and channel_avatar_url ~ '^https://(yt3[.]ggpht[.]com|yt3[.]googleusercontent[.]com)/[^[:space:]?#\\]+$'));

create or replace function public.report_youtube_presence(p_token_hash text, p_item jsonb, p_end_session boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_device uuid;
begin
  perform pg_advisory_xact_lock(hashtext('public.media_sessions.youtube'));
  select id into v_device from public.youtube_presence_devices where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;
  update public.youtube_presence_devices set last_seen_at = now() where id = v_device;
  if p_item is null or p_item = 'null'::jsonb then
    delete from public.youtube_presence where device_id = v_device;
    if p_end_session and not exists (select 1 from public.youtube_presence) then
      delete from public.media_sessions where provider = 'youtube';
    end if;
    return jsonb_build_object('ok', true);
  end if;

  insert into public.media_sessions as session(provider, started_at, last_seen_at)
  values ('youtube', now(), now())
  on conflict (provider) do update
  set started_at = case when session.last_seen_at < now() - interval '90 seconds'
    then now() else session.started_at end, last_seen_at = now();

  insert into public.youtube_presence(singleton, device_id, video_id, title, channel, channel_avatar_url, is_playing,
    progress_ms, duration_ms, updated_at, expires_at)
  values (true, v_device, p_item->>'videoId', p_item->>'title', p_item->>'channel', p_item->>'channelAvatarUrl',
    (p_item->>'isPlaying')::boolean, (p_item->>'progressMs')::integer,
    (p_item->>'durationMs')::integer, now(), now() + interval '90 seconds')
  on conflict (singleton) do update set device_id = excluded.device_id, video_id = excluded.video_id,
    title = excluded.title, channel = excluded.channel, channel_avatar_url = excluded.channel_avatar_url,
    is_playing = excluded.is_playing, progress_ms = excluded.progress_ms, duration_ms = excluded.duration_ms,
    updated_at = excluded.updated_at, expires_at = excluded.expires_at;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.report_youtube_presence(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.report_youtube_presence(text, jsonb, boolean) to service_role;

create or replace function public.read_youtube_presence()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'item', jsonb_build_object('videoId', presence.video_id, 'title', presence.title,
        'channel', presence.channel, 'channelAvatarUrl', presence.channel_avatar_url, 'durationMs', presence.duration_ms),
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
