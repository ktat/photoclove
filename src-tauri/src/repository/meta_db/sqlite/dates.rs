//! Date retrieval operations for SQLite repository

use super::SQLite;
use crate::value::date;

/// Get all available dates from the database (optimized using date_summary table)
pub fn get_available_dates(sqlite: &SQLite) -> Result<Vec<date::Date>, String> {
    log::info!(target: "date_summary", "get_available_dates; start=optimized_extraction");

    let conn = sqlite.get_connection().map_err(|e| {
        log::error!(target: "date_summary", "get_available_dates; connection_failed; error={}", e);
        format!("Failed to connect to database: {}", e)
    })?;

    log::debug!(target: "date_summary", "get_available_dates; connection=successful");

    // Try to get dates directly from date_summary table
    let mut stmt = match conn.prepare(
        "SELECT date, photo_count FROM date_summary WHERE date IS NOT NULL ORDER BY date desc",
    ) {
        Ok(stmt) => stmt,
        Err(_) => {
            // Table doesn't exist, fall back to GROUP BY
            log::debug!(target: "date_summary", "get_available_dates; table_missing; fallback=group_by");
            return fallback_get_available_dates(sqlite, &conn);
        }
    };

    let rows = match stmt.query_map([], |row| {
        let date_str: String = row.get(0)?;
        Ok(date_str)
    }) {
        Ok(rows) => rows,
        Err(_) => {
            // Query failed, fall back to GROUP BY
            log::debug!(target: "date_summary", "get_available_dates; query_failed; fallback=group_by");
            return fallback_get_available_dates(sqlite, &conn);
        }
    };

    // Check if we got any results
    let dates: Result<Vec<String>, _> = rows.collect();
    match dates {
        Ok(date_strings) if !date_strings.is_empty() => {
            log::info!(target: "date_summary", "get_available_dates; using_optimized_table=true; count={}", date_strings.len());
            // Convert strings back to MappedRows format for process_date_rows
            let simulated_rows = date_strings.into_iter().map(|s| Ok(s));
            return process_date_rows_from_iter(simulated_rows);
        }
        _ => {
            // No data or error, fall back to GROUP BY
            log::debug!(target: "date_summary", "get_available_dates; no_data; fallback=group_by");
            fallback_get_available_dates(sqlite, &conn)
        }
    }
}

/// Process date rows from database query results
pub fn process_date_rows(
    rows: rusqlite::MappedRows<impl FnMut(&rusqlite::Row) -> rusqlite::Result<String>>,
) -> Result<Vec<date::Date>, String> {
    println!("SQLite::process_date_rows() - Processing date rows");

    let mut dates = Vec::new();
    let mut row_count = 0;
    let mut parsed_count = 0;

    for row in rows {
        row_count += 1;
        let date_str = row.map_err(|e| {
            println!(
                "SQLite::process_date_rows() - Failed to parse row {}: {}",
                row_count, e
            );
            format!("Failed to parse row: {}", e)
        })?;

        if row_count <= 3 {
            println!(
                "SQLite::process_date_rows() - Processing row {}: '{}'",
                row_count, date_str
            );
        }

        // Parse date string in "yyyy-mm-dd" format
        if row_count <= 3 {
            println!(
                "SQLite::process_date_rows() - Processing date string: '{}'",
                date_str
            );
        }

        // Convert format from "2023-01-15" to components
        let parts: Vec<&str> = date_str.split('-').collect();
        if parts.len() == 3 {
            if let (Ok(year), Ok(month), Ok(day)) = (
                parts[0].parse::<i32>(),
                parts[1].parse::<u32>(),
                parts[2].parse::<u32>(),
            ) {
                if row_count <= 3 {
                    println!(
                        "SQLite::process_date_rows() - Parsed components: {}-{}-{}",
                        year, month, day
                    );
                }

                if let Some(date) = date::Date::new(year, month, day) {
                    dates.push(date);
                    parsed_count += 1;

                    if row_count <= 3 {
                        println!(
                            "SQLite::process_date_rows() - Created date object: {}-{:02}-{:02}",
                            year, month, day
                        );
                    }
                } else {
                    if row_count <= 3 {
                        println!("SQLite::process_date_rows() - Failed to create date object for: {}-{}-{}", year, month, day);
                    }
                }
            } else {
                if row_count <= 3 {
                    println!("SQLite::process_date_rows() - Failed to parse date components from: {:?}", parts);
                }
            }
        } else {
            if row_count <= 3 {
                println!(
                    "SQLite::process_date_rows() - Wrong number of date parts: {:?}",
                    parts
                );
            }
        }
    }

    println!(
        "SQLite::process_date_rows() - Processed {} rows, parsed {} dates",
        row_count, parsed_count
    );

    // Remove duplicates (in case same date appears multiple times)
    // Note: SQL already returns sorted results, so we don't need to sort here
    let original_count = dates.len();
    dates.dedup_by(|a, b| a.year == b.year && a.month == b.month && a.day == b.day);

    println!(
        "SQLite::process_date_rows() - After deduplication: {} -> {} unique dates",
        original_count,
        dates.len()
    );

    for (i, date) in dates.iter().enumerate() {
        println!(
            "SQLite::process_date_rows() - Final date {}: {}-{:02}-{:02}",
            i + 1,
            date.year,
            date.month,
            date.day
        );
    }

    println!(
        "SQLite::process_date_rows() - Returning {} dates",
        dates.len()
    );
    Ok(dates)
}

