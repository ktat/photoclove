-- Migration 007: Add storage_sync column to photo_metadata
-- This column stores JSON data for tracking sync status across multiple storage providers

-- Add storage_sync column to photo_metadata table
ALTER TABLE photo_metadata ADD COLUMN storage_sync TEXT DEFAULT NULL;

-- Create index for efficient queries on synced photos
CREATE INDEX IF NOT EXISTS idx_storage_sync ON photo_metadata(storage_sync);
