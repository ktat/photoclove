//! Unknown Faces Operations
//!
//! Database operations for managing unknown (unassigned) faces.

use super::types::UnknownFaceRecord;
use super::super::SQLite;
use crate::entity::{config, photo};
use crate::value::file;

/// Get count of unknown (unassigned) faces
pub fn get_unknown_faces_count(sqlite: &SQLite) -> Result<i64, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM detected_faces WHERE person_id IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count unknown faces: {}", e))?;

    Ok(count)
}

/// Get unknown (unassigned) faces with pagination
/// Sorted by detection time (newest first)
pub fn get_unknown_faces(
    sqlite: &SQLite,
    limit: u32,
    offset: u32,
) -> Result<Vec<UnknownFaceRecord>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT df.id, pm.path, df.bbox_x, df.bbox_y, df.bbox_width, df.bbox_height,
                    df.confidence, df.created_at
             FROM detected_faces df
             JOIN photo_detected_faces pdf ON df.id = pdf.detected_face_id
             JOIN photo_metadata pm ON pdf.photo_id = pm.id
             WHERE df.person_id IS NULL
             ORDER BY df.created_at DESC
             LIMIT ? OFFSET ?",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let faces = stmt
        .query_map([limit, offset], |row| {
            Ok(UnknownFaceRecord {
                id: row.get(0)?,
                photo_path: row.get(1)?,
                bbox_x: row.get(2)?,
                bbox_y: row.get(3)?,
                bbox_width: row.get(4)?,
                bbox_height: row.get(5)?,
                confidence: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to query unknown faces: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect unknown faces: {}", e))?;

    log::debug!(
        target: "face_detection",
        "get_unknown_faces; limit={}; offset={}; count={}",
        limit,
        offset,
        faces.len()
    );

    Ok(faces)
}

/// Get full photo objects for photos containing unknown faces
/// Photos are grouped by path and sorted by most recent detection time (newest first)
pub fn get_photos_for_unknown_faces_full(
    sqlite: &SQLite,
    sort_value: i32,
    config: Option<config::Config>,
) -> Result<Vec<photo::Photo>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Database error: {}", e))?;

    // Sort order: default is detection time DESC, but can be overridden
    let order_clause = match sort_value {
        1 => "ORDER BY pm.photo_date ASC",
        2 => "ORDER BY pm.photo_date DESC",
        _ => "ORDER BY latest_detection DESC", // Default: newest detection first
    };

    let query = format!(
        "SELECT pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style,
                pm.google_photos_url, pm.exif_orientation, pm.burst_group_id,
                MAX(df.created_at) as latest_detection
         FROM photo_metadata pm
         JOIN photo_detected_faces pdf ON pm.id = pdf.photo_id
         JOIN detected_faces df ON pdf.detected_face_id = df.id
         WHERE df.person_id IS NULL
           AND (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
         GROUP BY pm.path
         {}",
        order_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let photos_data: Vec<(String, String, i32, Option<String>, Option<String>, Option<String>, Option<String>)> = stmt
        .query_map([], |row| {
            let path: String = row.get(0)?;
            let photo_date: String = row.get(1)?;
            let star: i32 = row.get::<_, i32>(2).unwrap_or(0);
            let comment: Option<String> = row.get(3)?;
            let css_style: Option<String> = row.get(4)?;
            let exif_orientation: Option<String> = row.get(6)?;
            let burst_group_id: Option<String> = row.get(7)?;

            Ok((path, photo_date, star, comment, css_style, exif_orientation, burst_group_id))
        })
        .map_err(|e| format!("Failed to query photos: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect photos: {}", e))?;

    let photo_paths: Vec<String> = photos_data.iter().map(|(path, ..)| path.clone()).collect();
    let tags_map = super::super::tags::get_tags_for_photos_bulk(sqlite, &photo_paths)
        .unwrap_or_default();

    let mut photos = Vec::new();
    for (path, photo_date, star, comment, css_style, exif_orientation, burst_group_id) in photos_data {
        let file_entity = file::File::from_relative(path.clone());
        let mut photo_entity = photo::Photo::new(file_entity, config.clone());

        photo_entity.set_time(photo_date);
        photo_entity.star = if star > 0 { Some(star) } else { None };
        photo_entity.comment = comment.filter(|c| !c.is_empty());
        photo_entity.css_style = css_style;
        photo_entity.burst_group_id = burst_group_id;

        if let Some(ref orientation) = exif_orientation {
            if !orientation.is_empty() {
                photo_entity.meta_data.orientation = orientation.clone();
            }
        }

        if let Some(photo_tags) = tags_map.get(&path) {
            if !photo_tags.is_empty() {
                let tags: Vec<photo::PhotoTag> = photo_tags.iter()
                    .map(|(id, name, color)| photo::PhotoTag::new(*id, name.clone(), color.clone()))
                    .collect();
                photo_entity.tags = Some(tags);
            }
        }

        photos.push(photo_entity);
    }

    log::info!(target: "face_detection", "get_photos_for_unknown_faces_full; sort={}; count={}",
        sort_value, photos.len());

    Ok(photos)
}
