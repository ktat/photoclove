use crate::value::{date, file};
use regex::Regex;
use std::fs;
use uuid::Uuid;

pub fn find_files(dir: &file::Dir) -> file::Files {
    let mut f = file::Files { files: Vec::new() };

    let Ok(readdir) = fs::read_dir(&dir.path) else {
        log::warn!(target: "dir_service", "directory_not_found; path={}", dir.path);
        return f;
    };

    for entry in readdir.filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        let Some(file_name) = entry_path.file_name() else {
            continue;
        };

        // Skip hidden files (starting with '.')
        if file_name.to_string_lossy().starts_with('.') {
            continue;
        }

        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };

        if entry_path.display().to_string() != "." && (file_type.is_file() || file_type.is_symlink()) {
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            f.files.push(file::File::new_from_dir_entry(
                entry_path.display().to_string(),
                &metadata,
                &file_type,
            ));
        } else if file_type.is_dir() {
            // Check if this is a UUID directory (UUID-like format)
            let dir_name = file_name.to_string_lossy();
            if Uuid::parse_str(&dir_name).is_ok() {
                // Recursively scan UUID subdirectory
                let uuid_dir = file::Dir::new(entry_path.display().to_string());
                let uuid_files = find_files(&uuid_dir);
                f.files.extend(uuid_files.files);
            }
        }
    }
    f
}

pub fn find_directories(dir: &file::Dir, regex: &Option<Regex>) -> file::Dirs {
    let mut f = file::Dirs { dirs: Vec::new() };

    let Ok(entries) = fs::read_dir(&dir.path) else {
        log::warn!(target: "dir_service", "directory_not_found; path={}", dir.path);
        return f;
    };

    let Some(re) = regex.as_ref() else {
        return f;
    };

    for entry_result in entries {
        let Ok(entry) = entry_result else {
            log::warn!(target: "dir_service", "entry_read_failed; path={}", dir.path);
            continue;
        };

        let entry_path = entry.path();
        let path_str = entry_path.display().to_string();

        let Some(cap) = re.captures(&path_str) else {
            continue;
        };

        if cap.len() == 0 {
            continue;
        }

        // Parse date components with fallback to 0 for invalid values
        let year = cap[1].parse::<i32>().unwrap_or(0);
        let month = cap[2].parse::<u32>().unwrap_or(0);
        let day = cap[3].parse::<u32>().unwrap_or(0);

        if date::Date::new(year, month, day).is_none() {
            log::debug!(target: "dir_service", "invalid_date_path; path={}", path_str);
            continue;
        }

        if path_str != "." && entry_path.is_dir() {
            f.dirs.push(file::Dir::new(path_str));
        }
    }
    f
}

pub fn find_date_like_directories(dir: &file::Dir) -> file::Dirs {
    let re = &Option::Some(
        Regex::new(r"(?:\\|/)([0-9]{4})-(0?[1-9]|1[012])-(0?[1-9]|(1|2)[0-9]|30|31)(?:\\|/)?$")
            .unwrap(),
    );
    find_directories(dir, re)
}

#[cfg(test)]
mod tests {
    use crate::domain_service::dir_service::find_files;
    use crate::value::file;
    use std::path::Path;

    #[test]
    fn test_find_files() {
        let path = Path::new("tests/assets/files");
        let dir = file::Dir::new(path.display().to_string());
        let files = find_files(&dir);
        assert_eq!(files.files.len(), 3);
    }
}
