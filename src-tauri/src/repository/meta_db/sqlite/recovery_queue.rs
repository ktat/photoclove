//! Recovery Queue repository for failed operations
//!
//! This module provides storage for operations that failed and can be retried
//! when the user is ready (e.g., after fixing permissions or creating directories).

use super::utils::{row_to_recovery_item, with_connection};
use crate::entity::recovery_queue::{OperationType, RecoveryItem, RecoveryStatus};
use crate::repository::meta_db::sqlite::SQLite;
use crate::value::date;
use rusqlite::{params, OptionalExtension};

const RECOVERY_ITEM_COLUMNS: &str =
    "id, operation_type, target_path, error_reason, failed_at, retry_count, last_retry_at, status, created_at, updated_at";

/// Get recovery items with optional status filter
fn get_items_with_filter(
    sqlite: &SQLite,
    status_filter: Option<&[&str]>,
    order: &str,
) -> Result<Vec<RecoveryItem>, String> {
    with_connection(sqlite, |conn| {
        let query = match status_filter {
            Some(statuses) => {
                let placeholders = statuses.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                format!(
                    "SELECT {} FROM recovery_queue WHERE status IN ({}) ORDER BY created_at {}",
                    RECOVERY_ITEM_COLUMNS, placeholders, order
                )
            }
            None => format!(
                "SELECT {} FROM recovery_queue ORDER BY created_at {}",
                RECOVERY_ITEM_COLUMNS, order
            ),
        };

        let mut stmt = conn
            .prepare(&query)
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let items = match status_filter {
            Some(statuses) => {
                let params: Vec<&dyn rusqlite::ToSql> =
                    statuses.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
                stmt.query_map(params.as_slice(), row_to_recovery_item)
            }
            None => stmt.query_map([], row_to_recovery_item),
        }
        .map_err(|e| format!("Failed to query recovery items: {}", e))?;

        let mut result = Vec::new();
        for item in items {
            result.push(
                item.map_err(|e| format!("Failed to parse recovery item: {}", e))?,
            );
        }

        Ok(result)
    })
}

/// Add a failed operation to the recovery queue
pub(super) fn add_to_recovery_queue(
    sqlite: &SQLite,
    operation_type: OperationType,
    target_path: &str,
    error_reason: &str,
) -> Result<i64, String> {
    with_connection(sqlite, |conn| {
        let now = date::DateTime::now().to_db_string();

        conn.execute(
            "INSERT INTO recovery_queue (operation_type, target_path, error_reason, failed_at, status)
             VALUES (?1, ?2, ?3, ?4, 'pending')",
            params![operation_type.to_string(), target_path, error_reason, now],
        )
        .map_err(|e| format!("Failed to insert recovery item: {}", e))?;

        Ok(conn.last_insert_rowid())
    })
}

/// Get count of pending and unrecoverable recovery items
pub(super) fn get_pending_count(sqlite: &SQLite) -> Result<i32, String> {
    with_connection(sqlite, |conn| {
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM recovery_queue WHERE status IN ('pending', 'unrecoverable')",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to get pending count: {}", e))?;

        Ok(count)
    })
}

/// Get all pending and unrecoverable recovery items
pub(super) fn get_pending_items(sqlite: &SQLite) -> Result<Vec<RecoveryItem>, String> {
    get_items_with_filter(sqlite, Some(&["pending", "unrecoverable"]), "ASC")
}

/// Get all recovery items (including resolved and discarded)
pub(super) fn get_all_items(sqlite: &SQLite) -> Result<Vec<RecoveryItem>, String> {
    get_items_with_filter(sqlite, None, "DESC")
}

/// Update recovery item status
pub(super) fn update_status(
    sqlite: &SQLite,
    id: i64,
    status: RecoveryStatus,
) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        let now = date::DateTime::now().to_db_string();

        conn.execute(
            "UPDATE recovery_queue SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![status.to_string(), now, id],
        )
        .map_err(|e| format!("Failed to update recovery status: {}", e))?;

        Ok(())
    })
}

/// Increment retry count and update last_retry_at
pub(super) fn increment_retry(sqlite: &SQLite, id: i64) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        let now = date::DateTime::now().to_db_string();

        conn.execute(
            "UPDATE recovery_queue SET retry_count = retry_count + 1, last_retry_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )
        .map_err(|e| format!("Failed to increment retry count: {}", e))?;

        Ok(())
    })
}

/// Delete a recovery item
pub(super) fn delete_item(sqlite: &SQLite, id: i64) -> Result<(), String> {
    with_connection(sqlite, |conn| {
        conn.execute("DELETE FROM recovery_queue WHERE id = ?1", [id])
            .map_err(|e| format!("Failed to delete recovery item: {}", e))?;

        Ok(())
    })
}

/// Cleanup old resolved/discarded items (older than 30 days)
pub(super) fn cleanup_old_items(sqlite: &SQLite) -> Result<usize, String> {
    with_connection(sqlite, |conn| {
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
    })
}

/// Get a single recovery item by ID
pub(super) fn get_item(sqlite: &SQLite, id: i64) -> Result<Option<RecoveryItem>, String> {
    with_connection(sqlite, |conn| {
        let query = format!(
            "SELECT {} FROM recovery_queue WHERE id = ?1",
            RECOVERY_ITEM_COLUMNS
        );

        let mut stmt = conn
            .prepare(&query)
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let item = stmt
            .query_row([id], row_to_recovery_item)
            .optional()
            .map_err(|e| format!("Failed to query recovery item: {}", e))?;

        Ok(item)
    })
}
