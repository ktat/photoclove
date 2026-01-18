use crate::entity::photo;
use crate::repository::meta_db;
use crate::value::{exif, file};
use rusqlite::Row;

/// Create PhotoInfo from database row data without tags
pub(super) fn photo_info_from_row(
    path: String,
    date: String,
    star: i32,
    comment: String,
    css_style: Option<String>,
    google_photo_url: Option<String>,
    orientation: Option<String>,
) -> meta_db::PhotoInfo {
    meta_db::PhotoInfo {
        path,
        date,
        star,
        comment,
        css_style,
        google_photo_url,
        tags: None,
        orientation,
    }
}

/// Create PhotoInfo from database row data with tags
pub(super) fn photo_info_from_row_with_tags(
    path: String,
    date: String,
    star: i32,
    comment: String,
    css_style: Option<String>,
    google_photo_url: Option<String>,
    tags_str: Option<String>,
    orientation: Option<String>,
) -> meta_db::PhotoInfo {
    let tags = if let Some(tags_str) = tags_str {
        if tags_str.is_empty() {
            None
        } else {
            // Parse the GROUP_CONCAT result: "id:name:color,id:name:color,..."
            let parsed_tags: Vec<photo::PhotoTag> = tags_str
                .split(',')
                .filter_map(|tag_str| {
                    let parts: Vec<&str> = tag_str.split(':').collect();
                    if parts.len() >= 3 {
                        if let Ok(id) = parts[0].parse::<i32>() {
                            let name = parts[1].to_string();
                            let color = if parts[2].is_empty() {
                                None
                            } else {
                                Some(parts[2].to_string())
                            };
                            Some(photo::PhotoTag::new(id, name, color))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect();

            if parsed_tags.is_empty() {
                None
            } else {
                Some(parsed_tags)
            }
        }
    } else {
        None
    };

    let photo_info = meta_db::PhotoInfo {
        path: path.clone(),
        date,
        star,
        comment,
        css_style,
        google_photo_url,
        tags: tags.clone(),
        orientation,
    };

    log::info!(target: "database", "photo_info_created; path={}; tags_count={}; tags_data={:?}",
        path,
        tags.as_ref().map_or(0, |t| t.len()),
        tags
    );

    photo_info
}

/// Convert a database row to a Photo entity for grouping operations.
/// Simplified version that only reads columns needed for burst grouping.
/// Row must have columns in order: path, exif_make, exif_model, exif_date_time_original, burst_group_id
pub(super) fn row_to_photo_for_grouping(row: &Row) -> photo::Photo {
    let path: String = row.get(0).unwrap_or_default();
    let exif_make: Option<String> = row.get(1).unwrap_or_default();
    let exif_model: Option<String> = row.get(2).unwrap_or_default();
    let exif_date_time_original: Option<String> = row.get(3).unwrap_or_default();
    let burst_group_id: Option<String> = row.get(4).unwrap_or_default();

    // Extract file name from path
    let file_name = path.split('/').last().unwrap_or(&path).to_string();

    let file_obj = file::File {
        name: file_name,
        path: path,
        dir: String::new(),
        created_at: String::new(),
        is_link: false,
    };

    // Create minimal ExifData with just the fields needed for grouping
    let exif_data = exif::ExifData {
        date_time: String::new(),
        date_time_original: exif_date_time_original.unwrap_or_default(),
        make: exif_make.unwrap_or_default(),
        model: exif_model.unwrap_or_default(),
        fnumber: String::new(),
        iso: String::new(),
        exposure_time: String::new(),
        focal_length: String::new(),
        lens_model: String::new(),
        lens_make: String::new(),
        xresolution: String::new(),
        yresolution: String::new(),
        resolution_unit: String::new(),
        copyright: String::new(),
        shutter_speed_value: String::new(),
        focal_length_in35mm_film: String::new(),
        digital_zoom_ratio: String::new(),
        exposure_mode: String::new(),
        white_balance_mode: String::new(),
        orientation: String::new(),
    };

    photo::Photo::from_db_row(
        file_obj,
        exif_data,
        None,
        None,
        burst_group_id,
    )
}
