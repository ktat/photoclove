use rusqlite::{params, Result};

use super::SQLite;
use crate::value::date;

/// Check if date_summary cache is current with photo_metadata
pub(super) fn check_date_summary_currency(db: &SQLite) -> Result<bool, String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Check if summary table exists
    let table_exists = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='date_summary'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)))
        .unwrap_or(false);

    log::debug!(target: "date_summary", "currency_check; table_exists={}", table_exists);

    if !table_exists {
        return Ok(false);
    }

    // Check if date_summary has any rows
    let summary_count = conn
        .query_row("SELECT COUNT(*) FROM date_summary", [], |row| {
            row.get::<_, i32>(0)
        })
        .unwrap_or(0);

    log::debug!(target: "date_summary", "row_count_check; summary_count={}", summary_count);

    if summary_count == 0 {
        return Ok(false);
    }

    // Compare last update timestamps
    let summary_timestamp = conn
        .query_row("SELECT MAX(updated_at) FROM date_summary", [], |row| {
            row.get::<_, String>(0)
        })
        .unwrap_or_else(|_| "1970-01-01 00:00:00".to_string());

    let metadata_timestamp = conn
        .query_row("SELECT MAX(updated_at) FROM photo_metadata", [], |row| {
            row.get::<_, String>(0)
        })
        .unwrap_or_else(|_| "1970-01-01 00:00:00".to_string());

    log::debug!(target: "date_summary", "timestamp_comparison; summary_timestamp={}; metadata_timestamp={}",
               summary_timestamp, metadata_timestamp);

    let is_current = summary_timestamp >= metadata_timestamp;
    log::info!(target: "date_summary", "currency_result; is_current={}", is_current);

    Ok(is_current)
}

/// Rebuild the entire date_summary cache from photo_metadata
pub(super) fn rebuild_date_summary(db: &SQLite) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Clear existing summary
    conn.execute("DELETE FROM date_summary", [])
        .map_err(|e| format!("Failed to clear date_summary: {}", e))?;

    // Populate from photo_metadata using GROUP BY (exclude deleted photos)
    let now = date::DateTime::now().to_db_string();
    conn.execute(
        "INSERT INTO date_summary (date, photo_count, created_at, updated_at)
         SELECT date(photo_date) as date_only, COUNT(*) as count, ? as created_at, ? as updated_at
         FROM photo_metadata
         WHERE (delete_flg = 0 OR delete_flg IS NULL)
         GROUP BY date(photo_date)",
        params![now, now],
    ).map_err(|e| format!("Failed to populate date_summary: {}", e))?;

    Ok(())
}

/// Update date_summary for a specific photo date with delta count
pub(super) fn update_date_summary_for_photo(db: &SQLite, photo_date: &str, delta: i32) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Connection failed: {}", e))?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Transaction failed: {}", e))?;

    let date_str = if let Ok(parsed_date) =
        chrono::NaiveDateTime::parse_from_str(photo_date, "%Y-%m-%d %H:%M:%S")
    {
        parsed_date.format("%Y-%m-%d").to_string()
    } else if let Ok(parsed_date) = chrono::NaiveDate::parse_from_str(photo_date, "%Y-%m-%d") {
        parsed_date.format("%Y-%m-%d").to_string()
    } else {
        // Fallback: extract date part if format is unexpected
        photo_date
            .split(' ')
            .next()
            .unwrap_or(photo_date)
            .to_string()
    };

    // Update or insert date summary
    let now = date::DateTime::now().to_db_string();
    tx.execute(
        "INSERT OR REPLACE INTO date_summary (date, photo_count, updated_at, created_at)
         VALUES (?1, COALESCE((SELECT photo_count FROM date_summary WHERE date = ?1), 0) + ?2, ?3,
                 COALESCE((SELECT created_at FROM date_summary WHERE date = ?1), ?3))",
        params![date_str, delta, now]
    ).map_err(|e| format!("Summary update failed: {}", e))?;

    // Remove entries with zero or negative counts
    tx.execute("DELETE FROM date_summary WHERE photo_count <= 0", [])
        .map_err(|e| format!("Failed to cleanup empty dates: {}", e))?;

    tx.commit().map_err(|e| format!("Commit failed: {}", e))?;
    Ok(())
}

/// Update date_summary for a specific date by recounting actual photos
pub(super) fn update_date_summary_for_date(db: &SQLite, date: &str, _delta: i32) -> Result<(), String> {
    let conn = db
        .get_connection()
        .map_err(|e| format!("Connection failed: {}", e))?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Transaction failed: {}", e))?;

    // Count actual non-deleted photos for this date
    let actual_count: i32 = tx
        .query_row(
            "SELECT COUNT(*) FROM photo_metadata
         WHERE DATE(photo_date) = ?1
         AND (delete_flg = 0 OR delete_flg IS NULL)",
            params![date],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count photos: {}", e))?;

    // Update or insert date summary with actual count
    let now = date::DateTime::now().to_db_string();

    if actual_count > 0 {
        tx.execute(
            "INSERT OR REPLACE INTO date_summary (date, photo_count, updated_at, created_at)
             VALUES (?1, ?2, ?3, COALESCE((SELECT created_at FROM date_summary WHERE date = ?1), ?3))",
            params![date, actual_count, now]
        ).map_err(|e| format!("Summary update failed: {}", e))?;
    } else {
        // Remove entry if no photos exist for this date
        tx.execute("DELETE FROM date_summary WHERE date = ?1", params![date])
            .map_err(|e| format!("Failed to cleanup empty date: {}", e))?;
    }

    tx.commit().map_err(|e| format!("Commit failed: {}", e))?;
    Ok(())
}
