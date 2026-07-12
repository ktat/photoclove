// just a dummy module for test

use crate::domain_service::dir_service;
use crate::entity::{config, photo, photo_meta};
use crate::repository::{self, RepoDB, RepositoryDB, Sort};
use crate::value::{date, exif, file};
use async_trait::async_trait;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;

/// Parse extension filter string into a vector of lowercase extensions
fn parse_extension_filter(extension: &str) -> Vec<String> {
    if extension == "all" || extension.is_empty() {
        vec![]
    } else {
        extension
            .split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect()
    }
}

/// Check if a file path matches the extension filter.
/// The special "other" token matches any extension not in FILTER_KNOWN_EXTENSIONS.
fn matches_extension_filter(path: &str, filters: &[String]) -> bool {
    if filters.is_empty() {
        return true;
    }
    let file_ext = path.split('.').next_back().unwrap_or("").to_lowercase();
    if filters.iter().any(|ext| ext == &file_ext) {
        return true;
    }
    if filters.iter().any(|f| f == "other")
        && !crate::utils::raw_file::FILTER_KNOWN_EXTENSIONS.contains(&file_ext.as_str())
    {
        return true;
    }
    false
}

/// Apply pagination to a photos collection
fn apply_pagination(photos: &mut photo::Photos, num: u32, page: u32, offset: usize) {
    let mut start_index = (num * (page - 1)) as usize + offset;
    let mut end_index = start_index + (num as usize);

    if !photos.photos.is_empty() {
        photos.has_next = true;

        if photos.photos.len() <= end_index {
            end_index = photos.photos.len();
            photos.has_next = false;
        }
        if start_index >= photos.photos.len() {
            start_index = photos.photos.len() - 1;
        }
        photos.photos = photos.photos[start_index..end_index].to_vec();
        if start_index > 0 {
            photos.has_prev = true;
        }
    }
}

/// Maximum threads for filesystem stat fan-out. The library often lives on
/// NFS where every stat is a network round-trip (measured: 1000 cold stats =
/// 1.7s serial, ~2ms warm), so concurrency cuts first-view latency ~10x.
const STAT_THREADS: usize = 16;
/// Below this many paths the thread setup costs more than it saves.
const STAT_PARALLEL_MIN: usize = 64;

/// Return the subset of `relative_paths` whose file exists under `base`.
/// Stats run concurrently: see STAT_THREADS.
fn existing_relative_paths<'a>(
    relative_paths: &[&'a str],
    base: &str,
) -> std::collections::HashSet<&'a str> {
    fn exists(rel: &str, base: &str) -> bool {
        std::path::Path::new(&file::to_absolute_path(rel, base)).exists()
    }

    if relative_paths.len() < STAT_PARALLEL_MIN {
        return relative_paths
            .iter()
            .filter(|rel| exists(rel, base))
            .copied()
            .collect();
    }

    let chunk_size = relative_paths.len().div_ceil(STAT_THREADS);
    let mut existing = std::collections::HashSet::with_capacity(relative_paths.len());
    std::thread::scope(|scope| {
        let handles: Vec<_> = relative_paths
            .chunks(chunk_size)
            .map(|chunk| {
                scope.spawn(move || {
                    chunk
                        .iter()
                        .filter(|rel| exists(rel, base))
                        .copied()
                        .collect::<Vec<_>>()
                })
            })
            .collect();
        for handle in handles {
            if let Ok(found) = handle.join() {
                existing.extend(found);
            }
        }
    });
    existing
}

/// Stat thumbnail existence for the photos that survived pagination.
/// Doing this before pagination costs one stat per photo in the whole
/// date instead of one per photo actually returned. Stats run concurrently:
/// see STAT_THREADS.
fn set_thumbnail_state_for_page(photos: &mut photo::Photos, has_config: bool) {
    if !has_config {
        return;
    }
    if photos.photos.len() < STAT_PARALLEL_MIN {
        for p in photos.photos.iter_mut() {
            p.set_has_thumbnail();
        }
        return;
    }

    let chunk_size = photos.photos.len().div_ceil(STAT_THREADS);
    std::thread::scope(|scope| {
        for chunk in photos.photos.chunks_mut(chunk_size) {
            scope.spawn(move || {
                for p in chunk {
                    p.set_has_thumbnail();
                }
            });
        }
    });
}

