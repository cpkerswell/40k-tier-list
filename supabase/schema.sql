-- 40K Tier List schema
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

create table if not exists factions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  faction_type text not null check (faction_type in ('Imperium', 'Chaos', 'Xenos')),
  elo_rating double precision not null default 1500,
  games_played integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid not null references factions (id) on delete cascade,
  loser_id uuid not null references factions (id) on delete cascade,
  winner_elo_before double precision not null,
  loser_elo_before double precision not null,
  winner_elo_after double precision not null,
  loser_elo_after double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists votes_winner_id_idx on votes (winner_id);
create index if not exists votes_loser_id_idx on votes (loser_id);

-- Records a single head-to-head vote and updates both factions' Elo atomically.
-- Runs as SECURITY DEFINER so the anon key never needs direct UPDATE access to
-- factions/votes -- all rating math happens here, server-side, in one place.
create or replace function record_vote(p_winner_id uuid, p_loser_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  winner_elo double precision;
  loser_elo double precision;
  winner_games integer;
  loser_games integer;
  k_winner double precision;
  k_loser double precision;
  expected_winner double precision;
  expected_loser double precision;
  new_winner_elo double precision;
  new_loser_elo double precision;
begin
  if p_winner_id = p_loser_id then
    raise exception 'winner and loser must be different factions';
  end if;

  select elo_rating, games_played into winner_elo, winner_games
  from factions where id = p_winner_id for update;

  select elo_rating, games_played into loser_elo, loser_games
  from factions where id = p_loser_id for update;

  if winner_elo is null or loser_elo is null then
    raise exception 'faction not found';
  end if;

  -- Higher K-factor while a faction still has few votes, so early opinions
  -- move its rating faster; settles down once it has enough games logged.
  k_winner := case when winner_games < 30 then 40 else 20 end;
  k_loser := case when loser_games < 30 then 40 else 20 end;

  expected_winner := 1.0 / (1.0 + power(10.0, (loser_elo - winner_elo) / 400.0));
  expected_loser := 1.0 / (1.0 + power(10.0, (winner_elo - loser_elo) / 400.0));

  new_winner_elo := winner_elo + k_winner * (1 - expected_winner);
  new_loser_elo := loser_elo + k_loser * (0 - expected_loser);

  update factions set elo_rating = new_winner_elo, games_played = games_played + 1
  where id = p_winner_id;

  update factions set elo_rating = new_loser_elo, games_played = games_played + 1
  where id = p_loser_id;

  insert into votes (winner_id, loser_id, winner_elo_before, loser_elo_before, winner_elo_after, loser_elo_after)
  values (p_winner_id, p_loser_id, winner_elo, loser_elo, new_winner_elo, new_loser_elo);
end;
$$;

alter table factions enable row level security;
alter table votes enable row level security;

-- Anyone can read the current standings and vote history.
create policy "Public can read factions" on factions for select using (true);
create policy "Public can read votes" on votes for select using (true);

-- No insert/update/delete policies are defined for factions or votes, so the
-- anon key cannot write to either table directly via the REST API. The only
-- way to change a rating is through record_vote(), which is exposed below.
grant execute on function record_vote(uuid, uuid) to anon;
