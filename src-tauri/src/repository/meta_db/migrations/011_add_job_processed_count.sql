-- Add processed_count column to job_queue table for progress tracking
ALTER TABLE job_queue ADD COLUMN processed_count INTEGER NOT NULL DEFAULT 0;
