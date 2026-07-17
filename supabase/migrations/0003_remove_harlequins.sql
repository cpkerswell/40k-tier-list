-- Run this once in the SQL Editor to remove Harlequins as a votable faction.
-- votes.winner_id/loser_id reference factions(id) on delete cascade, so any
-- existing votes involving Harlequins are removed along with it.

delete from factions where name = 'Harlequins';