/// Fallback method using GROUP BY when date_summary table is not available
pub fn fallback_get_available_dates(
    _sqlite: &SQLite,
    conn: &rusqlite::Connection,
) -> Result<Vec<date::Date>, String> {
    log::info!(target: "date_summary", "fallback_get_available_dates; using_group_by=true");

    let mut stmt = conn
        .prepare("SELECT DISTINCT date(photo_date) FROM photo_metadata WHERE (delete_flg = 0 OR delete_flg IS NULL) ORDER BY photo_date DESC")
        .map_err(|e| {
            log::error!(target: "date_summary", "fallback_get_available_dates; prepare_failed; error={}", e);
            format!("Failed to prepare fallback statement: {}", e)
        })?;

    let rows = stmt
        .query_map([], |row| {
            let date_str: String = row.get(0)?;
            Ok(date_str)
        })
        .map_err(|e| {
            log::error!(target: "date_summary", "fallback_get_available_dates; execute_failed; error={}", e);
            format!("Failed to execute fallback query: {}", e)
        })?;

    process_date_rows(rows)
}

/// Process date rows from an iterator (for use with date_summary results)
pub fn process_date_rows_from_iter<I>(rows: I) -> Result<Vec<date::Date>, String>
where
    I: Iterator<Item = Result<String, rusqlite::Error>>,
{
    log::debug!(target: "date_summary", "process_date_rows_from_iter; start=true");

    let mut dates = Vec::new();
    let mut row_count = 0;
    let mut parsed_count = 0;

    for row in rows {
        row_count += 1;
        let date_str = row.map_err(|e| {
            log::error!(target: "date_summary", "process_date_rows_from_iter; parse_failed; row={}; error={}", row_count, e);
            format!("Failed to parse row: {}", e)
        })?;

        // Parse date string in "yyyy-mm-dd" format
        let parts: Vec<&str> = date_str.split('-').collect();
        if parts.len() == 3 {
            if let (Ok(year), Ok(month), Ok(day)) = (
                parts[0].parse::<i32>(),
                parts[1].parse::<u32>(),
                parts[2].parse::<u32>(),
            ) {
                if let Some(date) = date::Date::new(year, month, day) {
                    dates.push(date);
                    parsed_count += 1;
                }
            }
        }
    }

    log::info!(target: "date_summary", "process_date_rows_from_iter; processed={}; parsed={}", row_count, parsed_count);

    // Remove duplicates
    // Note: SQL already returns sorted results, so we don't need to sort here
    dates.dedup_by(|a, b| a.year == b.year && a.month == b.month && a.day == b.day);

    log::info!(target: "date_summary", "process_date_rows_from_iter; final_count={}", dates.len());
    Ok(dates)
}