/// Create a Photo from file and metadata.
/// Thumbnail existence is NOT checked here; callers stat only the
/// returned page via set_thumbnail_state_for_page.
fn create_photo_from_metadata(
    file: file::File,
    photo_meta: &photo_meta::PhotoMeta,
    conf: Option<&config::Config>,
) -> photo::Photo {
    let mut p = match conf {
        Some(c) => photo::Photo::new(file, Some(c.clone())),
        None => photo::Photo::new(file, None),
    };

    let mut meta = exif::ExifData::empty();
    meta.date_time = photo_meta.photo_time();
    meta.orientation = photo_meta.photo().meta_data.orientation.clone();
    p.embed_exif(meta);
    p.set_css_style(photo_meta.photo().css_style.clone());
    p.set_star(photo_meta.star.star());
    p.set_comment(photo_meta.comment.comment());
    p.set_tags_from_string(photo_meta.tags_string());
    p
}

#[derive(Clone)]
pub struct Directory {
    path: file::Dir,
}

impl Directory {
    pub fn new(path: String) -> Directory {
        let dir = file::Dir::new(path);
        Directory { path: dir }
    }

    /// Build the sorted photo list once and return the photo `step` positions
    /// away from `path` (+1 = next, -1 = prev). Returns None when `path` is
    /// not in the list or the neighbor falls outside it.
    async fn get_adjacent_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
        step: i64,
    ) -> Option<photo::Photo> {
        let photos = self
            .get_photos_in_date(
                meta_data,
                date,
                sort,
                u32::MAX,
                1,
                0,
                0,
                false,
                "all",
                Option::None,
            )
            .await;
        let index = photos.photos.iter().position(|p| p.file.path == path)?;
        let target = index as i64 + step;
        if target < 0 {
            return None;
        }
        photos.photos.into_iter().nth(target as usize)
    }
}

#[async_trait]
impl RepositoryDB for Directory {
    fn connect(&self) {
        // nothing to do
    }
    fn new_connect(&self) -> RepoDB {
        // nothing to do
        RepoDB::new(self.path.path.clone())
    }
    fn get_dates(&self) -> date::Dates {
        let mut dates = date::Dates::empty();
        let dirs = dir_service::find_date_like_directories(&self.path);
        for dir in dirs.dirs {
            let d = dir.to_date();
            if let Some(date) = d {
                dates.dates.push(date)
            }
        }
        dates
            .dates
            .sort_by_key(|b| std::cmp::Reverse(b.to_string()));
        dates
    }

    fn get_photo_count_per_dates(
        &self,
        dates: date::Dates,
        meta_data: repository::DatesNum,
    ) -> crate::repository::DatesNum {
        let mut dates_num = repository::DatesNum::new();
        for date in dates.dates {
            let o = meta_data.data.get(&date.to_string());
            match o {
                Some(data) => {
                    dates_num.data.insert(date.to_string(), *data);
                }
                None => {
                    let count = self.get_photo_count_in_date(date);
                    dates_num.data.insert(date.to_string(), count);
                }
            }
        }
        dates_num
    }

    fn get_photo_count_in_date(&self, date: date::Date) -> i32 {
        let dir = self.path.child(date.to_string());
        log::debug!(target: "directory", "photo_count_check; dir={:?}", dir);
        let files = dir_service::find_files(&dir);
        files.files.len() as i32
    }

