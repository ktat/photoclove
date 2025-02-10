use crate::repository::dir;
use crate::value::file;
use regex::Regex;
use std::fs;

pub fn find_all_files(dir: &dir::Dir) -> file::Files {
    let re = Regex::new(r"(?i)\.(?:jpe?g|gif|png)$").unwrap();
    let readdir = fs::read_dir(dir.path.clone());
    let mut files = file::Files::new();
    if readdir.is_ok() {
        for entry in readdir.unwrap() {
            let entry = entry.unwrap();
            let entry_path = entry.path();
            if entry_path.display().to_string() != ".".to_string() {
                if entry_path.is_file() && re.is_match(entry_path.display().to_string().as_str()) {
                    files
                        .files
                        .push(file::File::new(entry_path.display().to_string()));
                }
            }
        }
    } else {
        panic!("Cannot readdir: {}\n", dir.path.to_string())
    }
    return files;
}
