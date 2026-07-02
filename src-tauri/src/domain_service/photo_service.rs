use crate::entity::config::RawProcessingConfig;
use crate::entity::photo;
use crate::repository::{MetaDB, MetaInfoDB};
use crate::utils::{exif_thumbnail, heic_decode, raw_decode, raw_file};
use crate::value::{comment, date, file, star};
use image_compressor::{Factor, FolderCompressor};
use regex::Regex;
use std::error::Error;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc;

pub fn photos_from_dir(files: file::Files) -> photo::Photos {
    let mut photos = photo::Photos::new();
    for file in files.files {
        let p = photo::Photo::new(file, Option::None);
        photos.photos.push(p)
    }
    photos
}

/// Scan `dir` (recursing into UUID subdirectories) into a `Photos` bundle.
///
/// This is a filesystem scan bundle for processing (thumbnails, rebuild), not a
/// display page: photos carry no DB metadata (star/comment/EXIF) and no
/// pagination is applied (`has_next`/`has_prev` stay `false`). File paths are
/// stored relative to `import_to`. `config` is embedded so `Photo::absolute_path`
/// and `Photo::get_thumbnail_path` resolve correctly.
pub fn photos_from_dir_recursive(
    dir: &file::Dir,
    import_to: &str,
    config: Option<&crate::entity::config::Config>,
) -> photo::Photos {
    let files = crate::domain_service::dir_service::find_files(dir);
    let mut photos = photo::Photos::new();
    for f in files.files {
        let relative_path = file::to_relative_path(&f.path, import_to);
        let p = photo::Photo::new(file::File::from_relative(relative_path), config.cloned());
        photos.photos.push(p);
    }
    photos
}

pub fn save_photo_star(db: &MetaDB, photo: &photo::Photo, star: star::Star) {
    db.save_star(photo, star)
}

pub fn save_photo_comment(db: &MetaDB, photo: &photo::Photo, comment: comment::Comment) {
    db.save_comment(photo, comment)
}

