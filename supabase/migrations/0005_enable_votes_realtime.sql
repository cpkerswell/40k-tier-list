-- Run this once in the SQL Editor. Adds `votes` to Supabase's realtime
-- publication so new votes are pushed live to every connected browser for the
-- activity feed, instead of requiring a poll/refresh. Idempotent: safe to
-- re-run even if the table is already part of the publication.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'votes'
  ) then
    alter publication supabase_realtime add table votes;
  end if;
end $$;
