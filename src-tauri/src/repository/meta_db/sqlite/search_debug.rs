//! Debug helper functions for search operations
//!
//! This module provides utility functions for debugging and logging
//! SQL queries and parameters during search operations.

use rusqlite::Connection;

/// Format parameter for debug logging
pub fn format_param_for_debug(i: usize, param: &Box<dyn rusqlite::ToSql>) -> String {
    match param.to_sql() {
        Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Text(text))) => {
            format!("${}: '{}'", i + 1, text)
        }
        Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Integer(int))) => {
            format!("${}: {}", i + 1, int)
        }
        Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Real(real))) => {
            format!("${}: {}", i + 1, real)
        }
        Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Null)) => {
            format!("${}: NULL", i + 1)
        }
        Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Text(text))) => {
            format!("${}: '{}'", i + 1, String::from_utf8_lossy(text))
        }
        Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Integer(int))) => {
            format!("${}: {}", i + 1, int)
        }
        Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Real(real))) => {
            format!("${}: {}", i + 1, real)
        }
        Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Null)) => {
            format!("${}: NULL", i + 1)
        }
        Ok(_) => format!("${}: <unknown>", i + 1),
        Err(_) => format!("${}: <error>", i + 1),
    }
}

/// Create SQL with embedded parameters for better readability
pub fn create_embedded_sql(sql_query: &str, params: &Vec<Box<dyn rusqlite::ToSql>>) -> String {
    let mut embedded_sql = sql_query.to_string();
    for param in params.iter() {
        let placeholder = "?";
        let replacement = match param.to_sql() {
            Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Text(ref text))) => {
                format!("'{}'", text.replace("'", "''")) // Escape single quotes
            }
            Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Integer(int))) => {
                int.to_string()
            }
            Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Real(real))) => {
                real.to_string()
            }
            Ok(rusqlite::types::ToSqlOutput::Owned(rusqlite::types::Value::Null)) => {
                "NULL".to_string()
            }
            Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Text(text))) => {
                format!("'{}'", String::from_utf8_lossy(text).replace("'", "''"))
            }
            Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Integer(int))) => {
                int.to_string()
            }
            Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Real(real))) => {
                real.to_string()
            }
            Ok(rusqlite::types::ToSqlOutput::Borrowed(rusqlite::types::ValueRef::Null)) => {
                "NULL".to_string()
            }
            _ => "?".to_string(),
        };
        // Replace the first occurrence of ? with the parameter value
        if let Some(pos) = embedded_sql.find(placeholder) {
            embedded_sql.replace_range(pos..pos + 1, &replacement);
        }
    }
    embedded_sql
}

/// Log database date range for debugging
pub fn log_date_range_debug(conn: &Connection) {
    if let Ok(mut sample_stmt) = conn.prepare("SELECT MIN(exif_date_time_original) as min_date, MAX(exif_date_time_original) as max_date, COUNT(*) as total_photos FROM photo_metadata WHERE exif_date_time_original IS NOT NULL AND exif_date_time_original != ''") {
        if let Ok(sample_row) = sample_stmt.query_row([], |row| {
            Ok((
                row.get::<_, Option<String>>("min_date").unwrap_or_default(),
                row.get::<_, Option<String>>("max_date").unwrap_or_default(),
                row.get::<_, i64>("total_photos").unwrap_or(0)
            ))
        }) {
            log::debug!(
                target: "database",
                "database_date_range; min_date={}; max_date={}; total_photos_with_dates={}",
                sample_row.0.unwrap_or_else(|| "None".to_string()),
                sample_row.1.unwrap_or_else(|| "None".to_string()),
                sample_row.2
            );
        }
    }
}
