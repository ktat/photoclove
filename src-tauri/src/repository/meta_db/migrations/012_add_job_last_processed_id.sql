-- Add last_processed_id column for job resume functionality
-- This tracks the last processed item ID for LastProcessedId strategy jobs

ALTER TABLE job_queue ADD COLUMN last_processed_id INTEGER;
