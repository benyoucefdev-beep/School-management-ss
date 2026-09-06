-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 004: STUDENT PHOTOS
--
-- Additive only. No DROP, no data loss.
--
-- Photos live in their own table rather than a column on students, because
-- /api/students does `SELECT s.*` — putting image bytes on the row would drag
-- every photo through every list query. Here the join is never made unless the
-- photo is actually asked for.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS student_photos (
  student_id  UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  -- Base64 image payload, already resized by the client to passport
  -- proportions (35x45mm at ~300px wide), so rows stay in the tens of KB.
  data        TEXT        NOT NULL,
  mime_type   VARCHAR(40) NOT NULL DEFAULT 'image/jpeg',
  byte_size   INT,
  uploaded_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Optional external URL (Supabase Storage, CDN). When set it wins over the
-- inline copy, so a school can move to object storage without a data migration.
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Lets the students list show "has a photo" without fetching any image bytes.
CREATE OR REPLACE VIEW student_photo_status AS
SELECT s.id AS student_id,
       (p.student_id IS NOT NULL OR s.photo_url IS NOT NULL) AS has_photo
FROM students s
LEFT JOIN student_photos p ON p.student_id = s.id;
