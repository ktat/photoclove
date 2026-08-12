//! Photo metadata recording and retrieval operations for SQLite repository

use super::{date_summary, utils, SQLite};
use crate::entity::{photo, photo_meta};
use crate::value::{comment, date, file, star};
use rusqlite::params;
use std::collections::{HashMap, HashSet};

/// Record photo metadata from PhotoMetas collection
#[allow(dead_code)]
pub fn record_photo_metas(
    sqlite: &SQLite,
    _info_path: std::path::PathBuf,
    photo_metas: photo_meta::PhotoMetas,
) -> Result<bool, &'static str> {
    let conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database")?;
    let mut stmt = conn
        .prepare("INSERT OR REPLACE INTO photo_metadata (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                 exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                 exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                 exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28)")
        .map_err(|_| "Failed to prepare statement")?;

    let now = date::DateTime::now().to_db_string();
    for (path, meta) in photo_metas.iter() {
        stmt.execute(params![
            path,
            meta.photo_time(),
            meta.star.star(),
            meta.comment.comment(),
            now,
            now,
            None::<String>,
            // EXIF fields as NULL for now since PhotoMeta doesn't have them
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            None::<String>,
            // CSS style field
            None::<String>
        ])
        .map_err(|_| "Failed to execute statement")?;
    }

    Ok(true)
}

/// Fetch the subset of `paths` that already exist in `photo_metadata`, in a
/// single SQL round-trip. Existing rows are skipped (not re-inserted), so only
/// their presence matters. Chunks the IN clause to stay under SQLite's
/// parameter limit.
fn fetch_existing_paths(
    conn: &rusqlite::Connection,
    paths: &[String],
) -> Result<HashSet<String>, rusqlite::Error> {
    let mut existing: HashSet<String> = HashSet::with_capacity(paths.len());
    if paths.is_empty() {
        return Ok(existing);
    }
    const CHUNK: usize = 500;
    for chunk in paths.chunks(CHUNK) {
        let placeholders = std::iter::repeat_n("?", chunk.len())
            .collect::<Vec<_>>()
            .join(",");
        let query = format!(
            "SELECT path FROM photo_metadata WHERE path IN ({})",
            placeholders
        );
        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(chunk.iter()), |row| {
            row.get::<_, String>(0)
        })?;
        for r in rows {
            existing.insert(r?);
        }
    }
    Ok(existing)
}

