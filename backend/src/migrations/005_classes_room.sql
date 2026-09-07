-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 005: CLASSES — ROOM, AND AN OPTIONAL TITLE
--
-- Additive only. No DROP, no data loss.
-- ══════════════════════════════════════════════════════════════════════════════

-- The New Class form has always had a Room field, but classes had no room
-- column, so whatever was typed was silently discarded on save.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS room VARCHAR(50);

-- A class is identified by its subject and group ("Mathematics — Year 7 Blue"),
-- so asking staff to invent a title as well is redundant data entry. The column
-- stays (existing rows keep their titles, and reports read it) but it is no
-- longer required: the API fills it in from the subject and group.
ALTER TABLE classes ALTER COLUMN title DROP NOT NULL;
