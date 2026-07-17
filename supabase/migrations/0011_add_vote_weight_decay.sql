-- Softens the effect of a single voter repeatedly making the same faction
-- win (or the same faction lose) in a short burst -- whether that's
-- deliberate vote-spamming or just enthusiastically running a favourite
-- through the "champion" gauntlet, either way one voter's opinion shouldn't
-- be able to dominate a shared, crowd-sourced ranking. Rather than trying to
-- detect and retroactively delete votes (which would require replaying a
-- group's entire Elo history, since ratings update incrementally), the
-- K-factor for each side is divided by (1 + how many of that voter's own
-- last 10 votes in this group already had this exact faction winning /
-- losing). No new columns -- this only needed voter_name, which the client
-- now always populates (auto-generating a random name if none is chosen).

drop function if exists record_vote(uuid, uuid, text, text, text, text);

create or replace function record_vote(
  p_winner_id uuid,
  p_loser_id uuid,
  p_voter_name text default null,
  p_group_slug text default 'default',
  p_winner_disposition text default null,
  p_loser_disposition text default null
)
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

  d_winner_elo double precision;
  d_winner_games integer;
  d_loser_elo double precision;
  d_loser_games integer;

  recent_winner_wins integer := 0;
  recent_loser_losses integer := 0;
  winner_decay double precision;
  loser_decay double precision;
begin
  if p_winner_id = p_loser_id then
    raise exception 'winner and loser must be different factions';
  end if;

  if p_voter_name is not null then
    select count(*) into recent_winner_wins
    from (
      select winner_id
      from votes
      where group_slug = p_group_slug and voter_name = p_voter_name
      order by created_at desc
      limit 10
    ) recent
    where recent.winner_id = p_winner_id;

    select count(*) into recent_loser_losses
    from (
      select loser_id
      from votes
      where group_slug = p_group_slug and voter_name = p_voter_name
      order by created_at desc
      limit 10
    ) recent
    where recent.loser_id = p_loser_id;
  end if;

  winner_decay := 1.0 / (1.0 + recent_winner_wins);
  loser_decay := 1.0 / (1.0 + recent_loser_losses);

  -- Whole-faction rating.
  insert into group_ratings (group_slug, faction_id)
    values (p_group_slug, p_winner_id), (p_group_slug, p_loser_id)
  on conflict (group_slug, faction_id) do nothing;

  select elo_rating, games_played into winner_elo, winner_games
  from group_ratings where group_slug = p_group_slug and faction_id = p_winner_id for update;

  select elo_rating, games_played into loser_elo, loser_games
  from group_ratings where group_slug = p_group_slug and faction_id = p_loser_id for update;

  if winner_elo is null or loser_elo is null then
    raise exception 'faction not found';
  end if;

  k_winner := (case when winner_games < 30 then 40 else 20 end) * winner_decay;
  k_loser := (case when loser_games < 30 then 40 else 20 end) * loser_decay;

  expected_winner := 1.0 / (1.0 + power(10.0, (loser_elo - winner_elo) / 400.0));
  expected_loser := 1.0 / (1.0 + power(10.0, (winner_elo - loser_elo) / 400.0));

  new_winner_elo := winner_elo + k_winner * (1 - expected_winner);
  new_loser_elo := loser_elo + k_loser * (0 - expected_loser);

  update group_ratings set elo_rating = new_winner_elo, games_played = games_played + 1
  where group_slug = p_group_slug and faction_id = p_winner_id;

  update group_ratings set elo_rating = new_loser_elo, games_played = games_played + 1
  where group_slug = p_group_slug and faction_id = p_loser_id;

  -- Disposition-scoped rating: same decay applied, on top of the usual
  -- "only touched for sides that were tagged" behavior.
  if p_winner_disposition is not null then
    insert into group_disposition_ratings (group_slug, faction_id, disposition)
      values (p_group_slug, p_winner_id, p_winner_disposition)
    on conflict (group_slug, faction_id, disposition) do nothing;

    select elo_rating, games_played into d_winner_elo, d_winner_games
    from group_disposition_ratings
    where group_slug = p_group_slug and faction_id = p_winner_id and disposition = p_winner_disposition
    for update;
  end if;

  if p_loser_disposition is not null then
    insert into group_disposition_ratings (group_slug, faction_id, disposition)
      values (p_group_slug, p_loser_id, p_loser_disposition)
    on conflict (group_slug, faction_id, disposition) do nothing;

    select elo_rating, games_played into d_loser_elo, d_loser_games
    from group_disposition_ratings
    where group_slug = p_group_slug and faction_id = p_loser_id and disposition = p_loser_disposition
    for update;
  end if;

  if p_winner_disposition is not null and p_loser_disposition is not null then
    update group_disposition_ratings
    set
      elo_rating = d_winner_elo + ((case when d_winner_games < 30 then 40 else 20 end) * winner_decay)
        * (1 - (1.0 / (1.0 + power(10.0, (d_loser_elo - d_winner_elo) / 400.0)))),
      games_played = games_played + 1
    where group_slug = p_group_slug and faction_id = p_winner_id and disposition = p_winner_disposition;

    update group_disposition_ratings
    set
      elo_rating = d_loser_elo + ((case when d_loser_games < 30 then 40 else 20 end) * loser_decay)
        * (0 - (1.0 / (1.0 + power(10.0, (d_winner_elo - d_loser_elo) / 400.0)))),
      games_played = games_played + 1
    where group_slug = p_group_slug and faction_id = p_loser_id and disposition = p_loser_disposition;
  elsif p_winner_disposition is not null then
    update group_disposition_ratings
    set
      elo_rating = d_winner_elo + ((case when d_winner_games < 30 then 40 else 20 end) * winner_decay)
        * (1 - (1.0 / (1.0 + power(10.0, (loser_elo - d_winner_elo) / 400.0)))),
      games_played = games_played + 1
    where group_slug = p_group_slug and faction_id = p_winner_id and disposition = p_winner_disposition;
  elsif p_loser_disposition is not null then
    update group_disposition_ratings
    set
      elo_rating = d_loser_elo + ((case when d_loser_games < 30 then 40 else 20 end) * loser_decay)
        * (0 - (1.0 / (1.0 + power(10.0, (winner_elo - d_loser_elo) / 400.0)))),
      games_played = games_played + 1
    where group_slug = p_group_slug and faction_id = p_loser_id and disposition = p_loser_disposition;
  end if;

  insert into votes (
    winner_id, loser_id, winner_elo_before, loser_elo_before,
    winner_elo_after, loser_elo_after, voter_name, group_slug,
    winner_disposition, loser_disposition
  )
  values (
    p_winner_id, p_loser_id, winner_elo, loser_elo,
    new_winner_elo, new_loser_elo, nullif(trim(p_voter_name), ''), p_group_slug,
    p_winner_disposition, p_loser_disposition
  );
end;
$$;

grant execute on function record_vote(uuid, uuid, text, text, text, text) to anon;