/// Record photo metadata from Photos collection (with EXIF data).
///
/// Performance notes:
/// - Skips files whose path already exists in `photo_metadata` (rows are not
///   re-read from disk and no INSERT is issued). To force a refresh, delete
///   the row first.
/// - All INSERTs are wrapped in a single transaction (one fsync per batch).
/// - Disk existence checks and EXIF parsing happen in a first pass BEFORE the
///   transaction is opened, so the write lock is only held around the tight
///   INSERT loop (not the per-file I/O).
pub fn record_photos_meta_data(
    sqlite: &SQLite,
    photos: Vec<photo::Photo>,
) -> Result<usize, &'static str> {
    if photos.is_empty() {
        return Ok(0);
    }

    let mut conn = sqlite
        .get_connection()
        .map_err(|_| "Failed to connect to database")?;

    // Pre-fetch which input paths already exist, in one round-trip.
    let input_paths: Vec<String> = photos.iter().map(|p| p.file.path.clone()).collect();
    let existing_paths = fetch_existing_paths(&conn, &input_paths).map_err(|e| {
        log::error!(target: "sqlite", "prefetch_existing_paths_failed; error={}", e);
        "Failed to pre-fetch existing paths"
    })?;

    let now = date::DateTime::now().to_db_string();
    let import_to = crate::entity::config::Config::new().import_to;
    let date_re =
        regex::Regex::new(r"^(\d{4})-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|30|31)$").unwrap();

    // Pass 1 (no open transaction): perform all disk existence checks and EXIF
    // parsing here, so the write transaction below is not held open across
    // per-file I/O (which would block other readers/writers for the whole scan).
    // Only new paths (not already in the DB) are processed; existing rows are
    // skipped and never re-read or re-inserted.
    let mut prepared: Vec<(photo::Photo, String)> = Vec::new();
    let mut skipped_existing = 0usize;
    for mut photo in photos {
        if existing_paths.contains(&photo.file.path) {
            skipped_existing += 1;
            continue;
        }

        // Load EXIF (photos) or probe metadata (videos) from absolute path on disk
        let abs_path = file::to_absolute_path(&photo.file.path, &import_to);
        if let Some(abs_file) = file::File::new_if_exists(abs_path) {
            let is_video = photo.is_video();
            let (meta, _) = crate::value::video_metadata::load_exif_for_file(is_video, abs_file);
            photo.embed_exif(meta);
        }

        // Extract date from relative path (first component is the date directory)
        let date = {
            let first_component = photo
                .file
                .path
                .trim_start_matches('/')
                .split('/')
                .next()
                .unwrap_or("");
            if date_re.is_match(first_component) {
                format!("{} 00:00:00", first_component)
            } else {
                // Fallback: try Dir::to_date on the dir field
                match photo.dir.to_date() {
                    Some(d) => {
                        let date_str = d.to_string();
                        if date_str.contains(' ') {
                            date_str
                        } else {
                            format!("{} 00:00:00", date_str)
                        }
                    }
                    None => {
                        log::warn!(target: "sqlite", "photo_skip; reason=missing_date; file={}; dir={}", photo.file.path, photo.dir.path);
                        continue;
                    }
                }
            }
        };

        prepared.push((photo, date));
    }

    // Pass 2: open the write transaction only around the tight INSERT loop.
    // ON CONFLICT(path) DO NOTHING: a row may have appeared (another writer)
    // between the prefetch above and this insert. Never REPLACE it — that would
    // reset a concurrently-written row's star/comment/created_at. `inserted`
    // counts rows actually written (execute() returns 0 on conflict).
    let mut inserted = 0usize;
    let tx = conn
        .transaction()
        .map_err(|_| "Failed to begin transaction")?;
    {
        let mut stmt = tx
            .prepare("INSERT INTO photo_metadata (path, photo_date, star, comment, created_at, updated_at, google_photos_url,
                 exif_iso, exif_fnumber, exif_date_time, exif_date_time_original, exif_lens_model, exif_make, exif_lens_make, exif_model,
                 exif_xresolution, exif_yresolution, exif_resolution_unit, exif_copyright, exif_exposure_time, exif_shutter_speed_value,
                 exif_focal_length, exif_focal_length_in35mm_film, exif_digital_zoom_ratio, exif_exposure_mode, exif_white_balance_mode, exif_orientation, css_style)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28)
                 ON CONFLICT(path) DO NOTHING")
            .map_err(|_| "Failed to prepare statement")?;

        // New paths have no existing row, so star/comment default to 0 / "".
        for (photo, date) in prepared {
            let exif = &photo.meta_data;

            let changed = stmt.execute(params![
                photo.file.path,
                date,
                0i32,
                String::new(),
                now,
                now,
                None::<String>,
                // EXIF fields
                if exif.iso.is_empty() { None } else { Some(exif.iso.clone()) },
                if exif.fnumber.is_empty() { None } else { Some(exif.fnumber.clone()) },
                if exif.date_time.is_empty() { None } else { Some(exif.date_time.clone()) },
                if exif.date_time_original.is_empty() { None } else { Some(exif.date_time_original.clone()) },
                if exif.lens_model.is_empty() { None } else { Some(exif.lens_model.clone()) },
                if exif.make.is_empty() { None } else { Some(exif.make.clone()) },
                if exif.lens_make.is_empty() { None } else { Some(exif.lens_make.clone()) },
                if exif.model.is_empty() { None } else { Some(exif.model.clone()) },
                if exif.xresolution.is_empty() { None } else { Some(exif.xresolution.clone()) },
                if exif.yresolution.is_empty() { None } else { Some(exif.yresolution.clone()) },
                if exif.resolution_unit.is_empty() { None } else { Some(exif.resolution_unit.clone()) },
                if exif.copyright.is_empty() { None } else { Some(exif.copyright.clone()) },
                if exif.exposure_time.is_empty() { None } else { Some(exif.exposure_time.clone()) },
                if exif.shutter_speed_value.is_empty() { None } else { Some(exif.shutter_speed_value.clone()) },
                if exif.focal_length.is_empty() { None } else { Some(exif.focal_length.clone()) },
                if exif.focal_length_in35mm_film.is_empty() { None } else { Some(exif.focal_length_in35mm_film.clone()) },
                if exif.digital_zoom_ratio.is_empty() { None } else { Some(exif.digital_zoom_ratio.clone()) },
                if exif.exposure_mode.is_empty() { None } else { Some(exif.exposure_mode.clone()) },
                if exif.white_balance_mode.is_empty() { None } else { Some(exif.white_balance_mode.clone()) },
                if exif.orientation.is_empty() { None } else { Some(exif.orientation.clone()) },
                // CSS style field - default to None for now
                None::<String>
            ])
            .map_err(|e| {
                log::error!(target: "sqlite", "db_statement_error; file={}; error={}", photo.file.path, e);
                "Failed to execute statement"
            })?;

            inserted += changed;
            if changed == 0 {
                log::debug!(target: "sqlite", "photo_metadata_insert; file={}; status=skipped_conflict", photo.file.path);
            } else {
                log::debug!(target: "sqlite", "photo_metadata_insert; file={}; date={}", photo.file.path, date);
            }
        }
    }

    tx.commit().map_err(|_| "Failed to commit transaction")?;

    log::info!(target: "sqlite", "photo_metadata_batch; inputs={}; inserted={}; skipped_existing={}", input_paths.len(), inserted, skipped_existing);

    // Update date_summary only when something actually changed.
    if inserted > 0 {
        log::info!(target: "date_summary", "batch_insert_completed; rebuilding_summary=true");
        let _ = date_summary::rebuild_date_summary(sqlite);
    } else {
        log::debug!(target: "date_summary", "batch_insert_completed; rebuilding_summary=false; reason=no_inserts");
    }

    Ok(inserted)
}

