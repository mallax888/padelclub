-- ============================================================
--  Tournament formats: fixed-pair round robin, single elimination,
--  groups then knockout (and room for the next formats).
--  Run this in: Supabase Dashboard → SQL Editor → New query
--  Safe to run more than once.
-- ============================================================

-- The formats a tournament can use (the phase 2 ones are listed now so this only needs running once).
alter table public.tournaments drop constraint if exists tournaments_format_check;
alter table public.tournaments add constraint tournaments_format_check
  check (format in (
    'americano', 'mexicano', 'team_americano', 'king_of_court',
    'fixed_round_robin', 'single_elim', 'double_elim', 'groups_knockout', 'swiss'
  ));

-- Per-format choices: group size, how many go through, third-place match, and so on.
alter table public.tournaments add column if not exists settings jsonb not null default '{}'::jsonb;

-- Pair formats: two entries in tournament_players share a pair_no and are one team.
alter table public.tournament_players add column if not exists pair_no integer;
alter table public.tournament_players add column if not exists team_name text;
alter table public.tournament_players add column if not exists group_label text;
alter table public.tournament_players add column if not exists seed integer;

-- Where a match sits: a plain round, a group game, a knockout match or the third-place match.
alter table public.tournament_matches add column if not exists stage text not null default 'round';
alter table public.tournament_matches drop constraint if exists tournament_matches_stage_check;
alter table public.tournament_matches add constraint tournament_matches_stage_check
  check (stage in ('round', 'group', 'ko', 'third_place'));
alter table public.tournament_matches add column if not exists label text;
alter table public.tournament_matches add column if not exists match_number integer;
alter table public.tournament_matches add column if not exists group_label text;
alter table public.tournament_matches add column if not exists wave integer not null default 1;

-- A round can only be created once, even if two people press the button together.
create unique index if not exists tournament_matches_slot_uidx
  on public.tournament_matches (tournament_id, round_number, match_number)
  where match_number is not null;