/// Process RAW files in a directory by extracting EXIF thumbnails.
/// For each RAW file, saves the EXIF thumbnail as `{filename_lowercase}.jpg` in the destination.
/// This runs before FolderCompressor so RAW files have thumbnails ready.
/// Falls back to full RAW decode if EXIF extraction fails and `enable_full_decode` is true.
pub fn process_raw_thumbnails(
    from: &PathBuf,
    to: &PathBuf,
    raw_config: &RawProcessingConfig,
) -> Result<usize, Box<dyn Error>> {
    let mut count = 0;

    if !from.exists() {
        return Ok(0);
    }

    // Ensure destination directory exists
    if !to.exists() {
        std::fs::create_dir_all(to)?;
    }

    // Collect directories to process: the root directory plus any subdirectories (UUID dirs)
    let mut dirs_to_process: Vec<(PathBuf, PathBuf)> = Vec::new();
    dirs_to_process.push((from.clone(), to.clone()));

    let entries = std::fs::read_dir(from)?;
    for entry in entries {
        let entry = entry?;
        if entry.path().is_dir() {
            let sub_dir_name = entry.file_name();
            let sub_from = from.join(&sub_dir_name);
            let sub_to = to.join(&sub_dir_name);
            dirs_to_process.push((sub_from, sub_to));
        }
    }

    for (dir_from, dir_to) in &dirs_to_process {
        if !dir_from.exists() {
            continue;
        }
        if !dir_to.exists() {
            std::fs::create_dir_all(dir_to)?;
        }

        let dir_entries = std::fs::read_dir(dir_from)?;
        for entry in dir_entries {
            let entry = entry?;
            let file_name = entry.file_name();
            let file_name_str = file_name.to_string_lossy();
            let file_path = entry.path();

            let is_raw = file_path.is_file() && raw_file::is_raw_file(&file_name_str);
            let is_heic_avif = file_path.is_file() && raw_file::is_heic_or_avif(&file_name_str);

            if !is_raw && !is_heic_avif {
                continue;
            }

            // Thumbnail naming: photo.CR2 -> photo.cr2.jpg (lowercase + .jpg)
            let thumbnail_name = format!("{}.jpg", file_name_str.to_lowercase());
            let thumbnail_path = dir_to.join(&thumbnail_name);

            if thumbnail_path.exists() {
                log::debug!(
                    target: "photo_service",
                    "non_native_thumbnail_exists; file={}; thumbnail={}",
                    file_name_str, thumbnail_path.display()
                );
                continue;
            }

            // Try EXIF thumbnail extraction (works for both RAW and HEIC/AVIF)
            if let Some((img, width, height)) = exif_thumbnail::extract_exif_thumbnail(&file_path) {
                if img
                    .save_with_format(&thumbnail_path, image::ImageFormat::Jpeg)
                    .is_ok()
                {
                    count += 1;
                    log::info!(
                        target: "photo_service",
                        "non_native_thumbnail_created; file={}; thumbnail={}; size={}x{}",
                        file_name_str, thumbnail_path.display(), width, height
                    );
                } else {
                    log::warn!(
                        target: "photo_service",
                        "non_native_thumbnail_save_failed; file={}; thumbnail={}",
                        file_name_str, thumbnail_path.display()
                    );
                }
            } else if is_heic_avif {
                // HEIC/AVIF: decode with libheif as fallback
                log::info!(
                    target: "photo_service",
                    "heic_exif_not_found; trying_heic_decode; file={}",
                    file_name_str
                );
                let max_size = raw_config.max_decode_size;
                if let Some((img, width, height)) =
                    heic_decode::decode_heic_to_image(file_path.to_str().unwrap_or(""), max_size)
                {
                    if img
                        .save_with_format(&thumbnail_path, image::ImageFormat::Jpeg)
                        .is_ok()
                    {
                        count += 1;
                        log::info!(
                            target: "photo_service",
                            "heic_decode_thumbnail_created; file={}; thumbnail={}; size={}x{}",
                            file_name_str, thumbnail_path.display(), width, height
                        );
                    } else {
                        log::warn!(
                            target: "photo_service",
                            "heic_decode_thumbnail_save_failed; file={}",
                            file_name_str
                        );
                    }
                } else {
                    log::warn!(
                        target: "photo_service",
                        "heic_decode_failed; file={}",
                        file_name_str
                    );
                }
            } else if raw_config.enable_full_decode {
                // RAW: full decode as fallback
                log::info!(
                    target: "photo_service",
                    "raw_exif_not_found; trying_raw_decode; file={}",
                    file_name_str
                );
                let max_size = raw_config.max_decode_size;
                if let Some((img, width, height)) = raw_decode::decode_raw_to_thumbnail_with_limit(
                    file_path.to_str().unwrap_or(""),
                    max_size,
                    raw_config.memory_limit_mb,
                ) {
                    if img
                        .save_with_format(&thumbnail_path, image::ImageFormat::Jpeg)
                        .is_ok()
                    {
                        count += 1;
                        log::info!(
                            target: "photo_service",
                            "raw_decode_thumbnail_created; file={}; thumbnail={}; size={}x{}",
                            file_name_str, thumbnail_path.display(), width, height
                        );
                    } else {
                        log::warn!(
                            target: "photo_service",
                            "raw_decode_thumbnail_save_failed; file={}",
                            file_name_str
                        );
                    }
                } else {
                    log::warn!(
                        target: "photo_service",
                        "raw_decode_failed; file={}",
                        file_name_str
                    );
                }
            } else {
                log::info!(
                    target: "photo_service",
                    "full_decode_disabled; file={}",
                    file_name_str
                );
            }
        }
    } // end dirs_to_process loop

    Ok(count)
}

