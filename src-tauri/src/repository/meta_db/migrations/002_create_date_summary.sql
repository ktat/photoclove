-- Create date_summary table for caching date counts
CREATE TABLE IF NOT EXISTS date_summary (
    date TEXT PRIMARY KEY,
    photo_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
    updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'
);

CREATE INDEX IF NOT EXISTS idx_date_summary_date ON date_summary(date);
