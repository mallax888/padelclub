-- ============================================================
--  Ladders — challenge-based club rankings
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table public.ladders (
  id                  uuid default uuid_generate_v4() primary key,
  created_at          timestamptz default now() not null,
  name                text not null,
  venue_slug          text,
  status              text not null default 'active' check (status in ('active', 'archived')),
  max_challenge_gap   integer not null default 3 check (max_challenge_gap > 0),
  organizer_id        uuid references public.profiles(id) on delete set null
);

create table public.ladder_entries (
  id            uuid default uuid_generate_v4() primary key,
  created_at    timestamptz default now() not null,
  ladder_id     uuid not null references public.ladders(id) on delete cascade,
  player_id     uuid not null references public.profiles(id) on delete cascade,
  position      integer not null,
  wins          integer not null default 0,
  losses        integer not null default 0,
  unique (ladder_id, player_id)
);

create index ladder_entries_ladder_idx on public.ladder_entries(ladder_id, position);

create table public.ladder_challenges (
  id                    uuid default uuid_generate_v4() primary key,
  created_at            timestamptz default now() not null,
  ladder_id             uuid not null references public.ladders(id) on delete cascade,
  challenger_entry_id   uuid not null references public.ladder_entries(id) on delete cascade,
  defender_entry_id     uuid not null references public.ladder_entries(id) on delete cascade,
  status                text not null default 'pending'
                          check (status in ('pending', 'accepted', 'declined', 'completed')),
  score                 text,
  winner_entry_id       uuid references public.ladder_entries(id) on delete set null,
  responded_at          timestamptz,
  completed_at          timestamptz,
  constraint different_entries check (challenger_entry_id <> defender_entry_id)
);

create index ladder_challenges_ladder_idx on public.ladder_challenges(ladder_id);

-- Only one outstanding (pending/accepted) challenge per challenger, and per
-- defender, at a time -- keeps the ladder simple, no challenge queues.
create unique index ladder_challenges_one_outgoing_idx on public.ladder_challenges(challenger_entry_id)
  where status in ('pending', 'accepted');
create unique index ladder_challenges_one_incoming_idx on public.ladder_challenges(defender_entry_id)
  where status in ('pending', 'accepted');

-- ============================================================
--  Functions
-- ============================================================

