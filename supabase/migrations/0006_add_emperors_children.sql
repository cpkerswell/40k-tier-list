-- Run this once in the SQL Editor to add Emperor's Children as a votable faction.

insert into factions (name, faction_type) values
  ('Emperor''s Children', 'Chaos')
on conflict (name) do nothing;
