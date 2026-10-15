create table if not exists public.arcade_settings (
  id text primary key check (id = 'global'),
  leaderboard_enabled boolean not null default true,
  score_submissions_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.arcade_settings (id)
values ('global')
on conflict (id) do nothing;

create table if not exists public.arcade_scores (
  id uuid primary key default gen_random_uuid(),
  game text not null check (
    game in (
      'snake',
      'minesweeper-beginner',
      'minesweeper-intermediate',
      'minesweeper-expert',
      'bitsweeper',
      'tetris',
      'solitaire',
      'minebits',
      'flappy'
    )
  ),
  player_name text not null default 'ANONYMOUS' check (
    char_length(player_name) between 1 and 24
    and player_name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{0,23}$'
  ),
  score integer not null check (score between 0 and 1000000),
  detail text not null default '' check (char_length(detail) <= 80),
  created_at timestamptz not null default now()
);

create index if not exists arcade_scores_game_ranking_idx
on public.arcade_scores (game, score desc, created_at asc);

alter table public.arcade_settings enable row level security;
alter table public.arcade_scores enable row level security;

create policy "Public can read Arcade settings"
on public.arcade_settings
for select
to anon, authenticated
using (true);

create policy "Authenticated users can update Arcade settings"
on public.arcade_settings
for update
to authenticated
using (true)
with check (id = 'global');

create policy "Public can read Arcade scores"
on public.arcade_scores
for select
to anon, authenticated
using (
  coalesce(
    (select leaderboard_enabled from public.arcade_settings where id = 'global'),
    false
  )
);

create policy "Public can submit Arcade scores"
on public.arcade_scores
for insert
to anon, authenticated
with check (
  coalesce(
    (select score_submissions_enabled from public.arcade_settings where id = 'global'),
    false
  )
  and game in (
    'snake',
    'minesweeper-beginner',
    'minesweeper-intermediate',
    'minesweeper-expert',
    'bitsweeper',
    'tetris',
    'solitaire',
    'minebits',
    'flappy'
  )
  and char_length(player_name) between 1 and 24
  and player_name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{0,23}$'
  and score between 0 and 1000000
  and char_length(detail) <= 80
);

create policy "Authenticated users can delete Arcade scores"
on public.arcade_scores
for delete
to authenticated
using (true);

revoke all on table public.arcade_settings from anon, authenticated;
revoke all on table public.arcade_scores from anon, authenticated;

grant select on table public.arcade_settings to anon, authenticated;
grant update (leaderboard_enabled, score_submissions_enabled, updated_at)
on table public.arcade_settings to authenticated;
grant select on table public.arcade_scores to anon, authenticated;
grant insert (game, player_name, score, detail)
on table public.arcade_scores to anon, authenticated;
grant delete on table public.arcade_scores to authenticated;
