-- 40K Tier List schema
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

create table if not exists factions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  faction_type text not null check (faction_type in ('Imperium', 'Chaos', 'Xenos')),
  created_at timestamptz not null default now()
);

-- Elo ratings are scoped per group (e.g. /groupA gets its own isolated
-- pool), not stored directly on factions. Rows are created lazily by
-- record_vote only for factions that have actually been voted on within a
-- given group; factions_for_group() below defaults everything else to
-- 1500/0 rather than requiring every faction to be pre-seeded per group.
create table if not exists group_ratings (
  group_slug text not null,
  faction_id uuid not null references factions (id) on delete cascade,
  elo_rating double precision not null default 1500,
  games_played integer not null default 0,
  primary key (group_slug, faction_id)
);

create index if not exists group_ratings_group_slug_idx on group_ratings (group_slug);

-- Optional disposition-scoped Elo, additive to group_ratings above. A vote
-- can tag either side with one of the five Force Dispositions (11th
-- edition); when it does, this table also gets updated so the tier list can
-- offer a "by disposition" breakdown alongside the whole-faction view.
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

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid not null references factions (id) on delete cascade,
  loser_id uuid not null references factions (id) on delete cascade,
  winner_elo_before double precision not null,
  loser_elo_before double precision not null,
  winner_elo_after double precision not null,
  loser_elo_after double precision not null,
  voter_name text check (voter_name is null or char_length(voter_name) <= 40),
  group_slug text not null default 'default',
  winner_disposition text check (winner_disposition is null or winner_disposition in (
    'Take and Hold', 'Purge the Foe', 'Reconnaissance', 'Disruption', 'Priority Assets'
  )),
  loser_disposition text check (loser_disposition is null or loser_disposition in (
    'Take and Hold', 'Purge the Foe', 'Reconnaissance', 'Disruption', 'Priority Assets'
  )),
  created_at timestamptz not null default now()
);

create index if not exists votes_winner_id_idx on votes (winner_id);
create index if not exists votes_loser_id_idx on votes (loser_id);
create index if not exists votes_group_slug_idx on votes (group_slug);

-- Read helper: every faction plus its rating within one group.
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

-- Aggregate read helpers for the global (root, no-slug) page: roll every
-- group's ratings together into one combined ranking. games_played-weighted
-- average Elo per faction, total games summed; unrated factions default to
-- 1500/0. Root voting still writes to the 'default' group, which is part of
-- this aggregate -- these are read-only.
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

-- Read helpers for a "who's voted the most" leaderboard on the Vote screen.
-- Anonymous votes (no voter_name) are excluded -- the leaderboard is about
-- named voters who opted in to being tracked.
create or replace function leaderboard_for_group(p_group_slug text)
returns table (voter_name text, vote_count bigint)
language sql
stable
as $$
  select voter_name, count(*) as vote_count
  from votes
  where group_slug = p_group_slug and voter_name is not null
  group by voter_name
  order by vote_count desc
  limit 20;
$$;

create or replace function leaderboard_aggregate()
returns table (voter_name text, vote_count bigint)
language sql
stable
as $$
  select voter_name, count(*) as vote_count
  from votes
  where voter_name is not null
  group by voter_name
  order by vote_count desc
  limit 20;
$$;

-- Records a single head-to-head vote and updates both factions' Elo (within
-- the given group) atomically, plus a disposition-scoped Elo for any side
-- that was tagged with one. Runs as SECURITY DEFINER so the anon key never
-- needs direct UPDATE access to the ratings tables -- all rating math
-- happens here, server-side, in one place.
--
-- Anti-spam: divides each side's K-factor by (1 + how many of that voter's
-- own last 10 votes in this group already had this exact faction winning /
-- losing). Softens the effect of one voter repeatedly making the same
-- faction win (or lose) in a burst -- deliberate spam or just enthusiastic
-- "champion" gauntlet clicking, either way one voter's opinion shouldn't be
-- able to dominate a shared, crowd-sourced ranking. Relies only on
-- voter_name, which the client always populates now (auto-generating a
-- random name if none is chosen) -- no separate tracking identifier needed.
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

  -- Higher K-factor while a faction still has few votes, so early opinions
  -- move its rating faster; settles down once it has enough games logged.
  -- Then scaled down further by that voter's own recent pattern (see above).
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

alter table factions enable row level security;
alter table group_ratings enable row level security;
alter table group_disposition_ratings enable row level security;
alter table votes enable row level security;

-- Anyone can read faction metadata, per-group standings, and vote history.
create policy "Public can read factions" on factions for select using (true);
create policy "Public can read group ratings" on group_ratings for select using (true);
create policy "Public can read group disposition ratings" on group_disposition_ratings for select using (true);
create policy "Public can read votes" on votes for select using (true);

-- No insert/update/delete policies are defined for these tables, so the
-- anon key cannot write to them directly via the REST API. The only way to
-- change a rating is through record_vote() / the read helpers, exposed
-- below.
grant execute on function factions_for_group(text) to anon;
grant execute on function disposition_ratings_for_group(text) to anon;
grant execute on function factions_aggregate() to anon;
grant execute on function disposition_ratings_aggregate() to anon;
grant execute on function leaderboard_for_group(text) to anon;
grant execute on function leaderboard_aggregate() to anon;
grant execute on function record_vote(uuid, uuid, text, text, text, text) to anon;

-- Streams new votes to every connected browser for the live activity feed.
alter publication supabase_realtime add table votes;
