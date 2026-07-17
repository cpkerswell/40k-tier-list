-- Adds support for isolated per-group voting pools (e.g. /groupA), so a
-- shared URL can give a specific set of players their own Elo/vote history
-- without affecting anyone else's. The existing (root-URL) data becomes the
-- implicit 'default' group.

-- 1. New group-scoped ratings table. Rows are created lazily (see
--    record_vote below) only for factions that have actually been voted on
--    within a given group; factions_for_group() defaults everything else.
create table if not exists group_ratings (
  group_slug text not null,
  faction_id uuid not null references factions (id) on delete cascade,
  elo_rating double precision not null default 1500,
  games_played integer not null default 0,
  primary key (group_slug, faction_id)
);

create index if not exists group_ratings_group_slug_idx on group_ratings (group_slug);

alter table group_ratings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'group_ratings' and policyname = 'Public can read group ratings'
  ) then
    create policy "Public can read group ratings" on group_ratings for select using (true);
  end if;
end $$;

-- 2. Carry over the existing global ratings as the 'default' group's ratings.
insert into group_ratings (group_slug, faction_id, elo_rating, games_played)
select 'default', id, elo_rating, games_played from factions
on conflict (group_slug, faction_id) do nothing;

-- 3. Tag existing (and future) votes with the group they belong to.
alter table votes add column if not exists group_slug text not null default 'default';
create index if not exists votes_group_slug_idx on votes (group_slug);

-- 4. Ratings now live in group_ratings, not directly on factions.
alter table factions drop column if exists elo_rating;
alter table factions drop column if exists games_played;

-- 5. Read helper: every faction plus its rating within one group, defaulting
--    unrated factions to 1500/0 rather than requiring a pre-seeded row.
create or replace function factions_for_group(p_group_slug text)
returns table (
  id uuid,
  name text,
  faction_type text,
  elo_rating double precision,
  games_played integer
)
language sql
stable
as $$
  select
    f.id,
    f.name,
    f.faction_type,
    coalesce(gr.elo_rating, 1500) as elo_rating,
    coalesce(gr.games_played, 0) as games_played
  from factions f
  left join group_ratings gr
    on gr.faction_id = f.id and gr.group_slug = p_group_slug
  order by coalesce(gr.elo_rating, 1500) desc;
$$;

grant execute on function factions_for_group(text) to anon;

-- 6. record_vote now reads/writes group_ratings for the given group_slug
--    (defaulting to 'default' for any client that hasn't updated yet), and
--    tags the inserted vote row with that group.
drop function if exists record_vote(uuid, uuid, text);

create or replace function record_vote(
  p_winner_id uuid,
  p_loser_id uuid,
  p_voter_name text default null,
  p_group_slug text default 'default'
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
begin
  if p_winner_id = p_loser_id then
    raise exception 'winner and loser must be different factions';
  end if;

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

  insert into votes (
    winner_id, loser_id, winner_elo_before, loser_elo_before,
    winner_elo_after, loser_elo_after, voter_name, group_slug
  )
  values (
    p_winner_id, p_loser_id, winner_elo, loser_elo,
    new_winner_elo, new_loser_elo, nullif(trim(p_voter_name), ''), p_group_slug
  );
end;
$$;

grant execute on function record_vote(uuid, uuid, text, text) to anon;
