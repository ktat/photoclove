-- Achievement progress tracking table
-- Stores both progress and achievement state for all achievement types

CREATE TABLE IF NOT EXISTS achievement_progress (
    id TEXT PRIMARY KEY,              -- Achievement ID (e.g., 'first_import', 'photos_1000')
    current_value INTEGER DEFAULT 0,  -- Current progress value
    achieved_at TEXT,                 -- NULL = not achieved, ISO datetime = achieved
    updated_at TEXT NOT NULL          -- Last update timestamp
);

-- Index for querying achieved/unachieved achievements
CREATE INDEX IF NOT EXISTS idx_achievement_achieved ON achievement_progress(achieved_at);