/// Record all photo metadata for given dates.
/// Returns `(per-date total photo count, total rows newly inserted)`.
pub fn record_photos_all_meta_data(
    sqlite: &SQLite,
    dates: date::Dates,
) -> Result<(HashMap<String, usize>, usize), &'static str> {
    let mut date_num: HashMap<String, usize> = HashMap::new();
    let mut total_inserted: usize = 0;
    let import_to = crate::entity::config::Config::new().import_to;

    for date in dates.dates {
        let date_dir = file::Dir::new(format!("{}/{}", import_to, date));
        let files = crate::domain_service::dir_service::find_files(&date_dir);

        // Convert absolute file paths to relative paths for DB storage
        let mut relative_files = file::Files::new();
        for f in files.files {
            let relative_path = file::to_relative_path(&f.path, &import_to);
            relative_files
                .files
                .push(file::File::from_relative(relative_path));
        }

        let photos = crate::domain_service::photo_service::photos_from_dir(relative_files);

        date_num.insert(date.to_string(), photos.photos.len());

        // Get existing photo paths from database by relative directory pattern
        let relative_date_dir = date.to_string();
        let existing_photos = sqlite
            .get_photo_paths_in_directory(&relative_date_dir)
            .unwrap_or_default();

        // Create a set of current relative file paths from filesystem
        let current_paths: std::collections::HashSet<String> =
            photos.photos.iter().map(|p| p.file.path.clone()).collect();

        // Delete photos from database that are no longer in filesystem
        for path in existing_photos.iter() {
            if !current_paths.contains(path) {
                log::info!(target: "sqlite", "orphaned_photo_delete; path={}", path);
                sqlite.delete_photo_by_path(path);
            }
        }

        match record_photos_meta_data(sqlite, photos.photos) {
            Ok(inserted) => total_inserted += inserted,
            Err(e) => {
                log::error!(target: "sqlite", "photo_recording_error; date={}; error={:?}", date, e);
            }
        }
    }

    Ok((date_num, total_inserted))
}

