use crate::value::date;
use chrono::{Local, TimeZone};
use path_abs::PathAbs;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
#[cfg(unix)]
use std::os::unix::prelude::MetadataExt;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct File {
    pub path: String,
    pub name: String,
    pub dir: String,
    pub created_at: String,
    pub is_link: bool,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Files {
    pub files: Vec<File>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Dir {
    pub path: String,
    pub created_at: String,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Dirs {
    pub dirs: Vec<Dir>,
}

fn get_created_time(path: String) -> String {
    let metadata = match std::fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(e) => {
            log::warn!(target: "file", "get_created_time_metadata_failed; path={}; error={:?}", path, e);
            return Local::now().format("%Y-%m-%d %T").to_string();
        }
    };
    #[cfg(unix)]
    let epoch = metadata.ctime();
    #[cfg(windows)]
    let epoch = match metadata.created() {
        Ok(created) => match created.duration_since(std::time::UNIX_EPOCH) {
            Ok(duration) => duration.as_secs() as i64,
            Err(_) => {
                log::warn!(target: "file", "get_created_time_duration_failed; path={}", path);
                return Local::now().format("%Y-%m-%d %T").to_string();
            }
        },
        Err(_) => {
            log::warn!(target: "file", "get_created_time_created_failed; path={}", path);
            return Local::now().format("%Y-%m-%d %T").to_string();
        }
    };
    Local.timestamp_opt(epoch, 0)
        .single()
        .unwrap_or_else(|| {
            log::warn!(target: "file", "get_created_time_timestamp_failed; path={}; epoch={}", path, epoch);
            Local::now()
        })
        .format("%Y-%m-%d %T")
        .to_string()
}

impl Dirs {
    pub fn new() -> Dirs {
        Dirs { dirs: Vec::new() }
    }
}

impl Files {
    pub fn new() -> Files {
        Files { files: Vec::new() }
    }
}

impl Dir {
    pub fn new(path: String) -> Dir {
        let p = Path::new(&path);
        let cp = PathAbs::new(p);
        let result = p.try_exists();
        match (result, cp) {
            (_, Err(e)) => {
                log::error!(target: "file", "invalid_abs_path; path={:?}; error={:?}", p, e);
                Dir {
                    path: "/".to_string(),
                    created_at: get_created_time("/".to_string()),
                }
            }
            (Err(e), Ok(abs_path)) => {
                log::error!(
                    target: "file",
                    "invalid_path_for_dir; path={:?}; canonical_path={:?}; error={:?}",
                    p,
                    abs_path.as_path(),
                    e
                );
                Dir {
                    path: "/".to_string(),
                    created_at: get_created_time("/".to_string()),
                }
            }
            (Ok(false), Ok(abs_path)) => {
                // Path does not exist - use resolved path but skip filesystem access
                Dir {
                    path: abs_path.as_path().display().to_string(),
                    created_at: Local::now().format("%Y-%m-%d %T").to_string(),
                }
            }
            (Ok(true), Ok(_)) => {
                let ap = PathAbs::new(p).unwrap().as_path().display().to_string();
                Dir {
                    path: ap.clone(),
                    created_at: get_created_time(ap),
                }
            }
        }
    }

    pub fn as_pathbuf(&self) -> PathBuf {
        PathBuf::from(self.path.clone())
    }

    pub fn to_date(&self) -> Option<date::Date> {
        // Helper function to safely parse date from regex captures
        fn parse_date_from_captures(cap: &regex::Captures) -> Option<date::Date> {
            let year: i32 = cap.get(1)?.as_str().parse().ok()?;
            let month: u32 = cap.get(2)?.as_str().parse().ok()?;
            let day: u32 = cap.get(3)?.as_str().parse().ok()?;
            date::Date::new(year, month, day)
        }

        // First try the original pattern for backward compatibility (date at end)
        let re_end =
            Regex::new(r"([0-9]{4})-(0?[1-9]|1[012])-(0?[1-9]|(1|2)[0-9]|30|31)/?$").unwrap();
        if let Some(cap) = re_end.captures(self.path.as_str()) {
            if let Some(date) = parse_date_from_captures(&cap) {
                return Some(date);
            }
        }

        // If not found at end, search for date pattern anywhere in the path (for UUID subdirectories)
        // This handles paths like /path/to/2025-01-15/abc123-def456-789
        let re_anywhere =
            Regex::new(r"/([0-9]{4})-(0?[1-9]|1[012])-(0?[1-9]|(1|2)[0-9]|30|31)(/|$)").unwrap();
        if let Some(cap) = re_anywhere.captures(self.path.as_str()) {
            if let Some(date) = parse_date_from_captures(&cap) {
                return Some(date);
            }
        }

        log::debug!(target: "file", "to_date_capture_failed; path={}", self.path);
        None
    }
    pub fn child(&self, path: String) -> Dir {
        Dir::new(
            PathBuf::from(self.path.clone())
                .join(&path)
                .display()
                .to_string(),
        )
    }
}

/// Convert an absolute path to a relative path by removing the base prefix.
/// Always uses `/` as separator (even on Windows).
pub fn to_relative_path(absolute: &str, base: &str) -> String {
    let normalized_abs = absolute.replace('\\', "/");
    let normalized_base = base.replace('\\', "/");
    let trimmed_base = normalized_base.trim_end_matches('/');

    if let Some(relative) = normalized_abs.strip_prefix(trimmed_base) {
        let relative = relative.trim_start_matches('/');
        relative.to_string()
    } else {
        // If the path doesn't start with base, return as-is (already relative or different base)
        normalized_abs
    }
}

/// Convert a relative path to an absolute path by prepending the base.
/// Uses the platform's native separator for the result.
pub fn to_absolute_path(relative: &str, base: &str) -> String {
    let trimmed_base = base.trim_end_matches('/').trim_end_matches('\\');
    let trimmed_relative = relative.trim_start_matches('/').trim_start_matches('\\');
    format!("{}/{}", trimmed_base, trimmed_relative)
}

impl File {
    /// Create a File from a relative path (DB read use case).
    /// Does NOT perform filesystem validation - suitable for paths stored in DB.
    pub fn from_relative(path: String) -> File {
        // Normalize path separators to forward slash
        let normalized = path.replace('\\', "/");
        let p = Path::new(&normalized);
        let dir = p.parent().unwrap_or(Path::new("")).display().to_string();
        let file_name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        File {
            path: normalized,
            name: file_name,
            dir,
            created_at: String::new(),
            is_link: false,
        }
    }

    /// DirEntry から取得済みの Metadata と FileType で構築（追加I/Oなし）
    /// リポジトリ層でのディレクトリ走査用
    pub fn new_from_dir_entry(
        path: String,
        metadata: &fs::Metadata,
        file_type: &fs::FileType,
    ) -> File {
        let p = Path::new(&path);
        let dir = p.parent().unwrap_or(Path::new("/")).display().to_string();
        let file_name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        #[cfg(unix)]
        let created_at = {
            use std::os::unix::prelude::MetadataExt;
            let epoch = metadata.ctime();
            Local
                .timestamp_opt(epoch, 0)
                .single()
                .unwrap_or_else(Local::now)
                .format("%Y-%m-%d %T")
                .to_string()
        };
        #[cfg(windows)]
        let created_at = {
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
        };

        File {
            path,
            name: file_name,
            dir,
            created_at,
            is_link: file_type.is_symlink(),
        }
    }

    pub fn new(path: String) -> File {
        let link = fs::read_link(Path::new(&path));
        let p = Path::new(&path);
        let parent_path = match p.parent() {
            Some(parent) => parent,
            None => Path::new("/"),
        };

        let cp = PathAbs::new(p);

        if !p.exists() {
            log::warn!(target: "file", "file_not_found; path={:?}; error={:?}", path, cp.err());
            // Return a default File object instead of panicking
            return File {
                path: path.to_string(),
                name: Path::new(&path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
                dir: Path::new(&path)
                    .parent()
                    .and_then(|p| p.to_str())
                    .unwrap_or("/")
                    .to_string(),
                created_at: "".to_string(),
                is_link: false,
            };
        }

        match cp {
            Err(e) => {
                log::warn!(target: "file", "file_not_found; path={:?}; error={:?}", path, e);
                File {
                    path: path.to_string(),
                    name: Path::new(&path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string(),
                    dir: Path::new(&path)
                        .parent()
                        .and_then(|p| p.to_str())
                        .unwrap_or("/")
                        .to_string(),
                    created_at: "".to_string(),
                    is_link: false,
                }
            }
            Ok(abs_path) => {
                let ap = abs_path.as_path().display().to_string();
                if p.file_name().is_none() || p.file_name().and_then(|n| n.to_str()).is_none() {
                    log::warn!(target: "file", "invalid_filename; path={:?}", path);
                    return File {
                        path: path.to_string(),
                        name: "invalid".to_string(),
                        dir: Path::new(&path)
                            .parent()
                            .and_then(|p| p.to_str())
                            .unwrap_or("/")
                            .to_string(),
                        created_at: "".to_string(),
                        is_link: false,
                    };
                }
                let file_name = p
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                File {
                    path: ap.clone(),
                    name: file_name,
                    dir: parent_path.display().to_string(),
                    created_at: get_created_time(ap),
                    is_link: link.is_ok(),
                }
            }
        }
    }

    pub fn new_if_exists(path: String) -> Option<File> {
        let p = Path::new(&path);
        let cp = PathAbs::new(p);
        if !p.exists() {
            log::warn!(
                target: "file",
                "invalid_path_for_file; path={:?}; error=file does not exist",
                path,
            );
            return Option::None;
        }
        match cp {
            Err(e) => {
                log::warn!(
                    target: "file",
                    "invalid_path_for_file; path={:?}; error={:?}",
                    path,
                    e
                );
                Option::None
            }
            Ok(abs_path) => {
                let ap = abs_path.as_path().display().to_string();
                Option::Some(File::new(ap))
            }
        }
    }

    #[allow(dead_code)]
    pub fn is_created_before(&self, filter_date: date::Date) -> bool {
        self.created_date() < filter_date.to_string()
    }

    pub fn created_date(&self) -> String {
        let t = self.get_created_time();
        t.format("%Y-%m-%d").to_string()
    }

    pub fn created_datetime(&self) -> String {
        let t = self.get_created_time();
        t.format("%Y-%m-%d %T").to_string()
    }

    fn get_created_time(&self) -> chrono::DateTime<Local> {
        let metadata = match std::fs::metadata(&self.path) {
            Ok(metadata) => metadata,
            Err(e) => {
                log::warn!(target: "file", "metadata_not_found; path={}; error={:?}", self.path, e);
                // Return current time as fallback
                return Local::now();
            }
        };
        #[cfg(unix)]
        let epoch = metadata.ctime();
        #[cfg(windows)]
        let epoch = match metadata.created() {
            Ok(created) => match created.duration_since(std::time::UNIX_EPOCH) {
                Ok(duration) => duration.as_secs() as i64,
                Err(_) => {
                    log::warn!(target: "file", "duration_calculation_failed; path={}", self.path);
                    return Local::now();
                }
            },
            Err(_) => {
                log::warn!(target: "file", "created_time_failed; path={}", self.path);
                return Local::now();
            }
        };
        Local.timestamp_opt(epoch, 0)
            .single()
            .unwrap_or_else(|| {
                log::warn!(target: "file", "timestamp_conversion_failed; path={}; epoch={}", self.path, epoch);
                Local::now()
            })
    }

    pub fn filename(&self) -> String {
        let remove_path = match regex::Regex::new("^.+/") {
            Ok(regex) => regex,
            Err(_) => {
                log::warn!(target: "file", "regex_compilation_failed; path={}", self.path);
                // Fallback: try to extract filename using Path
                return Path::new(&self.path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
            }
        };
        let filename = remove_path.replace(&self.path, "");
        filename.to_string()
    }

    #[allow(dead_code)]
    pub fn create_file_if_not_exists(&self) -> bool {
        let p = std::path::Path::new(&self.path);
        let mut created = false;
        if !p.exists() {
            created = true;
            std::fs::File::create(&self.path).expect("create failed");
        }
        created
    }
}

#[cfg(test)]
mod tests {
    use crate::value::file;

    #[test]
    fn test_create_file_if_not_exists() {
        let f = "/tmp/test_file.rs.dummy";
        let mut expected_created = true;
        if std::path::Path::new(f).exists() {
            expected_created = false;
        }
        let fo = file::File::new(f.to_string());
        let r = fo.create_file_if_not_exists();
        assert_eq!(std::path::Path::new(f).exists(), true);
        assert_eq!(r, expected_created);
        let r2 = fo.create_file_if_not_exists();
        assert_eq!(r2, false);
    }

    #[test]
    fn test_to_relative_path() {
        assert_eq!(
            file::to_relative_path(
                "/mnt/nas/photos/2024-01-15/uuid/photo.jpg",
                "/mnt/nas/photos"
            ),
            "2024-01-15/uuid/photo.jpg"
        );
        assert_eq!(
            file::to_relative_path(
                "/mnt/nas/photos/2024-01-15/uuid/photo.jpg",
                "/mnt/nas/photos/"
            ),
            "2024-01-15/uuid/photo.jpg"
        );
        // Already relative
        assert_eq!(
            file::to_relative_path("2024-01-15/uuid/photo.jpg", "/mnt/nas/photos"),
            "2024-01-15/uuid/photo.jpg"
        );
    }

    #[test]
    fn test_to_absolute_path() {
        assert_eq!(
            file::to_absolute_path("2024-01-15/uuid/photo.jpg", "/mnt/nas/photos"),
            "/mnt/nas/photos/2024-01-15/uuid/photo.jpg"
        );
        assert_eq!(
            file::to_absolute_path("2024-01-15/uuid/photo.jpg", "/mnt/nas/photos/"),
            "/mnt/nas/photos/2024-01-15/uuid/photo.jpg"
        );
    }

    #[test]
    fn test_from_relative() {
        let f = file::File::from_relative("2024-01-15/uuid/photo.jpg".to_string());
        assert_eq!(f.path, "2024-01-15/uuid/photo.jpg");
        assert_eq!(f.name, "photo.jpg");
        assert_eq!(f.dir, "2024-01-15/uuid");
    }
}
