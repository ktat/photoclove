use crate::entity::photo;
use crate::repository::meta_db;

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