/// The capture times the database already holds for one date directory, keyed
/// by library-relative path.
///
/// Exists for the move-by-EXIF-date job, which must not re-derive a video's
/// date from its container. A container's `creation_time` does not say which
/// clock it was read from - a Panasonic DMC-GX8 writes local time labelled
/// UTC while a DC-G9M2 and a DJI Osmo Action write true UTC, and no tag tells
/// them apart - so trusting the probe would physically move a GX8-era clip
/// into the next day's directory.
///
/// A row with no EXIF date falls back to its `photo_date`, which is the
/// directory the file already sits in, so such a file simply stays put rather
/// than moving on a guess.
pub fn get_stored_capture_times(
    sqlite: &SQLite,
    date: date::Date,
) -> Result<HashMap<String, String>, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let prefix = format!("{}/", date);
    let mut stmt = conn
        .prepare(
            "SELECT path, COALESCE(exif_date_time_original, exif_date_time, photo_date)
               FROM photo_metadata
              WHERE path LIKE ?1",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    // `photo_date` is NOT NULL, so the COALESCE resolves today. Reading it as
    // `Option` anyway keeps one dateless row from failing the whole query and,
    // through the caller's empty-map fallback, freezing every file in the
    // directory - a cheap guard against that constraint being relaxed.
    let rows = stmt
        .query_map(params![format!("{}%", prefix)], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            ))
        })
        .map_err(|e| format!("Failed to query capture times: {}", e))?;

    let mut times = HashMap::new();
    for row in rows {
        let (path, time) = row.map_err(|e| format!("Failed to read capture time: {}", e))?;
        // Keyed by the whole relative path, not by file name: the move job
        // descends into an import's UUID subdirectory, where two imports of
        // the same card carry the same name.
        if !time.is_empty() {
            times.insert(path, time);
        }
    }
    Ok(times)
}

/// Get photo metadata for a specific date
pub fn get_photo_meta_data_in_date(
    sqlite: &SQLite,
    date: date::Date,
) -> Result<photo_meta::PhotoMetas, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    // Use range query instead of date() function to utilize index
    // photo_date format: "YYYY-MM-DD HH:MM:SS"
    // Range: "YYYY-MM-DD 00:00:00" <= photo_date < "YYYY-MM-DD+1 00:00:00"
    let date_str = date.to_string();
    let next_date_str = date
        .next_day()
        .map(|d| d.to_string())
        .unwrap_or_else(|| "2099-12-31".to_string());
    let next_date = format!("{} 00:00:00", next_date_str);

    // Simple, index-friendly range query. The previous version LEFT JOINed
    // tags with GROUP BY pm.path, which forced SQLite to scan the whole
    // table in primary-key order (measured on the real library: 5.0s for a
    // 382-photo date over 66k rows on NFS, vs 0.03s for this range query).
    // Tags are hydrated with one bulk query instead.
    let query_sql = "SELECT path, COALESCE(exif_date_time_original, exif_date_time, photo_date) as photo_time, star, comment, css_style, google_photos_url, exif_orientation, storage_sync
                 FROM photo_metadata
                 WHERE photo_date >= ?1 AND photo_date < ?2 AND (delete_flg = 0 OR delete_flg IS NULL)";

    log::info!(target: "database", "get_photo_meta_data_in_date_query; date={}; next_date={}", date_str, next_date);

    let mut stmt = conn
        .prepare(query_sql)
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let date_start = format!("{} 00:00:00", date_str);
    let rows = stmt
        .query_map(params![date_start, next_date], |row| {
            Ok(utils::photo_info_from_row(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|e| format!("Failed to parse row: {}", e))?);
    }

    let paths: Vec<String> = records.iter().map(|r| r.path.clone()).collect();
    let tags_map = super::tags::get_tags_for_photos_bulk(sqlite, &paths).unwrap_or_else(|e| {
        log::error!(target: "database", "in_date_bulk_tags_failed; error={}", e);
        Default::default()
    });

    let mut photo_metas = photo_meta::PhotoMetas::new();
    for mut record in records {
        if let Some(photo_tags) = tags_map.get(&record.path) {
            if !photo_tags.is_empty() {
                record.tags = Some(
                    photo_tags
                        .iter()
                        .map(|(id, name, color)| {
                            photo::PhotoTag::new(*id, name.clone(), color.clone())
                        })
                        .collect(),
                );
            }
        }
        if let Some(photo_meta) = photo_meta::PhotoMeta::new_from_photo_info(&record) {
            photo_metas.insert(&record.path.clone(), photo_meta);
        }
    }

    Ok(photo_metas)
}

const PHOTO_META_QUERY: &str =
    "SELECT path, COALESCE(exif_date_time_original, exif_date_time, photo_date) as photo_time, star, comment, css_style, google_photos_url, exif_orientation, storage_sync FROM photo_metadata WHERE path = ?1";

