-- Create job queue tables
CREATE TABLE IF NOT EXISTS job_unit (
    id TEXT PRIMARY KEY,
    jobs TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS job_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_unit_id TEXT NOT NULL,
    job TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY(job_unit_id) REFERENCES job_unit(id)
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_unit_id ON job_queue(job_unit_id);
