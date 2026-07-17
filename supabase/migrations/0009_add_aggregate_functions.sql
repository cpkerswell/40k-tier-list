-- Aggregate read helpers for the global (root, no-slug) page, which shows a
-- roundup of everyone's votes across ALL groups combined. Voting on root still
-- writes to the 'default' group (which is part of this aggregate); these
-- functions are read-only and just roll every group's ratings together.
--
-- Aggregation = games_played-weighted average Elo per faction across groups,
-- with total games summed. Weighting by games means heavily-voted groups
-- dominate and barely-voted ones (which sit near the 1500 start) contribute
-- little, so the combined number tracks overall sentiment. Factions with no
-- votes anywhere default to 1500/0.

create or replace function factions_aggregate()
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
    coalesce(
      sum(gr.elo_rating * gr.games_played) / nullif(sum(gr.games_played), 0),
      1500
    ) as elo_rating,
    coalesce(sum(gr.games_played), 0)::integer as games_played
  from factions f
  left join group_ratings gr on gr.faction_id = f.id
  group by f.id, f.name, f.faction_type
  order by elo_rating desc;
$$;

grant execute on function factions_aggregate() to anon;

create or replace function disposition_ratings_aggregate()
returns table (
  faction_id uuid,
  disposition text,
  elo_rating double precision,
  games_played integer
)
language sql
stable
as $$
  select
    faction_id,
    disposition,
    sum(elo_rating * games_played) / nullif(sum(games_played), 0) as elo_rating,
    sum(games_played)::integer as games_played
  from group_disposition_ratings
  group by faction_id, disposition
  having sum(games_played) > 0
  order by elo_rating desc;
$$;

grant execute on function disposition_ratings_aggregate() to anon;
