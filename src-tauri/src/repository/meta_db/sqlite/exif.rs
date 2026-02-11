//! EXIF data operations for SQLite repository

use super::SQLite;
use crate::value::{date, exif::ExifData};
use rusqlite::params;

/// Update EXIF data for a photo if values differ from database
/// Returns true if any updates were made
pub fn update_exif_if_changed(
    sqlite: &SQLite,
    path: &str,
    exif: &ExifData,
) -> Result<bool, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Get current EXIF values from database
    let mut stmt = conn
        .prepare(
            "SELECT exif_iso, exif_fnumber, exif_date_time, exif_date_time_original,
                    exif_lens_model, exif_make, exif_lens_make, exif_model,
                    exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright,
                    exif_exposure_time, exif_shutter_speed_value, exif_focal_length,
                    exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode,
                    exif_white_balance_mode, exif_orientation
             FROM photo_metadata WHERE path = ?1",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    #[allow(clippy::type_complexity)]
    let db_exif: Option<(
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )> = stmt
        .query_row(params![path], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
                row.get(10)?,
                row.get(11)?,
                row.get(12)?,
                row.get(13)?,
                row.get(14)?,
                row.get(15)?,
                row.get(16)?,
                row.get(17)?,
                row.get(18)?,
                row.get(19)?,
            ))
        })
        .ok();

    if db_exif.is_none() {
        return Ok(false); // Photo not in database
    }

    let db = db_exif.unwrap();

    // Helper to check if update needed (file value is not empty and differs from DB)
    let needs_update = |file_val: &str, db_val: &Option<String>| -> bool {
        if file_val.is_empty() {
            return false;
        }
        match db_val {
            None => true,
            Some(db_str) => db_str.is_empty() || db_str != file_val,
        }
    };

    // Helper for datetime fields - use DateTime value object for comparison
    // This handles different date formats (2025:11:23 vs 2025/11/23) correctly
    let needs_update_datetime = |file_val: &str, db_val: &Option<String>| -> bool {
        if file_val.is_empty() {
            return false;
        }
        match db_val {
            None => true,
            Some(db_str) => {
                if db_str.is_empty() {
                    return true;
                }
                // Use DateTime value object to compare dates regardless of format
                !crate::value::date::DateTime::are_equal(file_val, db_str)
            }
        }
    };

    // Check each field for differences
    let mut updates: Vec<(&str, &str)> = Vec::new();

    if needs_update(&exif.iso, &db.0) {
        updates.push(("exif_iso", &exif.iso));
    }
    if needs_update(&exif.fnumber, &db.1) {
        updates.push(("exif_fnumber", &exif.fnumber));
    }
    // Use DateTime-aware comparison for date fields to handle format differences
    if needs_update_datetime(&exif.date_time, &db.2) {
        updates.push(("exif_date_time", &exif.date_time));
    }
    if needs_update_datetime(&exif.date_time_original, &db.3) {
        updates.push(("exif_date_time_original", &exif.date_time_original));
    }
    if needs_update(&exif.lens_model, &db.4) {
        updates.push(("exif_lens_model", &exif.lens_model));
    }
    if needs_update(&exif.make, &db.5) {
        updates.push(("exif_make", &exif.make));
    }
    if needs_update(&exif.lens_make, &db.6) {
        updates.push(("exif_lens_make", &exif.lens_make));
    }
    if needs_update(&exif.model, &db.7) {
        updates.push(("exif_model", &exif.model));
    }
    if needs_update(&exif.xresolution, &db.8) {
        updates.push(("exif_xresolution", &exif.xresolution));
    }
    if needs_update(&exif.yresolution, &db.9) {
        updates.push(("exif_yresolution", &exif.yresolution));
    }
    if needs_update(&exif.resolution_unit, &db.10) {
        updates.push(("exif_resolution_unit", &exif.resolution_unit));
    }
    if needs_update(&exif.copyright, &db.11) {
        updates.push(("exif_copyright", &exif.copyright));
    }
    if needs_update(&exif.exposure_time, &db.12) {
        updates.push(("exif_exposure_time", &exif.exposure_time));
    }
    if needs_update(&exif.shutter_speed_value, &db.13) {
        updates.push(("exif_shutter_speed_value", &exif.shutter_speed_value));
    }
    if needs_update(&exif.focal_length, &db.14) {
        updates.push(("exif_focal_length", &exif.focal_length));
    }
    if needs_update(&exif.focal_length_in35mm_film, &db.15) {
        updates.push((
            "exif_focal_length_in35mm_film",
            &exif.focal_length_in35mm_film,
        ));
    }
    if needs_update(&exif.digital_zoom_ratio, &db.16) {
        updates.push(("exif_digital_zoom_ratio", &exif.digital_zoom_ratio));
    }
    if needs_update(&exif.exposure_mode, &db.17) {
        updates.push(("exif_exposure_mode", &exif.exposure_mode));
    }
    if needs_update(&exif.white_balance_mode, &db.18) {
        updates.push(("exif_white_balance_mode", &exif.white_balance_mode));
    }
    if needs_update(&exif.orientation, &db.19) {
        updates.push(("exif_orientation", &exif.orientation));
    }

    if updates.is_empty() {
        return Ok(false);
    }

    // Build and execute UPDATE statement
    let set_clauses: Vec<String> = updates
        .iter()
        .enumerate()
        .map(|(i, (col, _))| format!("{} = ?{}", col, i + 1))
        .collect();

    let now = date::DateTime::now().to_db_string();
    let sql = format!(
        "UPDATE photo_metadata SET {}, updated_at = ?{} WHERE path = ?{}",
        set_clauses.join(", "),
        updates.len() + 1,
        updates.len() + 2
    );

    log::info!(
        target: "sqlite",
        "exif_sync_update; path={}; fields_updated={}",
        path,
        updates.iter().map(|(col, _)| *col).collect::<Vec<_>>().join(",")
    );

    // Execute with dynamic params
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = updates
        .iter()
        .map(|(_, val)| Box::new(val.to_string()) as Box<dyn rusqlite::ToSql>)
        .collect();
    params.push(Box::new(now));
    params.push(Box::new(path.to_string()));

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update EXIF: {}", e))?;

    Ok(true)
}
