-- Adds Warhammer 40k 11th edition "Force Dispositions" as an optional layer
-- on top of the existing per-faction Elo. A vote can optionally tag either
-- side with a disposition (Take and Hold / Purge the Foe / Reconnaissance /
-- Disruption / Priority Assets); when it does, a *second*, disposition-scoped
-- Elo is updated alongside the faction's normal whole-faction rating (which
-- keeps updating on every vote regardless, so the aggregate view never needs
-- reconstructing). The tier list can then choose, per faction, to show one
-- unified row or split rows per disposition, based on how many distinct
-- dispositions actually have data.

create table if not exists group_disposition_ratings (
  group_slug text not null,
  faction_id uuid not null references factions (id) on delete cascade,
  disposition text not null check (disposition in (
    'Take and Hold', 'Purge the Foe', 'Reconnaissance', 'Disruption', 'Priority Assets'
  )),
  elo_rating double precision not null default 1500,
  games_played integer not null default 0,
  primary key (group_slug, faction_id, disposition)
);

create index if not exists group_disposition_ratings_lookup_idx
  on group_disposition_ratings (group_slug, faction_id);

alter table group_disposition_ratings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'group_disposition_ratings'
      and policyname = 'Public can read group disposition ratings'
  ) then
    create policy "Public can read group disposition ratings"
      on group_disposition_ratings for select using (true);
  end if;
end $$;

alter table votes add column if not exists winner_disposition text
  check (winner_disposition is null or winner_disposition in (
    'Take and Hold', 'Purge the Foe', 'Reconnaissance', 'Disruption', 'Priority Assets'
  ));
alter table votes add column if not exists loser_disposition text
  check (loser_disposition is null or loser_disposition in (
    'Take and Hold', 'Purge the Foe', 'Reconnaissance', 'Disruption', 'Priority Assets'
  ));

-- Read helper for the tier list's "By Disposition" view: only dispositions
-- that have actually accrued at least one vote, so factions with zero or one
-- distinct tagged disposition naturally fall back to a single unified row.
create or replace function disposition_ratings_for_group(p_group_slug text)
returns table (
  faction_id uuid,
  disposition text,
  elo_rating double precision,
  games_played integer
)
language sql
stable
as $$
  select faction_id, disposition, elo_rating, games_played
  from group_disposition_ratings
  where group_slug = p_group_slug and games_played > 0
  order by elo_rating desc;
$$;

grant execute on function disposition_ratings_for_group(text) to anon;

drop function if exists record_vote(uuid, uuid, text, text);

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
begin
  if p_winner_id = p_loser_id then
    raise exception 'winner and loser must be different factions';
  end if;

  -- Whole-faction rating: unchanged behavior, updates on every vote.
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

  k_winner := case when winner_games < 30 then 40 else 20 end;
  k_loser := case when loser_games < 30 then 40 else 20 end;

  expected_winner := 1.0 / (1.0 + power(10.0, (loser_elo - winner_elo) / 400.0));
  expected_loser := 1.0 / (1.0 + power(10.0, (winner_elo - loser_elo) / 400.0));

  new_winner_elo := winner_elo + k_winner * (1 - expected_winner);
  new_loser_elo := loser_elo + k_loser * (0 - expected_loser);

  update group_ratings set elo_rating = new_winner_elo, games_played = games_played + 1
  where group_slug = p_group_slug and faction_id = p_winner_id;

  update group_ratings set elo_rating = new_loser_elo, games_played = games_played + 1
  where group_slug = p_group_slug and faction_id = p_loser_id;

  -- Disposition-scoped rating: only touched for sides that were tagged.
  -- Whichever side lacks a tag is compared against using its whole-faction
  -- rating (winner_elo/loser_elo above), since it has no disposition-level
  -- rating of its own yet.
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
      elo_rating = d_winner_elo + (case when d_winner_games < 30 then 40 else 20 end)
        * (1 - (1.0 / (1.0 + power(10.0, (d_loser_elo - d_winner_elo) / 400.0)))),
      games_played = games_played + 1
    where group_slug = p_group_slug and faction_id = p_winner_id and disposition = p_winner_disposition;

    update group_disposition_ratings
    set
      elo_rating = d_loser_elo + (case when d_loser_games < 30 then 40 else 20 end)
        * (0 - (1.0 / (1.0 + power(10.0, (d_winner_elo - d_loser_elo) / 400.0)))),
      games_played = games_played + 1
    where group_slug = p_group_slug and faction_id = p_loser_id and disposition = p_loser_disposition;
  elsif p_winner_disposition is not null then
    update group_disposition_ratings
    set
      elo_rating = d_winner_elo + (case when d_winner_games < 30 then 40 else 20 end)
        * (1 - (1.0 / (1.0 + power(10.0, (loser_elo - d_winner_elo) / 400.0)))),
      games_played = games_played + 1
    where group_slug = p_group_slug and faction_id = p_winner_id and disposition = p_winner_disposition;
  elsif p_loser_disposition is not null then
    update group_disposition_ratings
    set
      elo_rating = d_loser_elo + (case when d_loser_games < 30 then 40 else 20 end)
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
