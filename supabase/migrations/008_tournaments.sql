-- ============================================================
--  Tournaments (Americano format)
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table public.tournaments (
  id              uuid default uuid_generate_v4() primary key,
  created_at      timestamptz default now() not null,
  name            text not null,
  venue_slug      text not null,
  date            date not null,
  format          text not null default 'americano' check (format in ('americano')),
  status          text not null default 'draft' check (status in ('draft','in_progress','completed')),
  court_ids       text[] not null default '{}',
  points_to_win   integer not null default 21 check (points_to_win > 0),
  total_rounds    integer not null default 8 check (total_rounds > 0),
  current_round   integer not null default 0,
  organizer_id    uuid references public.profiles(id) on delete set null,
  notes           text
);

create table public.tournament_players (
  id              uuid default uuid_generate_v4() primary key,
  created_at      timestamptz default now() not null,
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  player_id       uuid references public.profiles(id) on delete set null,
  guest_name      text,
  total_points    integer not null default 0,
  games_played    integer not null default 0,
  games_won       integer not null default 0,
  constraint player_or_guest check (player_id is not null or guest_name is not null)
);

create table public.tournament_matches (
  id                uuid default uuid_generate_v4() primary key,
  created_at        timestamptz default now() not null,
  tournament_id     uuid not null references public.tournaments(id) on delete cascade,
  round_number      integer not null,
  court_id          text not null,
  team1_player1_id  uuid not null references public.tournament_players(id) on delete cascade,
  team1_player2_id  uuid not null references public.tournament_players(id) on delete cascade,
  team2_player1_id  uuid not null references public.tournament_players(id) on delete cascade,
  team2_player2_id  uuid not null references public.tournament_players(id) on delete cascade,
  team1_score       integer,
  team2_score       integer,
  status            text not null default 'pending' check (status in ('pending','completed')),
  completed_at      timestamptz
);

create index tournament_players_tournament_id_idx on public.tournament_players(tournament_id);
create index tournament_matches_tournament_id_idx on public.tournament_matches(tournament_id);
create index tournament_matches_round_idx on public.tournament_matches(tournament_id, round_number);

-- Atomic point increment for one tournament_players row -- called once per
-- player in a completed match from the score-submission API route, mirrors
-- record_match_result's role for the global leaderboard (avoids a
-- read-then-write race if two matches somehow resolve for the same player
-- close together).
create or replace function public.increment_tournament_player_stats(
  p_tournament_player_id uuid,
  p_points integer,
  p_won boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.tournament_players
  set total_points = total_points + p_points,
      games_played = games_played + 1,
      games_won = games_won + case when p_won then 1 else 0 end
  where id = p_tournament_player_id;
end;
$$;

-- ============================================================
--  RLS
-- ============================================================
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_matches enable row level security;

-- Anyone logged in can see tournaments, the roster, and the matches --
-- this is club-wide info, same visibility as the leaderboard.
create policy "Tournaments are viewable by authenticated users"
  on public.tournaments for select
  using (auth.role() = 'authenticated');

create policy "Tournament players are viewable by authenticated users"
  on public.tournament_players for select
  using (auth.role() = 'authenticated');

create policy "Tournament matches are viewable by authenticated users"
  on public.tournament_matches for select
  using (auth.role() = 'authenticated');

-- Creating/managing a tournament (roster, rounds) is staff/admin only --
-- same convention as /admin.
create policy "Staff manage tournaments"
  on public.tournaments for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

create policy "Staff manage tournament players"
  on public.tournament_players for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

create policy "Staff manage tournament matches"
  on public.tournament_matches for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

-- A player in the match can also submit its score themselves (live score
-- entry) -- separate policy so this doesn't require staff.
create policy "Players can score their own tournament match"
  on public.tournament_matches for update
  using (
    exists (
      select 1 from public.tournament_players tp
      where tp.id in (team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id)
        and tp.player_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tournament_players tp
      where tp.id in (team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id)
        and tp.player_id = auth.uid()
    )
  );