/// Generate thumbnails for videos under `date_dir`, recursing into UUID
/// subdirectories. Reuses `Photo::get_thumbnail_path` for the output location
/// (which already mirrors the `{date}/{uuid}/{file}.jpg` layout) and
/// `Photo::absolute_path` for the source. Existing thumbnails are skipped so
/// re-runs do not re-invoke ffmpeg on large video files.
fn generate_video_thumbnails(date_dir: &Path, config: &crate::entity::config::Config) {
    let dir = file::Dir::new(date_dir.display().to_string());
    let photos = photos_from_dir_recursive(&dir, &config.import_to, Some(config));

    for photo in photos.photos {
        if !photo.is_video() {
            continue;
        }
        let Some(thumbnail_path) = photo.get_thumbnail_path() else {
            continue;
        };
        if Path::new(&thumbnail_path).exists() {
            log::debug!(target: "photo_service", "video_thumbnail; status=skip_exists; path={}", thumbnail_path);
            continue;
        }
        if let Some(parent) = Path::new(&thumbnail_path).parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                log::error!(target: "photo_service", "video_thumbnail_mkdir_failed; dir={}; error={}", parent.display(), e);
                continue;
            }
        }
        let source = photo.absolute_path();
        log::info!(target: "photo_service", "video_thumbnail; source={}; target={}", source, thumbnail_path);
        // `-ss` before `-i` uses fast input seeking, essential for multi-GB videos.
        let output = Command::new("ffmpeg")
            .arg("-ss")
            .arg("00:00:01.000")
            .arg("-i")
            .arg(&source)
            .arg("-vframes")
            .arg("1")
            .arg(&thumbnail_path)
            .output();
        match output {
            Ok(o) if o.status.success() => {
                log::info!(target: "photo_service", "video_thumbnail; status=success; path={}", thumbnail_path);
            }
            Ok(o) => {
                log::error!(target: "photo_service", "video_thumbnail_error; source={}; target={}; stderr={}", source, thumbnail_path, String::from_utf8_lossy(&o.stderr));
            }
            Err(e) => {
                log::error!(target: "photo_service", "ffmpeg_error; error={:?}", e);
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn create_thumbnails(
    dates: date::Dates,
    origin: &Path,
    dest: &Path,
    thread_count: u32,
    quolity: f32,
    size_ratio: f32,
    ignore_file_size: u32,
    raw_config: Option<&RawProcessingConfig>,
) -> Result<(), Box<dyn Error>> {
    let mut last_result: Result<(), Box<dyn Error>> = Result::Ok(());
    let re = Regex::new(r"\.(?i:jpe?g)$").unwrap();
    // Config whose import_to/thumbnail_store match the caller's origin/dest, so
    // Photo path helpers resolve to exactly these locations.
    let mut photo_config = crate::entity::config::Config::new();
    photo_config.import_to = origin.display().to_string();
    photo_config.thumbnail_store = dest.display().to_string();
    for date in dates.dates {
        log::info!(target: "photo_service", "thumbnail_creation; date={}", date);
        let (tx, _tr) = mpsc::channel(); // Sender and Receiver. for more info, check mpsc and message passing.
        let from = origin.join(date.to_string());
        let to = dest.join(date.to_string());

        // Process RAW files first (extract EXIF thumbnails before FolderCompressor runs)
        let default_raw_config = RawProcessingConfig::default();
        let raw_cfg = raw_config.unwrap_or(&default_raw_config);
        match process_raw_thumbnails(&from, &to, raw_cfg) {
            Ok(count) => {
                if count > 0 {
                    log::info!(target: "photo_service", "raw_thumbnails_processed; date={}; count={}", date, count);
                }
            }
            Err(e) => {
                log::warn!(target: "photo_service", "raw_thumbnail_processing_error; date={}; error={}", date, e);
            }
        }

        let mut comp = FolderCompressor::new(from.clone(), to.clone());
        let factor = Factor::new(quolity * 100_f32, size_ratio);
        comp.set_factor(factor);
        comp.set_thread_count(thread_count);
        comp.set_sender(tx);
        let r = comp.compress();
        match r {
            Ok(_ret) => {
                last_result = r;
                let ignore_file_size = ignore_file_size as u64;
                log::info!(target: "photo_service", "thumbnail_processing; from={:?}; to={:?}", from, to);
                let entries = std::fs::read_dir(&from)?;
                for entry in entries {
                    let entry = entry?;
                    let file_name = entry.file_name();
                    let extension = entry
                        .path()
                        .extension()
                        .map(|ext| ext.to_string_lossy().to_lowercase());
                    if let Some(ext) = extension {
                        if ext == "jpg" || ext == "jpeg" {
                            let file_size = entry.metadata()?.len();
                            let file_name_str = file_name.to_string_lossy();
                            let ext_with_dot = format!(".{}", ext);
                            let new_file_name = re.replace(&file_name_str, &ext_with_dot);
                            let new_file_path = to.join(new_file_name.as_ref());
                            if new_file_path.exists() {
                                if file_size < ignore_file_size {
                                    log::info!(target: "photo_service", "thumbnail_cleanup; reason=mini_size; source={:?}; target={:?}; file_size={}; threshold={}", entry.path().to_string_lossy(), new_file_path.clone(), file_size, ignore_file_size);
                                    std::fs::remove_file(new_file_path)?;
                                } else if new_file_path.exists() {
                                    let thumbnail_file_size =
                                        std::path::Path::new(&new_file_path).metadata()?.len();
                                    if thumbnail_file_size == file_size {
                                        log::info!(target: "photo_service", "thumbnail_cleanup; reason=same_size; target={:?}", new_file_path.clone());
                                        std::fs::remove_file(new_file_path)?;
                                    }
                                }
                            } else {
                                log::debug!(target: "photo_service", "thumbnail_status; file={:?}; status=not_exists", new_file_path);
                            }
                        }
                    }
                }

                // Generate video thumbnails, recursing into UUID subdirectories and
                // mirroring the layout into the thumbnail destination.
                generate_video_thumbnails(&from, &photo_config);

                // Clean up RAW files copied by FolderCompressor (it copies them as-is)
                // Walk through destination directory and subdirectories
                fn cleanup_raw_copies(dir: &PathBuf) {
                    if let Ok(entries) = std::fs::read_dir(dir) {
                        for entry in entries.filter_map(|e| e.ok()) {
                            let path = entry.path();
                            if path.is_dir() {
                                cleanup_raw_copies(&path);
                            } else if raw_file::is_raw_file(&path.to_string_lossy()) {
                                log::info!(target: "photo_service", "thumbnail_cleanup_raw; path={}", path.display());
                                let _ = std::fs::remove_file(&path);
                            }
                        }
                    }
                }
                cleanup_raw_copies(&to);

                log::info!(target: "photo_service", "thumbnail_creation; status=success");
            }
            Err(ref e) => {
                log::error!(target: "photo_service", "thumbnail_creation_error; error={}", e);
                return r;
            }
        }
    }

    last_result
}

#[cfg(test)]
mod tests {
    use crate::domain_service::{dir_service, photo_service};
    use crate::value::file;
    use std::path::Path;

    #[test]
    fn test_make_photos() {
        let path = Path::new("tests/assets/files");
        let dir = file::Dir::new(path.display().to_string());
        let files = dir_service::find_files(&dir);
        let photos = photo_service::photos_from_dir(files);
        assert_eq!(photos.photos.len(), 3)
    }

    #[test]
    fn test_photos_from_dir_recursive_includes_uuid_subdir() {
        use std::fs;
        let tmp = tempfile::tempdir().unwrap();
        let base = tmp.path();
        let uuid = "caa83a09-5960-46f1-90f1-6bc0769eb42f";
        let date_dir = base.join("2026-06-29");
        let uuid_dir = date_dir.join(uuid);
        fs::create_dir_all(&uuid_dir).unwrap();
        fs::write(uuid_dir.join("video.mp4"), b"x").unwrap();
        fs::write(date_dir.join("top.jpg"), b"x").unwrap();

        let dir = file::Dir::new(date_dir.display().to_string());
        let photos = photo_service::photos_from_dir_recursive(
            &dir,
            &base.display().to_string(),
            None,
        );

        let paths: Vec<String> = photos.photos.iter().map(|p| p.file.path.clone()).collect();
        assert!(paths.iter().any(|p| p == "2026-06-29/caa83a09-5960-46f1-90f1-6bc0769eb42f/video.mp4"));
        assert!(paths.iter().any(|p| p == "2026-06-29/top.jpg"));
        assert!(!photos.has_next && !photos.has_prev);
    }
}
