//! Photo count operations for SQLite repository

use super::SQLite;
use crate::repository::DatesNum;
use crate::value::date;
use std::collections::HashMap;

/// Check if database has any photo metadata
pub fn has_metadata(sqlite: &SQLite) -> bool {
    println!("SQLite::has_metadata() - Checking if database contains metadata");

    if let Ok(conn) = sqlite.get_connection() {
        println!("SQLite::has_metadata() - Database connection successful");

        if let Ok(mut stmt) = conn.prepare("SELECT COUNT(*) FROM photo_metadata") {
            println!("SQLite::has_metadata() - Query prepared successfully");

            if let Ok(count) = stmt.query_row([], |row| {
                let count: i64 = row.get(0)?;
                Ok(count)
            }) {
                println!("SQLite::has_metadata() - Found {} records", count);
                return count > 0;
            } else {
                println!("SQLite::has_metadata() - Failed to execute count query");
            }
        } else {
            println!("SQLite::has_metadata() - Failed to prepare count query");
        }
    } else {
        println!("SQLite::has_metadata() - Failed to connect to database");
    }

    println!("SQLite::has_metadata() - Returning false (no metadata)");
    false
}

/// Get photo count per date (optimized using date_summary table)
pub fn get_photo_count_per_dates(sqlite: &SQLite, dates: date::Dates) -> DatesNum {
    println!(
        "SQLite::get_photo_count_per_dates() - Getting optimized counts for {} dates",
        dates.dates.len()
    );
    let mut dates_num = DatesNum {
        data: HashMap::new(),
    };

    let conn = match sqlite.get_connection() {
        Ok(conn) => {
            println!("SQLite::get_photo_count_per_dates() - Database connection successful");
            conn
        }
        Err(e) => {
            println!(
                "SQLite::get_photo_count_per_dates() - Database connection failed: {:?}",
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
            log::debug!(target: "sqlite", "get_photo_count_per_dates; using_optimized_date_summary=true");

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
                            log::error!(target: "sqlite", "get_photo_count_per_dates; error={}; falling_back_to_empty", e);
                            HashMap::new()
                        }
                    }
                }
                Err(e) => {
                    log::error!(target: "sqlite", "get_photo_count_per_dates; prepare_error={}; falling_back_to_empty", e);
                    HashMap::new()
                }
            };

            // Fill in the requested dates from the cached results
            for date in dates.dates {
                let date_string = date.to_string();
                let count = date_counts.get(&date_string).copied().unwrap_or(0);

                log::debug!(
                    target: "sqlite",
                    "get_photo_count_per_dates; date={}; count={}",
                    date_string, count
                );
                dates_num.data.insert(date_string, count);
            }

            log::debug!(
                target: "sqlite",
                "get_photo_count_per_dates_complete; optimized_result={}",
                dates_num.to_json()
            );
            return dates_num;
        }
    }

    // Fallback to original GROUP BY query
    println!("SQLite::get_photo_count_per_dates() - Using fallback GROUP BY query");

    // First, let's see what date formats we actually have in the database
    if let Ok(mut debug_stmt) =
        conn.prepare("SELECT DISTINCT photo_date FROM photo_metadata LIMIT 5")
    {
        println!("SQLite::get_photo_count_per_dates() - Sample dates in database:");
        if let Ok(rows) = debug_stmt.query_map([], |row| {
            let date_str: String = row.get(0)?;
            Ok(date_str)
        }) {
            for (i, row) in rows.enumerate() {
                if let Ok(date_str) = row {
                    println!(
                        "SQLite::get_photo_count_per_dates() - DB date {}: '{}'",
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
            println!("SQLite::get_photo_count_per_dates() - GROUP BY query prepared successfully");
            stmt
        }
        Err(e) => {
            println!(
                "SQLite::get_photo_count_per_dates() - Query prepare failed: {:?}",
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
            for row in rows {
                if let Ok((date_str, count)) = row {
                    println!(
                        "SQLite::get_photo_count_per_dates() - DB has {} photos for date '{}'",
                        count, date_str
                    );
                    counts.insert(date_str, count);
                }
            }
            counts
        }
        Err(e) => {
            println!(
                "SQLite::get_photo_count_per_dates() - Query execution failed: {:?}",
                e
            );
            return dates_num;
        }
    };

    // Now match the requested dates with the database results
    for date in dates.dates {
        let date_string = date.to_string();
        let count = db_counts.get(&date_string).unwrap_or(&0);
        println!(
            "SQLite::get_photo_count_per_dates() - Requested date '{}' has {} photos",
            date_string, count
        );
        dates_num.data.insert(date_string, *count);
    }

    println!(
        "SQLite::get_photo_count_per_dates() - Final result: {}",
        dates_num.to_json()
    );
    dates_num
}
