-- Run this once in the SQL Editor. Lets voters optionally attach a display
-- name to their vote (shown in the activity feed). Existing votes are
-- untouched and just have a null voter_name ("Someone" in the UI).

alter table votes add column if not exists voter_name text
  check (voter_name is null or char_length(voter_name) <= 40);

-- The 2-arg overload must be dropped before recreating record_vote with a
-- third parameter, otherwise Postgres keeps both overloads and a 2-arg call
-- from an older cached client would silently skip the voter_name write.
drop function if exists record_vote(uuid, uuid);

create or replace function record_vote(p_winner_id uuid, p_loser_id uuid, p_voter_name text default null)
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

  insert into votes (winner_id, loser_id, winner_elo_before, loser_elo_before, winner_elo_after, loser_elo_after, voter_name)
  values (p_winner_id, p_loser_id, winner_elo, loser_elo, new_winner_elo, new_loser_elo, nullif(trim(p_voter_name), ''));
end;
$$;

grant execute on function record_vote(uuid, uuid, text) to anon;