/// Internal helper to fetch photo info from database
fn fetch_photo_info(
    sqlite: &SQLite,
    photo_path: &str,
) -> Option<crate::repository::meta_db::PhotoInfo> {
    let conn = sqlite.get_connection().ok()?;
    let mut stmt = conn.prepare(PHOTO_META_QUERY).ok()?;

    stmt.query_row(params![photo_path], |row| {
        Ok(utils::photo_info_from_row(
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
        ))
    })
    .ok()
}

/// Get photo metadata for a specific photo
pub fn get_photo_meta(sqlite: &SQLite, photo: photo::Photo) -> photo_meta::PhotoMeta {
    match fetch_photo_info(sqlite, &photo.file.path) {
        Some(record) => photo_meta::PhotoMeta::new_from_photo_info(&record)
            .unwrap_or_else(|| photo_meta::PhotoMeta::new(photo.clone())),
        None => photo_meta::PhotoMeta::new(photo.clone()),
    }
}

/// Get photo metadata from trash
pub fn get_photo_meta_from_trash(
    sqlite: &SQLite,
    photo: photo::Photo,
    trash_path: String,
    library_path: String,
) -> photo_meta::PhotoMeta {
    match fetch_photo_info(sqlite, &photo.file.path) {
        Some(record) => photo_meta::PhotoMeta::new_from_photo_info_from_trash(
            &record,
            &trash_path,
            &library_path,
        )
        .unwrap_or_else(|| photo_meta::PhotoMeta::new(photo.clone())),
        None => photo_meta::PhotoMeta::new(photo.clone()),
    }
}

/// Get recent photos metadata
pub fn get_recent_photos_metadata(
    sqlite: &SQLite,
    limit: u32,
) -> Result<photo_meta::PhotoMetas, String> {
    let conn = sqlite
        .get_connection()
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    let query =
        "SELECT pm.*, GROUP_CONCAT(t.id || ':' || t.name || ':' || COALESCE(t.color, '')) as tags
    FROM photo_metadata pm
    LEFT JOIN photo_collection_items pt ON pm.path = pt.photo_path
    LEFT JOIN photo_collections t ON pt.collection_id = t.id
    WHERE (pm.delete_flg = 0 OR pm.delete_flg IS NULL)
    GROUP BY pm.path, pm.photo_date, pm.star, pm.comment, pm.css_style, pm.created_at
    ORDER BY pm.created_at DESC LIMIT ?";

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let rows = stmt
        .query_map([limit], |row| {
            let path: String = row.get("path")?;
            let photo_date: String = row.get("photo_date")?;
            let exif_date_time_original: Option<String> = row.get("exif_date_time_original").ok();
            let exif_date_time: Option<String> = row.get("exif_date_time").ok();
            let exif_orientation: Option<String> = row.get("exif_orientation").ok();
            let star_val: i32 = row.get("star")?;
            let comment_val: String = row.get("comment")?;

            // Use EXIF datetime if available, otherwise use photo_date
            let photo_time = exif_date_time_original
                .or(exif_date_time)
                .unwrap_or(photo_date);

            // Create photo object with relative path from DB
            let mut photo = crate::entity::photo::Photo::new(
                crate::value::file::File::from_relative(path.clone()),
                None,
            );
            photo.set_time(photo_time);
            // Set orientation from database
            if let Some(ref orientation) = exif_orientation {
                photo.meta_data.orientation = orientation.clone();
            }

            // Create photo_meta object
            let mut photo_meta = photo_meta::PhotoMeta::new(photo);

            // Set metadata fields
            photo_meta.star = star::Star::new(star_val);
            photo_meta.comment = comment::Comment::new(&comment_val);

            Ok((path, photo_meta))
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut photo_metas = photo_meta::PhotoMetas::new();
    for row in rows {
        match row {
            Ok((path, meta)) => {
                photo_metas.insert(&path, meta);
            }
            Err(e) => {
                log::warn!(target: "recent_photos", "row_processing_error; error={:?}", e);
            }
        }
    }

    Ok(photo_metas)
}

#[cfg(test)]
#[path = "photo_metadata_tests.rs"]
mod tests;
