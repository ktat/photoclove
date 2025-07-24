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
        if !result.is_ok() || cp.is_err() {
            if cp.is_err() {
                log::error!(target: "file", "invalid_abs_path; path={:?}; error={:?}", p, cp.err());
            } else {
                log::error!(
                    target: "file",
                    "invalid_path_for_dir; path={:?}; canonical_path={:?}",
                    p,
                    cp.unwrap().as_path()
                );
            }
            return Dir {
                path: "/".to_string(),
                created_at: get_created_time("/".to_string()),
            };
        } else {
            let ap = PathAbs::new(p).unwrap().as_path().display().to_string();
            return Dir {
                path: ap.clone(),
                created_at: get_created_time(ap),
            };
        }
    }

    pub fn as_pathbuf(&self) -> PathBuf {
        PathBuf::from(self.path.clone())
    }

    pub fn to_date(&mut self) -> Option<date::Date> {
        // First try the original pattern for backward compatibility (date at end)
        let re_end = Regex::new(r"([0-9]{4})-(0?[1-9]|1[012])-(0?[1-9]|(1|2)[0-9]|30|31)/?$").unwrap();
        if let Some(cap) = re_end.captures(self.path.as_str()) {
            return Option::Some(
                date::Date::new(
                    cap[1].parse::<i32>().unwrap(),
                    cap[2].parse::<u32>().unwrap(),
                    cap[3].parse::<u32>().unwrap(),
                )
                .unwrap(),
            );
        }
        
        // If not found at end, search for date pattern anywhere in the path (for UUID subdirectories)
        // This handles paths like /path/to/2025-01-15/abc123-def456-789
        let re_anywhere = Regex::new(r"/([0-9]{4})-(0?[1-9]|1[012])-(0?[1-9]|(1|2)[0-9]|30|31)(/|$)").unwrap();
        if let Some(cap) = re_anywhere.captures(self.path.as_str()) {
            return Option::Some(
                date::Date::new(
                    cap[1].parse::<i32>().unwrap(),
                    cap[2].parse::<u32>().unwrap(),
                    cap[3].parse::<u32>().unwrap(),
                )
                .unwrap(),
            );
        }
        
        print!("capture error: {}", self.path);
        return Option::None;
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

impl File {
    pub fn new(path: String) -> File {
        let link = fs::read_link(Path::new(&path));
        let p = Path::new(&path);
        let parent_path = match p.parent() {
            Some(parent) => parent,
            None => Path::new("/"),
        };

        let cp = PathAbs::new(p);

        if !p.exists() || cp.is_err() {
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
        } else {
            let ap = cp.unwrap().as_path().display().to_string();
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
            let file_name = p.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            return File {
                path: ap.clone(),
                name: file_name,
                dir: parent_path.display().to_string(),
                created_at: get_created_time(ap),
                is_link: !link.is_err(),
            };
        }
    }

    pub fn new_if_exists(path: String) -> Option<File> {
        let p = Path::new(&path);
        let cp = PathAbs::new(p);
        if !p.exists() || cp.is_err() {
            log::warn!(
                target: "file",
                "invalid_path_for_file; path={:?}; error={:?}",
                path,
                cp.err()
            );
            return Option::None;
        } else {
            let ap = cp.unwrap().as_path().display().to_string();
            return Option::Some(File::new(ap));
        }
    }

    pub fn is_created_before(&self, filter_date: date::Date) -> bool {
        return self.created_date() < filter_date.to_string();
    }

    pub fn created_date(&self) -> String {
        let t = self.get_created_time();
        return t.format("%Y-%m-%d").to_string();
    }

    pub fn created_datetime(&self) -> String {
        let t = self.get_created_time();
        return t.format("%Y-%m-%d %T").to_string();
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
        return filename.to_string();
    }

    pub fn create_file_if_not_exists(&self) -> bool {
        let p = std::path::Path::new(&self.path);
        let mut created = false;
        if !p.exists() {
            created = true;
            std::fs::File::create(&self.path).expect("create failed");
        }
        return created;
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
}
