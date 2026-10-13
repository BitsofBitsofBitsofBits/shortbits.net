update public.arcade_scores
set game = 'minesweeper-beginner'
where game = 'minesweeper';

alter table public.arcade_scores
drop constraint arcade_scores_game_check;

alter table public.arcade_scores
add constraint arcade_scores_game_check
check (
  game in (
    'snake',
    'minesweeper-beginner',
    'minesweeper-intermediate',
    'minesweeper-expert',
    'bitsweeper',
    'tetris'
  )
);

drop policy "Public can submit Arcade scores"
on public.arcade_scores;

create policy "Public can submit Arcade scores"
on public.arcade_scores
for insert
to anon, authenticated
with check (
  game in (
    'snake',
    'minesweeper-beginner',
    'minesweeper-intermediate',
    'minesweeper-expert',
    'bitsweeper',
    'tetris'
  )
  and char_length(player_name) between 1 and 24
  and player_name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{0,23}$'
  and score between 0 and 1000000
  and char_length(detail) <= 80
);
