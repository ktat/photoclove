-- Recovery Queue table for failed operations
-- Operations that fail can be retried when user is ready

CREATE TABLE IF NOT EXISTS recovery_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,        -- move_to_trash, restore, import, permanently_delete
    target_path TEXT NOT NULL,           -- target path (meaning varies by operation)
    error_reason TEXT NOT NULL,          -- failure reason
    failed_at TEXT NOT NULL,             -- failure timestamp
    retry_count INTEGER DEFAULT 0,       -- retry count
    last_retry_at TEXT,                  -- last retry timestamp
    status TEXT DEFAULT 'pending',       -- pending, resolved, discarded
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recovery_queue_status ON recovery_queue(status);
CREATE INDEX IF NOT EXISTS idx_recovery_queue_operation ON recovery_queue(operation_type);
