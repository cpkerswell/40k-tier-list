-- Seed data: current (10th edition) tabletop factions, grouped into the three
-- grand alliances the app uses: Imperium, Chaos, Xenos.
-- Run after schema.sql, in the Supabase SQL Editor.
-- Safe to re-run: existing names are left untouched, only missing ones are added.

insert into factions (name, faction_type) values
  ('Space Marines', 'Imperium'),
  ('Blood Angels', 'Imperium'),
  ('Dark Angels', 'Imperium'),
  ('Space Wolves', 'Imperium'),
  ('Black Templars', 'Imperium'),
  ('Deathwatch', 'Imperium'),
  ('Astra Militarum', 'Imperium'),
  ('Adeptus Custodes', 'Imperium'),
  ('Adepta Sororitas', 'Imperium'),
  ('Adeptus Mechanicus', 'Imperium'),
  ('Grey Knights', 'Imperium'),
  ('Imperial Knights', 'Imperium'),
  ('Chaos Space Marines', 'Chaos'),
  ('Death Guard', 'Chaos'),
  ('Thousand Sons', 'Chaos'),
  ('World Eaters', 'Chaos'),
  ('Chaos Daemons', 'Chaos'),
  ('Chaos Knights', 'Chaos'),
  ('Emperor''s Children', 'Chaos'),
  ('Aeldari', 'Xenos'),
  ('Drukhari', 'Xenos'),
  ('Necrons', 'Xenos'),
  ('Orks', 'Xenos'),
  ('T''au Empire', 'Xenos'),
  ('Tyranids', 'Xenos'),
  ('Genestealer Cults', 'Xenos'),
  ('Leagues of Votann', 'Xenos')
on conflict (name) do nothing;