-- Adds the caller to the bottom of the ladder. Locks the ladder row first so
-- two players joining at the same moment can't both compute the same "next"
-- position.
create or replace function public.join_ladder(p_ladder_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_position integer;
  v_entry_id uuid;
begin
  perform 1 from public.ladders where id = p_ladder_id for update;

  select coalesce(max(position), 0) + 1 into v_next_position
  from public.ladder_entries where ladder_id = p_ladder_id;

  insert into public.ladder_entries (ladder_id, player_id, position)
  values (p_ladder_id, auth.uid(), v_next_position)
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

-- Challenges a player ranked above the caller, within the ladder's
-- max_challenge_gap. Runs as security definer so it can use auth.uid() to
-- identify the caller's own entry while still writing through RLS-protected
-- tables.
create or replace function public.create_ladder_challenge(p_defender_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenger public.ladder_entries%rowtype;
  v_defender public.ladder_entries%rowtype;
  v_ladder public.ladders%rowtype;
  v_challenge_id uuid;
begin
  select * into v_defender from public.ladder_entries where id = p_defender_entry_id;
  if v_defender is null then
    raise exception 'Player not found on this ladder';
  end if;

  select * into v_challenger from public.ladder_entries
    where ladder_id = v_defender.ladder_id and player_id = auth.uid();
  if v_challenger is null then
    raise exception 'You are not on this ladder';
  end if;

  select * into v_ladder from public.ladders where id = v_defender.ladder_id;

  if v_challenger.position <= v_defender.position then
    raise exception 'You can only challenge a player ranked above you';
  end if;
  if v_challenger.position - v_defender.position > v_ladder.max_challenge_gap then
    raise exception 'That player is too far above you to challenge';
  end if;

  insert into public.ladder_challenges (ladder_id, challenger_entry_id, defender_entry_id)
  values (v_defender.ladder_id, v_challenger.id, p_defender_entry_id)
  returning id into v_challenge_id;

  return v_challenge_id;
end;
$$;

-- Defender accepts or declines a pending challenge.
create or replace function public.respond_ladder_challenge(p_challenge_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.ladder_challenges%rowtype;
  v_defender public.ladder_entries%rowtype;
begin
  select * into v_challenge from public.ladder_challenges where id = p_challenge_id for update;
  if v_challenge is null or v_challenge.status <> 'pending' then
    raise exception 'Challenge is not pending';
  end if;

  select * into v_defender from public.ladder_entries where id = v_challenge.defender_entry_id;
  if v_defender.player_id is distinct from auth.uid() then
    raise exception 'Only the challenged player can respond';
  end if;

  update public.ladder_challenges
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_challenge_id;
end;
$$;

-- Either participant reports the result. If the challenger won, they leapfrog
-- the defender's ladder position; if the defender won, the ladder is
-- unchanged. Locks the challenge row so two simultaneous report attempts
-- can't both apply.
create or replace function public.report_ladder_challenge(
  p_challenge_id uuid,
  p_winner_entry_id uuid,
  p_score text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.ladder_challenges%rowtype;
  v_challenger public.ladder_entries%rowtype;
  v_defender public.ladder_entries%rowtype;
begin
  select * into v_challenge from public.ladder_challenges where id = p_challenge_id for update;
  if v_challenge is null or v_challenge.status <> 'accepted' then
    raise exception 'Challenge is not in a reportable state';
  end if;

  select * into v_challenger from public.ladder_entries where id = v_challenge.challenger_entry_id;
  select * into v_defender from public.ladder_entries where id = v_challenge.defender_entry_id;

  if auth.uid() is distinct from v_challenger.player_id and auth.uid() is distinct from v_defender.player_id then
    raise exception 'Only challenge participants can report a result';
  end if;
  if p_winner_entry_id <> v_challenge.challenger_entry_id and p_winner_entry_id <> v_challenge.defender_entry_id then
    raise exception 'Winner must be a challenge participant';
  end if;

  update public.ladder_challenges
  set status = 'completed', winner_entry_id = p_winner_entry_id, score = p_score, completed_at = now()
  where id = p_challenge_id;

  update public.ladder_entries
  set wins = wins + case when id = p_winner_entry_id then 1 else 0 end,
      losses = losses + case when id = p_winner_entry_id then 0 else 1 end
  where id in (v_challenge.challenger_entry_id, v_challenge.defender_entry_id);

  if p_winner_entry_id = v_challenge.challenger_entry_id then
    update public.ladder_entries set position = v_defender.position where id = v_challenger.id;
    update public.ladder_entries set position = v_challenger.position where id = v_defender.id;
  end if;
end;
$$;

-- ============================================================
--  RLS
-- ============================================================
alter table public.ladders enable row level security;
alter table public.ladder_entries enable row level security;
alter table public.ladder_challenges enable row level security;

-- Club-wide visibility, same convention as tournaments/leaderboard.
create policy "Ladders are viewable by authenticated users"
  on public.ladders for select
  using (auth.role() = 'authenticated');
create policy "Ladder entries are viewable by authenticated users"
  on public.ladder_entries for select
  using (auth.role() = 'authenticated');
create policy "Ladder challenges are viewable by authenticated users"
  on public.ladder_challenges for select
  using (auth.role() = 'authenticated');

-- Creating/archiving a ladder is staff/admin only. All entry/challenge
-- writes go through the security-definer functions above, so no direct
-- insert/update policies are needed on those two tables.
create policy "Staff manage ladders"
  on public.ladders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff', 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff', 'admin')));
