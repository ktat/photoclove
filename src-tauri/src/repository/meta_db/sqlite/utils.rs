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
/// Row must have columns in order:
/// path, file_name, size, created, photo_date, star,
/// exif_make, exif_model, exif_date_time_original, exif_f_number,
/// exif_iso, exif_exposure_time, exif_focal_length, exif_lens,
/// exif_software, exif_gps_latitude, exif_gps_longitude,
/// exif_image_width, exif_image_height, exif_shutter_speed_value,
/// comment, delete_flg, burst_group_id, exif_orientation
pub(super) fn row_to_photo(row: &Row) -> photo::Photo {
    let path: String = row.get(0).unwrap_or_default();
    let file_name: String = row.get(1).unwrap_or_default();
    let _size: i64 = row.get(2).unwrap_or_default();
    let created: String = row.get(3).unwrap_or_default();
    let photo_date: String = row.get(4).unwrap_or_default();
    let star: i32 = row.get(5).unwrap_or_default();
    let exif_make: Option<String> = row.get(6).unwrap_or_default();
    let exif_model: Option<String> = row.get(7).unwrap_or_default();
    let exif_date_time_original: Option<String> = row.get(8).unwrap_or_default();
    let exif_f_number: Option<String> = row.get(9).unwrap_or_default();
    let exif_iso: Option<String> = row.get(10).unwrap_or_default();
    let exif_exposure_time: Option<String> = row.get(11).unwrap_or_default();
    let exif_focal_length: Option<String> = row.get(12).unwrap_or_default();
    let exif_lens: Option<String> = row.get(13).unwrap_or_default();
    let _exif_software: Option<String> = row.get(14).unwrap_or_default();
    let _exif_gps_latitude: Option<String> = row.get(15).unwrap_or_default();
    let _exif_gps_longitude: Option<String> = row.get(16).unwrap_or_default();
    let _exif_image_width: Option<i32> = row.get(17).unwrap_or_default();
    let _exif_image_height: Option<i32> = row.get(18).unwrap_or_default();
    let exif_shutter_speed_value: Option<String> = row.get(19).unwrap_or_default();
    let comment: Option<String> = row.get(20).unwrap_or_default();
    let _delete_flg: Option<i32> = row.get(21).unwrap_or_default();
    let burst_group_id: Option<String> = row.get(22).unwrap_or_default();
    let exif_orientation: Option<String> = row.get(23).unwrap_or_default();

    let file_obj = file::File {
        name: file_name,
        path: path,
        dir: String::new(),
        created_at: created,
        is_link: false,
    };

    // Create minimal ExifData with just the fields needed for grouping
    let exif_data = exif::ExifData {
        date_time: photo_date,
        date_time_original: exif_date_time_original.unwrap_or_default(),
        make: exif_make.unwrap_or_default(),
        model: exif_model.unwrap_or_default(),
        fnumber: exif_f_number.unwrap_or_default(),
        iso: exif_iso.unwrap_or_default(),
        exposure_time: exif_exposure_time.unwrap_or_default(),
        focal_length: exif_focal_length.unwrap_or_default(),
        lens_model: exif_lens.unwrap_or_default(),
        lens_make: String::new(),
        xresolution: String::new(),
        yresolution: String::new(),
        resolution_unit: String::new(),
        copyright: String::new(),
        shutter_speed_value: exif_shutter_speed_value.unwrap_or_default(),
        focal_length_in35mm_film: String::new(),
        digital_zoom_ratio: String::new(),
        exposure_mode: String::new(),
        white_balance_mode: String::new(),
        orientation: exif_orientation.unwrap_or_default(),
    };

    photo::Photo::from_db_row(
        file_obj,
        exif_data,
        Some(star),
        comment,
        burst_group_id,
    )
}
