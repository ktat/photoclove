use crate::value::file;
use crate::{repository, value::date};
use chrono::{Local, TimeZone};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::OnceLock;

static IMPORT_FILE_RE: OnceLock<Regex> = OnceLock::new();

/// Regex matching file extensions eligible for import: still images
/// (standard + RAW) and supported video formats (mp4, webm).
fn import_file_re() -> &'static Regex {
    IMPORT_FILE_RE.get_or_init(|| {
        Regex::new(
            r"(?i)\.(?:jpe?g|gif|png|heic|heif|avif|cr2|cr3|nef|nev|arw|dng|raf|orf|rw2|3fr|mp4|webm)$",
        )
        .expect("invalid import file regex")
    })
}

fn get_created_time_from_metadata(metadata: &fs::Metadata) -> String {
    #[cfg(unix)]
    {
        use std::os::unix::prelude::MetadataExt;
        let epoch = metadata.ctime();
        Local
            .timestamp_opt(epoch, 0)
            .single()
            .unwrap_or_else(Local::now)
            .format("%Y-%m-%d %T")
            .to_string()
    }
    #[cfg(windows)]
    {
        match metadata.created() {
            Ok(created) => match created.duration_since(std::time::UNIX_EPOCH) {
                Ok(duration) => {
                    let epoch = duration.as_secs() as i64;
                    Local
                        .timestamp_opt(epoch, 0)
                        .single()
                        .unwrap_or_else(|| Local::now())
                        .format("%Y-%m-%d %T")
                        .to_string()
                }
                Err(_) => Local::now().format("%Y-%m-%d %T").to_string(),
            },
            Err(_) => Local::now().format("%Y-%m-%d %T").to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Dir {
    pub path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DirsFiles {
    pub dir: Dir,
    pub files: file::Files,
    pub dirs: file::Dirs,
    pub has_next_file: bool,
    pub has_prev_file: bool,
}

impl DirsFiles {
    pub fn new(path: String) -> DirsFiles {
        DirsFiles {
            dir: Dir { path },
            dirs: file::Dirs::new(),
            files: file::Files::new(),
            has_next_file: false,
            has_prev_file: false,
        }
    }
}

impl Dir {
    pub fn new(path: String) -> Dir {
        if path.is_empty() {
            panic!("empty path is given!");
        }
        Dir { path }
    }

    pub fn find_all_files(&self, date_after: Option<date::Date>) -> file::Files {
        let re = import_file_re();
        let readdir = match fs::read_dir(&self.path) {
            Ok(rd) => rd,
            Err(e) => {
                log::error!(target: "repository", "readdir_failed; path={}; error={}", self.path, e);
                return file::Files::new();
            }
        };

        let mut files = file::Files::new();
        for entry in readdir.filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            let path_str = entry_path.display().to_string();
            if path_str == "." {
                continue;
            }

            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            if (file_type.is_file() || file_type.is_symlink()) && re.is_match(&path_str) {
                let metadata = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                let created_at = get_created_time_from_metadata(&metadata);

                if let Some(ref filter_date) = date_after {
                    if created_at < filter_date.to_string() {
                        continue;
                    }
                }

                files.files.push(file::File::new_from_dir_entry(
                    path_str, &metadata, &file_type,
                ));
            }
        }
        files.files.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        files
    }

    pub fn find_files_and_dirs(
        &self,
        _sort: repository::Sort,
        page: usize,
        num: usize,
        date_after: Option<date::Date>,
    ) -> DirsFiles {
        let mut df = DirsFiles::new(self.path.clone());
        let re = import_file_re();
        let readdir = match fs::read_dir(&self.path) {
            Ok(rd) => rd,
            Err(_) => return DirsFiles::new(self.path.clone()),
        };

        let start_index: usize = (page - 1) * num;
        let mut last_index: usize = page * num;

        // Collect lightweight entries (path + metadata + file_type) without File::new()
        struct FileEntry {
            path: String,
            created_at: String,
            metadata: fs::Metadata,
            file_type: fs::FileType,
        }
        let mut file_entries: Vec<FileEntry> = Vec::new();
        let t_scan_start = std::time::Instant::now();

        for entry in readdir.filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            let path_str = entry_path.display().to_string();
            if path_str == "." {
                continue;
            }

            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            if file_type.is_file() || file_type.is_symlink() {
                if !re.is_match(&path_str) {
                    continue;
                }

                let metadata = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                let created_at = get_created_time_from_metadata(&metadata);

                if let Some(ref filter_date) = date_after {
                    if created_at < filter_date.to_string() {
                        continue;
                    }
                }

                file_entries.push(FileEntry {
                    path: path_str,
                    created_at,
                    metadata,
                    file_type,
                });
            } else if file_type.is_dir() {
                df.dirs.dirs.push(file::Dir::new(path_str));
            }
        }

        let t_scan_end = std::time::Instant::now();

        // Sort lightweight entries
        file_entries.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        let t_sort_end = std::time::Instant::now();

        // Build File objects only for the requested page
        let len = file_entries.len();
        if len > 0 {
            df.has_prev_file = start_index != 0 && len > start_index;

            if (len - 1) > last_index {
                df.has_next_file = true;
            } else {
                df.has_next_file = false;
                last_index = len;
            }
            if last_index > start_index {
                df.files.files = file_entries[start_index..last_index]
                    .iter()
                    .map(|e| {
                        file::File::new_from_dir_entry(e.path.clone(), &e.metadata, &e.file_type)
                    })
                    .collect();
            } else {
                log::error!(target: "repository", "invalid_index_range; start_index={}; last_index={}", start_index, last_index);
            }
        }
        let t_build_end = std::time::Instant::now();
        log::info!(
            target: "repository",
            "find_files_and_dirs_timing; path={}; scan={}ms; sort={}ms; build_page={}ms; total={}ms; total_files={}; page_files={}; dirs={}",
            self.path,
            t_scan_end.duration_since(t_scan_start).as_millis(),
            t_sort_end.duration_since(t_scan_end).as_millis(),
            t_build_end.duration_since(t_sort_end).as_millis(),
            t_build_end.duration_since(t_scan_start).as_millis(),
            file_entries.len(),
            df.files.files.len(),
            df.dirs.dirs.len(),
        );
        df
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_import_file_re_matches_images_and_videos() {
        let re = import_file_re();
        // Still images (case-insensitive)
        assert!(re.is_match("/photos/a.jpg"));
        assert!(re.is_match("/photos/a.JPG"));
        assert!(re.is_match("/photos/a.heic"));
        assert!(re.is_match("/photos/a.CR2"));
        // Videos
        assert!(re.is_match("/photos/IMG_0001.mp4"));
        assert!(re.is_match("/photos/IMG_0001.MP4"));
        assert!(re.is_match("/photos/clip.webm"));
        // Non-media
        assert!(!re.is_match("/photos/note.txt"));
        assert!(!re.is_match("/photos/archive.zip"));
    }
}
