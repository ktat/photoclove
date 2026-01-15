//! Recovery Queue repository for failed operations
//!
//! This module provides storage for operations that failed and can be retried
//! when the user is ready (e.g., after fixing permissions or creating directories).

use crate::entity::recovery_queue::{RecoveryItem, RecoveryStatus, OperationType};
use crate::repository::meta_db::sqlite::SQLite;
use rusqlite::{params, Connection, OptionalExtension};

/// Add a failed operation to the recovery queue
pub(super) fn add_to_recovery_queue(
    sqlite: &SQLite,
    operation_type: OperationType,
    target_path: &str,
    error_reason: &str,
) -> Result<i64, String> {
    let conn = Connection::open(&sqlite.db_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO recovery_queue (operation_type, target_path, error_reason, failed_at, status)
         VALUES (?1, ?2, ?3, ?4, 'pending')",
        params![operation_type.to_string(), target_path, error_reason, now],
    )
    .map_err(|e| format!("Failed to insert recovery item: {}", e))?;

    Ok(conn.last_insert_rowid())
}

/// Get count of pending and unrecoverable recovery items
pub(super) fn get_pending_count(sqlite: &SQLite) -> Result<i32, String> {
    let conn = Connection::open(&sqlite.db_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM recovery_queue WHERE status IN ('pending', 'unrecoverable')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get pending count: {}", e))?;

    Ok(count)
}

/// Get all pending and unrecoverable recovery items
pub(super) fn get_pending_items(sqlite: &SQLite) -> Result<Vec<RecoveryItem>, String> {
    let conn = Connection::open(&sqlite.db_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, operation_type, target_path, error_reason, failed_at, retry_count, last_retry_at, status, created_at, updated_at
             FROM recovery_queue WHERE status IN ('pending', 'unrecoverable') ORDER BY created_at ASC",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let items = stmt
        .query_map([], |row| {
            Ok(RecoveryItem {
                id: row.get(0)?,
                operation_type: OperationType::from(row.get::<_, String>(1)?),
                target_path: row.get(2)?,
                error_reason: row.get(3)?,
                failed_at: row.get(4)?,
                retry_count: row.get(5)?,
                last_retry_at: row.get(6)?,
                status: RecoveryStatus::from(row.get::<_, String>(7)?),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query recovery items: {}", e))?;

    let mut result = Vec::new();
    for item in items {
        result.push(item.map_err(|e| format!("Failed to parse recovery item: {}", e))?);
    }

    Ok(result)
}

/// Get all recovery items (including resolved and discarded)
pub(super) fn get_all_items(sqlite: &SQLite) -> Result<Vec<RecoveryItem>, String> {
    let conn = Connection::open(&sqlite.db_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, operation_type, target_path, error_reason, failed_at, retry_count, last_retry_at, status, created_at, updated_at
             FROM recovery_queue ORDER BY created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let items = stmt
        .query_map([], |row| {
            Ok(RecoveryItem {
                id: row.get(0)?,
                operation_type: OperationType::from(row.get::<_, String>(1)?),
                target_path: row.get(2)?,
                error_reason: row.get(3)?,
                failed_at: row.get(4)?,
                retry_count: row.get(5)?,
                last_retry_at: row.get(6)?,
                status: RecoveryStatus::from(row.get::<_, String>(7)?),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query recovery items: {}", e))?;

    let mut result = Vec::new();
    for item in items {
        result.push(item.map_err(|e| format!("Failed to parse recovery item: {}", e))?);
    }

    Ok(result)
}

/// Update recovery item status
pub(super) fn update_status(
    sqlite: &SQLite,
    id: i64,
    status: RecoveryStatus,
) -> Result<(), String> {
    let conn = Connection::open(&sqlite.db_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "UPDATE recovery_queue SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status.to_string(), now, id],
    )
    .map_err(|e| format!("Failed to update recovery status: {}", e))?;

    Ok(())
}

/// Increment retry count and update last_retry_at
pub(super) fn increment_retry(sqlite: &SQLite, id: i64) -> Result<(), String> {
    let conn = Connection::open(&sqlite.db_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "UPDATE recovery_queue SET retry_count = retry_count + 1, last_retry_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| format!("Failed to increment retry count: {}", e))?;

    Ok(())
}

/// Delete a recovery item
pub(super) fn delete_item(sqlite: &SQLite, id: i64) -> Result<(), String> {
    let conn = Connection::open(&sqlite.db_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    conn.execute("DELETE FROM recovery_queue WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete recovery item: {}", e))?;

    Ok(())
}

/// Cleanup old resolved/discarded items (older than 30 days)
pub(super) fn cleanup_old_items(sqlite: &SQLite) -> Result<usize, String> {
    let conn = Connection::open(&sqlite.db_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let affected = conn
        .execute(
            "DELETE FROM recovery_queue WHERE status IN ('resolved', 'discarded') AND updated_at < datetime('now', '-30 days')",
            [],
        )
        .map_err(|e| format!("Failed to cleanup old items: {}", e))?;

    if affected > 0 {
        log::info!(target: "recovery_queue", "cleanup; deleted_items={}", affected);
    }

    Ok(affected)
}

/// Get a single recovery item by ID
pub(super) fn get_item(sqlite: &SQLite, id: i64) -> Result<Option<RecoveryItem>, String> {
    let conn = Connection::open(&sqlite.db_path)
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, operation_type, target_path, error_reason, failed_at, retry_count, last_retry_at, status, created_at, updated_at
             FROM recovery_queue WHERE id = ?1",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let item = stmt
        .query_row([id], |row| {
            Ok(RecoveryItem {
                id: row.get(0)?,
                operation_type: OperationType::from(row.get::<_, String>(1)?),
                target_path: row.get(2)?,
                error_reason: row.get(3)?,
                failed_at: row.get(4)?,
                retry_count: row.get(5)?,
                last_retry_at: row.get(6)?,
                status: RecoveryStatus::from(row.get::<_, String>(7)?),
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .optional()
        .map_err(|e| format!("Failed to query recovery item: {}", e))?;

    Ok(item)
}
