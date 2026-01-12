//! Filter options retrieval for SQLite repository
//!
//! This module provides functions to get available options for filter dropdowns
//! (cameras, lenses, file extensions).

use super::SQLite;

/// Get camera options for filter dropdown
pub fn get_camera_options(sqlite: &SQLite) -> Result<String, String> {
    let conn = sqlite.get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "
        SELECT
            exif_make,
            exif_model,
            COUNT(*) as count
        FROM photo_metadata
        WHERE exif_make IS NOT NULL AND exif_model IS NOT NULL
        GROUP BY exif_make, exif_model
        ORDER BY count DESC
    ",
        )
        .map_err(|e| e.to_string())?;

    let camera_iter = stmt
        .query_map([], |row| {
            let make: String = row.get("exif_make")?;
            let model: String = row.get("exif_model")?;
            let count: i64 = row.get("count")?;

            let id = format!(
                "{}_{}",
                make.replace(" ", "_").to_lowercase(),
                model.replace(" ", "_").to_lowercase()
            );

            log::debug!(
                target: "database",
                "camera_option_created; make={}; model={}; id={}; count={}",
                make, model, id, count
            );

            Ok(serde_json::json!({
                "id": id,
                "make": make,
                "model": model,
                "count": count
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut cameras: Vec<serde_json::Value> = Vec::new();
    for camera in camera_iter {
        cameras.push(camera.map_err(|e| e.to_string())?);
    }

    // Count photos with unknown camera info (NULL or empty make/model)
    let unknown_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM photo_metadata
             WHERE exif_make IS NULL OR exif_model IS NULL
                OR exif_make = '' OR exif_model = ''",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Add "Unknown" option if there are photos with unknown camera
    if unknown_count > 0 {
        cameras.push(serde_json::json!({
            "id": "unknown",
            "make": "Unknown",
            "model": "Camera",
            "count": unknown_count
        }));
    }

    log::debug!(
        target: "database",
        "camera_options_generated; camera_count={}; unknown_count={}; sample_cameras=[{}]",
        cameras.len(),
        unknown_count,
        cameras.iter().take(3).map(|c| format!("{:?}", c)).collect::<Vec<_>>().join(", ")
    );

    serde_json::to_string(&cameras).map_err(|e| e.to_string())
}

/// Get lens options for filter dropdown
pub fn get_lens_options(sqlite: &SQLite) -> Result<String, String> {
    let conn = sqlite.get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "
        SELECT
            exif_lens_model,
            COUNT(*) as count
        FROM photo_metadata
        WHERE exif_lens_model IS NOT NULL AND exif_lens_model != ''
        GROUP BY exif_lens_model
        ORDER BY count DESC
    ",
        )
        .map_err(|e| e.to_string())?;

    let lens_iter = stmt
        .query_map([], |row| {
            let model: String = row.get("exif_lens_model")?;
            let count: i64 = row.get("count")?;

            Ok(serde_json::json!({
                "id": model.replace(" ", "_").to_lowercase(),
                "model": model,
                "count": count
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut lenses: Vec<serde_json::Value> = Vec::new();
    for lens in lens_iter {
        lenses.push(lens.map_err(|e| e.to_string())?);
    }

    serde_json::to_string(&lenses).map_err(|e| e.to_string())
}

/// Get extension options for filter dropdown
pub fn get_extension_options(sqlite: &SQLite) -> Result<String, String> {
    let conn = sqlite.get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "
        SELECT
            LOWER(SUBSTR(path, INSTR(path, '.') + 1)) as extension,
            COUNT(*) as count
        FROM photo_metadata
        WHERE INSTR(path, '.') > 0
        GROUP BY extension
        ORDER BY count DESC
    ",
        )
        .map_err(|e| e.to_string())?;

    let extension_iter = stmt
        .query_map([], |row| {
            let extension: String = row.get("extension")?;
            let count: i64 = row.get("count")?;

            Ok(serde_json::json!({
                "extension": extension,
                "count": count
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut extensions: Vec<serde_json::Value> = Vec::new();
    for extension in extension_iter {
        extensions.push(extension.map_err(|e| e.to_string())?);
    }

    serde_json::to_string(&extensions).map_err(|e| e.to_string())
}
