//! Photo count operations for SQLite repository

use super::SQLite;
use crate::repository::DatesNum;
use crate::value::date;
use std::collections::HashMap;

/// Check if database has any photo metadata
pub fn has_metadata(sqlite: &SQLite) -> bool {
    log::debug!(target: "counts", "has_metadata; status=checking");

    if let Ok(conn) = sqlite.get_connection() {
        log::debug!(target: "counts", "has_metadata; connection=success");

        if let Ok(mut stmt) = conn.prepare("SELECT COUNT(*) FROM photo_metadata") {
            log::debug!(target: "counts", "has_metadata; query_prepared=true");

            if let Ok(count) = stmt.query_row([], |row| {
                let count: i64 = row.get(0)?;
                Ok(count)
            }) {
                log::debug!(target: "counts", "has_metadata; record_count={}", count);
                return count > 0;
            } else {
                log::warn!(target: "counts", "has_metadata; query_execute=failed");
            }
        } else {
            log::warn!(target: "counts", "has_metadata; query_prepare=failed");
        }
    } else {
        log::error!(target: "counts", "has_metadata; connection=failed");
    }

    log::debug!(target: "counts", "has_metadata; result=false");
    false
}

/// Get photo count per date (optimized using date_summary table)
pub fn get_photo_count_per_dates(sqlite: &SQLite, dates: date::Dates) -> DatesNum {
    log::debug!(
        target: "counts",
        "get_photo_count_per_dates; date_count={}",
        dates.dates.len()
    );
    let mut dates_num = DatesNum {
        data: HashMap::new(),
    };

    let conn = match sqlite.get_connection() {
        Ok(conn) => {
            log::debug!(target: "counts", "get_photo_count_per_dates; connection=success");
            conn
        }
        Err(e) => {
            log::error!(
                target: "counts",
                "get_photo_count_per_dates; connection_error={:?}",
                e
            );
            return dates_num;
        }
    };

    // Check if date_summary table exists and has data
    let table_exists = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='date_summary'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)))
        .unwrap_or(false);

    if table_exists {
        let summary_count = conn
            .query_row("SELECT COUNT(*) FROM date_summary", [], |row| {
                row.get::<_, i32>(0)
            })
            .unwrap_or(0);

        if summary_count > 0 {
            log::debug!(target: "counts", "get_photo_count_per_dates; using_optimized_date_summary=true");

            // Use optimized single query from date_summary table
            let date_counts: HashMap<String, i32> = match conn
                .prepare("SELECT date, photo_count FROM date_summary WHERE date IS NOT NULL")
            {
                Ok(mut stmt) => {
                    match stmt.query_map([], |row| {
                        let date: String = row.get(0)?;
                        let count: i32 = row.get(1)?;
                        Ok((date, count))
                    }) {
                        Ok(mapped) => mapped.filter_map(Result::ok).collect(),
                        Err(e) => {
                            log::error!(target: "counts", "get_photo_count_per_dates; query_error={}; falling_back_to_empty", e);
                            HashMap::new()
                        }
                    }
                }
                Err(e) => {
                    log::error!(target: "counts", "get_photo_count_per_dates; prepare_error={}; falling_back_to_empty", e);
                    HashMap::new()
                }
            };

            // Fill in the requested dates from the cached results
            for date in dates.dates {
                let date_string = date.to_string();
                let count = date_counts.get(&date_string).copied().unwrap_or(0);

                log::trace!(
                    target: "counts",
                    "get_photo_count_per_dates; date={}; count={}",
                    date_string, count
                );
                dates_num.data.insert(date_string, count);
            }

            log::debug!(
                target: "counts",
                "get_photo_count_per_dates_complete; optimized=true; result_count={}",
                dates_num.data.len()
            );
            return dates_num;
        }
    }

    // Fallback to original GROUP BY query
    log::debug!(target: "counts", "get_photo_count_per_dates; using_fallback_group_by=true");

    // Debug: sample dates in database
    if let Ok(mut debug_stmt) =
        conn.prepare("SELECT DISTINCT photo_date FROM photo_metadata LIMIT 5")
    {
        if let Ok(rows) = debug_stmt.query_map([], |row| {
            let date_str: String = row.get(0)?;
            Ok(date_str)
        }) {
            for (i, row) in rows.enumerate() {
                if let Ok(date_str) = row {
                    log::trace!(
                        target: "counts",
                        "get_photo_count_per_dates; sample_date_{}='{}'",
                        i + 1,
                        date_str
                    );
                }
            }
        }
    }

    // Use GROUP BY to get all counts in a single query
    let mut stmt = match conn.prepare("SELECT date(photo_date) as date_only, COUNT(*) as count FROM photo_metadata WHERE (delete_flg = 0 OR delete_flg IS NULL) GROUP BY date(photo_date)") {
        Ok(stmt) => {
            log::debug!(target: "counts", "get_photo_count_per_dates; group_by_query_prepared=true");
            stmt
        }
        Err(e) => {
            log::error!(
                target: "counts",
                "get_photo_count_per_dates; query_prepare_error={:?}",
                e
            );
            return dates_num;
        }
    };

    // Execute the query once to get all date counts
    let db_counts = match stmt.query_map([], |row| {
        let date_str: String = row.get(0)?;
        let count: i32 = row.get(1)?;
        Ok((date_str, count))
    }) {
        Ok(rows) => {
            let mut counts = std::collections::HashMap::new();
            for (date_str, count) in rows.flatten() {
                log::trace!(
                    target: "counts",
                    "get_photo_count_per_dates; db_date={}; photo_count={}",
                    date_str, count
                );
                counts.insert(date_str, count);
            }
            counts
        }
        Err(e) => {
            log::error!(
                target: "counts",
                "get_photo_count_per_dates; query_execute_error={:?}",
                e
            );
            return dates_num;
        }
    };

    // Now match the requested dates with the database results
    for date in dates.dates {
        let date_string = date.to_string();
        let count = db_counts.get(&date_string).unwrap_or(&0);
        log::trace!(
            target: "counts",
            "get_photo_count_per_dates; requested_date={}; count={}",
            date_string, count
        );
        dates_num.data.insert(date_string, *count);
    }

    log::debug!(
        target: "counts",
        "get_photo_count_per_dates_complete; fallback=true; result_count={}",
        dates_num.data.len()
    );
    dates_num
}
