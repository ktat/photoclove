-- Add verification hash column to achievement_progress
-- This hash is used to detect tampering with achievement records

ALTER TABLE achievement_progress ADD COLUMN verification_hash TEXT;

-- Note: Existing achievements without hash will be backfilled by application code on startup
