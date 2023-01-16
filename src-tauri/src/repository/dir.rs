use crate::value::file;
use crate::repository;
use std::fs;
use serde::{Serialize, Deserialize};
use regex::Regex;

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
    pub fn new (path: String) -> DirsFiles {
        DirsFiles {
            dir: Dir{path: path},
            dirs: file::Dirs::new(),
            files:file::Files::new(),
            has_next_file: false,
            has_prev_file: false,
        }
    }
}

impl Dir {
    pub fn new (path: String) -> Dir{
        if path == "" {
            panic!("empty path is given!");
        }
        Dir{path: path}
    }

    pub fn find_all_files(&self) -> file::Files {
        let re = Regex::new(r"(?i)\.(?:jpe?g|gif|png)$").unwrap();
        let readdir = fs::read_dir(&self.path);
        let mut files = file::Files::new();
        if readdir.is_ok() {
            for entry in readdir.unwrap() {
                let entry = entry.unwrap();
                let entry_path = entry.path();
                if entry_path.display().to_string() != ".".to_string() {
                    if entry_path.is_file() && re.is_match(entry_path.display().to_string().as_str()) {
                        files.files.push(file::File::new(entry_path.display().to_string()));
                    }
                }
            }
        } else {
            panic!("Cannot readdir: {}\n", self.path.to_string())
        }
        return files;
    }

    pub fn find_files_and_dirs(&self, sort: repository::Sort, page: u32, num: u32) -> DirsFiles {
        let mut df = DirsFiles::new(self.path.clone());
        let re = Regex::new(r"(?i)\.(?:jpe?g|gif|png)$").unwrap();
        let readdir = fs::read_dir(&self.path);
        if readdir.is_ok() {
            let start_index = (page-1) * num;
            let last_index = page * num;
            let mut i = 0;
            if start_index > 0 {
                df.has_prev_file = true;
            }
            for entry in readdir.unwrap() {
                let entry = entry.unwrap();
                let entry_path = entry.path();
                if entry_path.display().to_string() != ".".to_string() {
                    if entry_path.is_file() && re.is_match(entry_path.display().to_string().as_str()) {
                        if i < start_index {
                            i += 1;
                            continue;
                        }
                        if i >= last_index {
                            i += 1;
                            df.has_next_file = true;
                            continue;
                        }
                        df.files.files.push(file::File::new(entry_path.display().to_string()));
                        i += 1
                    } else if (entry_path.is_dir()) {
                        df.dirs.dirs.push(file::Dir::new(entry_path.display().to_string()));
                    } else {
                        // print!("not target: {:?}", entry_path);
                    }
                }
            }
            return df
        } else {
            return DirsFiles::new(self.path.clone());
        }
    }
}
