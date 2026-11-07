create table public.jellyfin_presence (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null,
  state text not null check (state in ('playing', 'paused', 'idle', 'expired', 'unavailable')),
  item jsonb,
  updated_at timestamptz not null,
  expires_at timestamptz not null,
  check ((state in ('playing', 'paused')) = (item is not null))
);
alter table public.jellyfin_presence enable row level security;
revoke all on public.jellyfin_presence from public, anon, authenticated;

create function public.report_jellyfin_presence(p_user_id uuid, p_state text, p_item jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is null then raise exception 'Owner account is required'; end if;
  insert into public.jellyfin_presence(singleton, user_id, state, item, updated_at, expires_at)
  values (true, p_user_id, p_state, nullif(p_item, 'null'::jsonb), now(), now() + interval '90 seconds')
  on conflict (singleton) do update set user_id = excluded.user_id, state = excluded.state,
    item = excluded.item, updated_at = excluded.updated_at, expires_at = excluded.expires_at;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.report_jellyfin_presence(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.report_jellyfin_presence(uuid, text, jsonb) to service_role;

create function public.read_jellyfin_presence(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'state', case when expires_at <= now() then 'expired' else state end,
      'item', case when expires_at <= now() then null else item end,
      'updatedAt', updated_at, 'expiresAt', expires_at)
    from public.jellyfin_presence where user_id = p_user_id
  ), jsonb_build_object('state', 'idle', 'item', null, 'updatedAt', null, 'expiresAt', null));
$$;
revoke all on function public.read_jellyfin_presence(uuid) from public, anon, authenticated;
grant execute on function public.read_jellyfin_presence(uuid) to service_role;
