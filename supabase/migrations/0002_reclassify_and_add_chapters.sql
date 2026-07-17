-- Run this once in the SQL Editor of a project that already ran the original
-- schema.sql + seed.sql. Safe to re-run.
--
-- 1. Consolidates faction_type down to the three grand alliances the UI now
--    groups by (Imperium / Chaos / Xenos) -- previously Aeldari, Necrons,
--    Orks, T'au, Tyranids, and Other were separate values.
-- 2. Adds the non-codex Space Marine chapters, each of which has its own
--    rules/codex as of 10th edition rather than using the generic Space
--    Marines codex.
-- 3. Locks faction_type to those three values going forward.

update factions set faction_type = 'Xenos'
where faction_type in ('Aeldari', 'Necrons', 'Orks', 'T''au', 'Tyranids', 'Other');

insert into factions (name, faction_type) values
  ('Blood Angels', 'Imperium'),
  ('Dark Angels', 'Imperium'),
  ('Space Wolves', 'Imperium'),
  ('Black Templars', 'Imperium'),
  ('Deathwatch', 'Imperium')
on conflict (name) do nothing;

alter table factions
  add constraint factions_faction_type_check
  check (faction_type in ('Imperium', 'Chaos', 'Xenos'));
