-- Read helpers for a "who's voted the most" leaderboard on the Vote screen.
-- Anonymous votes (no voter_name) are excluded -- the leaderboard is about
-- named voters who opted in to being tracked, consistent with names being an
-- opt-in localStorage preference rather than a login.

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

grant execute on function leaderboard_for_group(text) to anon;

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

grant execute on function leaderboard_aggregate() to anon;