    async fn get_photos_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        date: date::Date,
        sort: Sort,
        num: u32,
        page: u32,
        offset: usize,
        star: i32,
        has_comment: bool,
        extension: &str,
        opt_conf: Option<config::Config>,
    ) -> photo::Photos {
        let _ = has_comment; // Suppress unused variable warning (filtering done by DB query)
        let dir = self.path.child(date.to_string());
        let mut photos = photo::Photos::new();
        let has_opt = opt_conf.is_some();
        let conf = opt_conf.unwrap_or_else(config::Config::template);

        // Parse extension filter using helper
        let extension_filters = parse_extension_filter(extension);

        if meta_data.keys().len() == 0 {
            let files = dir_service::find_files(&dir);
            for f in files.files {
                // Convert absolute path to relative for consistent Photo entities
                let relative_path = file::to_relative_path(&f.path, &self.path.path);
                let relative_file = file::File::from_relative(relative_path.clone());

                // Apply extension filter using helper
                if !matches_extension_filter(&relative_path, &extension_filters) {
                    continue;
                }

                let mut p: photo::Photo;
                if has_opt {
                    p = photo::Photo::new(relative_file.clone(), Option::Some(conf.clone()));
                } else {
                    p = photo::Photo::new(relative_file.clone(), Option::None);
                }
                let mut meta = exif::ExifData::empty();
                let result = meta_data.get(&relative_path);
                if let Some(photo_meta) = result {
                    meta.date_time = photo_meta.photo_time();
                    // Set orientation from photo_meta
                    meta.orientation = photo_meta.photo().meta_data.orientation.clone();
                    // Set star and comment from metadata
                    p.set_star(photo_meta.star.star());
                    p.set_comment(photo_meta.comment.comment());
                } else {
                    log::debug!(target: "directory", "photo_meta_missing; file={:?}", &relative_path);
                    meta.date_time = f.created_datetime();
                    log::debug!(target: "directory", "photo_meta_fallback; date_time={}", meta.date_time);
                    // No metadata available, use defaults
                    p.set_star(0);
                    p.set_comment("".to_string());
                }
                p.embed_exif(meta);
                photos.photos.push(p)
            }
        } else {
            // meta_data keys are relative paths.
            // Pass 1: cheap metadata filters (no I/O)
            let mut candidates: Vec<&String> = Vec::new();
            for f in meta_data.keys() {
                let md = meta_data.get(f).unwrap();
                if star > 0 && md.star.star() < star {
                    continue;
                }
                if has_comment && md.comment.comment().is_empty() {
                    continue;
                }

                // Apply extension filter using helper
                if !matches_extension_filter(f, &extension_filters) {
                    continue;
                }
                candidates.push(f);
            }

            // Pass 2: existence stats, fanned out across threads (NFS latency)
            let candidate_strs: Vec<&str> = candidates.iter().map(|s| s.as_str()).collect();
            let existing = existing_relative_paths(&candidate_strs, &self.path.path);

            // Pass 3: build Photo entities for the survivors
            for f in candidates {
                if !existing.contains(f.as_str()) {
                    log::debug!(target: "directory", "photo_file_missing; path={}", f);
                    continue;
                }
                // Use relative path for Photo entity
                let relative_file = file::File::from_relative(f.to_string());
                let mut p: photo::Photo;
                if has_opt {
                    p = photo::Photo::new(relative_file, Option::Some(conf.clone()));
                } else {
                    p = photo::Photo::new(relative_file, Option::None);
                }
                let mut meta = exif::ExifData::empty();
                let photo_meta = meta_data.get(f).unwrap();
                meta.date_time = photo_meta.photo_time();
                // Set orientation from photo_meta
                let orientation = photo_meta.photo().meta_data.orientation.clone();
                meta.orientation = orientation;
                p.embed_exif(meta);
                // Set CSS style from metadata
                p.set_css_style(photo_meta.photo().css_style.clone());
                // Set star and comment from metadata
                p.set_star(photo_meta.star.star());
                p.set_comment(photo_meta.comment.comment());
                // Set tags from metadata
                p.set_tags_from_string(photo_meta.tags_string());
                photos.photos.push(p)
            }
        }
        // Sort photos based on the specified sort type and direction
        log::info!(target: "sorting", "sort_photos; sort_type={:?}; photo_count={}", sort, photos.photos.len());
        match sort {
            // Shot time (EXIF photo time) sorts
            Sort::PhotoTimeDesc | Sort::PhotoTime => {
                log::debug!(target: "sorting", "applying_photo_time_desc_sort");
                // Log first 3 photos' time values for debugging
                if !photos.photos.is_empty() {
                    let sample_size = std::cmp::min(3, photos.photos.len());
                    for i in 0..sample_size {
                        log::debug!(target: "sorting", "before_sort_sample; index={}; time={}; path={}",
                            i, photos.photos[i].time(), photos.photos[i].file.path);
                    }
                }
                // Descending: newest photos first (reverse chronological)
                photos
                    .photos
                    .sort_by(|a, b| match b.time_ref().cmp(a.time_ref()) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    });
                // Log after sorting
                if !photos.photos.is_empty() {
                    let sample_size = std::cmp::min(3, photos.photos.len());
                    for i in 0..sample_size {
                        log::debug!(target: "sorting", "after_sort_sample; index={}; time={}; path={}",
                            i, photos.photos[i].time(), photos.photos[i].file.path);
                    }
                }
            }
            Sort::PhotoTimeAsc => {
                // Ascending: oldest photos first (chronological)
                photos
                    .photos
                    .sort_by(|a, b| match a.time_ref().cmp(b.time_ref()) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    });
            }

            // Added time (created_at in database) sorts
            Sort::AddedTimeDesc => {
                // Descending: newest additions first
                photos
                    .photos
                    .sort_by(|a, b| match b.file.created_at.cmp(&a.file.created_at) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    });
            }
            Sort::AddedTimeAsc => {
                // Ascending: oldest additions first
                photos
                    .photos
                    .sort_by(|a, b| match a.file.created_at.cmp(&b.file.created_at) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    });
            }

            // Star rating sorts
            Sort::StarDesc => {
                // Descending: 5 star → 0 star
                photos.photos.sort_by(|a, b| {
                    let star_a = a.star.unwrap_or(0);
                    let star_b = b.star.unwrap_or(0);
                    match star_b.cmp(&star_a) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    }
                });
            }
            Sort::StarAsc => {
                // Ascending: 0 star → 5 star
                photos.photos.sort_by(|a, b| {
                    let star_a = a.star.unwrap_or(0);
                    let star_b = b.star.unwrap_or(0);
                    match star_a.cmp(&star_b) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    }
                });
            }

            // File name sorts
            Sort::NameDesc => {
                // Descending: Z→A
                photos.photos.sort_by(|a, b| b.file.path.cmp(&a.file.path));
            }
            Sort::NameAsc | Sort::Name => {
                // Ascending: A→Z
                photos.photos.sort_by(|a, b| a.file.path.cmp(&b.file.path));
            }

            // Legacy Time (file created time)
            Sort::Time => {
                photos.photos.sort_by(|a, b| {
                    match a.file.created_date().cmp(&b.file.created_date()) {
                        Ordering::Equal => a.file.path.cmp(&b.file.path),
                        other => other,
                    }
                });
            }
        }

        // Apply pagination using helper
        apply_pagination(&mut photos, num, page, offset);
        set_thumbnail_state_for_page(&mut photos, has_opt);
        photos
    }

    async fn get_recent_photos(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        page: u32,
        _sort: Sort,
        num: u32,
        offset: usize,
        star: i32,
        has_comment: bool,
        extension: &str,
        opt_conf: Option<config::Config>,
    ) -> photo::Photos {
        let mut photos = photo::Photos::new();
        let conf = opt_conf.as_ref();

        // Parse extension filter using helper
        let extension_filters = parse_extension_filter(extension);

        // Use metadata to get all photos (recent photos are already sorted by DB query)
        // Pass 1: cheap metadata filters (no I/O)
        let mut candidates: Vec<&String> = Vec::new();
        for f in meta_data.keys() {
            let md = meta_data.get(f).unwrap();
            if star > 0 && md.star.star() < star {
                continue;
            }
            if has_comment && md.comment.comment().is_empty() {
                continue;
            }

            // Apply extension filter using helper
            if !matches_extension_filter(f, &extension_filters) {
                continue;
            }
            candidates.push(f);
        }

        // Pass 2: existence stats, fanned out across threads (NFS latency)
        let candidate_strs: Vec<&str> = candidates.iter().map(|s| s.as_str()).collect();
        let existing = existing_relative_paths(&candidate_strs, &self.path.path);

        // Pass 3: build Photo entities for the survivors
        for f in candidates {
            if !existing.contains(f.as_str()) {
                log::debug!(target: "directory", "photo_file_missing; path={}", f);
                continue;
            }
            // Use relative path for Photo entity
            let relative_file = file::File::from_relative(f.to_string());
            let photo_meta = meta_data.get(f).unwrap();

            // Create photo from metadata using helper
            let p = create_photo_from_metadata(relative_file, photo_meta, conf);
            photos.photos.push(p)
        }

        // Photos are already sorted by database query (created_at DESC)
        // No additional sorting needed

        // Apply pagination using helper
        apply_pagination(&mut photos, num, page, offset);
        set_thumbnail_state_for_page(&mut photos, conf.is_some());
        photos
    }

    async fn get_next_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
        _config: Option<config::Config>,
    ) -> Option<photo::Photo> {
        self.get_adjacent_photo_in_date(meta_data, path, date, sort, 1)
            .await
    }

    async fn get_prev_photo_in_date(
        &self,
        meta_data: &photo_meta::PhotoMetas,
        path: &str,
        date: date::Date,
        sort: Sort,
        _config: Option<config::Config>,
    ) -> Option<photo::Photo> {
        self.get_adjacent_photo_in_date(meta_data, path, date, sort, -1)
            .await
    }

    async fn move_photos_to_exif_date(&self, date: date::Date) -> date::Dates {
        let dir = self.path.child(date.to_string());
        let files = dir_service::find_files(&dir);
        log::info!(target: "directory", "move_photos_to_exif_date; date={}; dir={}; file_count={}", date, dir.path, files.files.len());
        let mut dates_to_be_changed: HashMap<String, bool> = HashMap::new();
        for file in files.files {
            // file has absolute path from filesystem scan
            let photo = photo::Photo::new_with_exif(file.clone());
            let created_date_str = photo.created_date_string();
            let new_dir = self.path.child(created_date_str.clone());
            log::debug!(target: "directory", "move_check; file={}; photo_time={}; created_date_str={}; current_dir={}; new_dir={}",
                file.path, photo.time(), created_date_str, dir.path, new_dir.path);
            if dir.path != new_dir.path {
                dates_to_be_changed
                    .entry(photo.created_date_string())
                    .or_insert(true);
                let filename = photo.file.filename();
                let new_pathbuf = new_dir.as_pathbuf();
                let new_path = new_pathbuf.as_path().join(filename);

                // Ensure target directory exists
                if !new_pathbuf.exists() {
                    if let Err(e) = fs::create_dir_all(&new_pathbuf) {
                        log::error!(target: "directory", "create_dir_failed; dir={}; error={}", new_dir.path, e);
                        continue;
                    }
                    log::info!(target: "directory", "created_dir; dir={}", new_dir.path);
                }

                // file.path is absolute here (from filesystem scan)
                match fs::rename(&file.path, new_path.display().to_string()) {
                    Ok(_) => {
                        log::info!(target: "directory", "file_moved; from={}; to={}", file.path, new_path.display())
                    }
                    Err(e) => {
                        log::error!(target: "directory", "file_move_failed; from={}; to={}; error={}", file.path, new_path.display(), e)
                    }
                }
            }
        }
        let mut dates = date::Dates::new(&[]);
        if dates_to_be_changed.keys().len() > 0 {
            dates_to_be_changed.insert(date.to_string(), true);
            for date_string in dates_to_be_changed.keys() {
                // Skip empty date strings
                if !date_string.trim().is_empty() {
                    dates
                        .dates
                        .push(date::Date::from_string(date_string, Option::Some("-")));
                }
            }
        }
        return dates;
    }
}

#[cfg(test)]
#[path = "directory_tests.rs"]
mod tests;
