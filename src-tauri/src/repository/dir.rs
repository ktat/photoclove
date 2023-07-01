use crate::value::file;
use crate::{repository, value::date};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;

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
            dir: Dir { path: path },
            dirs: file::Dirs::new(),
            files: file::Files::new(),
            has_next_file: false,
            has_prev_file: false,
        }
    }
}

impl Dir {
    pub fn new(path: String) -> Dir {
        if path == "" {
            panic!("empty path is given!");
        }
        Dir { path: path }
    }

    pub fn find_all_files(&self, date_after: Option<date::Date>) -> file::Files {
        let re = Regex::new(r"(?i)\.(?:jpe?g|gif|png)$").unwrap();
        let readdir = fs::read_dir(&self.path);
        let mut files = file::Files::new();
        if readdir.is_ok() {
            for entry in readdir.unwrap() {
                let entry = entry.unwrap();
                let entry_path = entry.path();
                if entry_path.display().to_string() != ".".to_string() {
                    let has_filter = date_after.is_some();
                    if entry_path.is_file()
                        && re.is_match(entry_path.display().to_string().as_str())
                    {
                        let f = file::File::new(entry_path.display().to_string());

                        if has_filter && f.created_date() < date_after.unwrap().to_string() {
                            continue;
                        }
                        files.files.push(f);
                    }
                }
            }
        } else {
            panic!("Cannot readdir: {}\n", self.path.to_string())
        }
        files.files.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        return files;
    }

    pub fn find_files_and_dirs(
        &self,
        sort: repository::Sort,
        page: usize,
        num: usize,
        date_after: Option<date::Date>,
    ) -> DirsFiles {
        let mut df = DirsFiles::new(self.path.clone());
        let re = Regex::new(r"(?i)\.(?:jpe?g|gif|png)$").unwrap();
        let readdir = fs::read_dir(&self.path);
        if readdir.is_ok() {
            let start_index: usize = (page - 1) * num;
            let mut last_index: usize = page * num;
            for entry in readdir.unwrap() {
                let entry = entry.unwrap();
                let entry_path = entry.path();
                if entry_path.display().to_string() != ".".to_string() {
                    if entry_path.is_file()
                        && re.is_match(entry_path.display().to_string().as_str())
                    {
                        let f = file::File::new(entry_path.display().to_string());
                        if date_after.is_some() {
                            let date_after = date_after.unwrap();
                            if f.is_created_before(date_after) {
                                continue;
                            }
                        }
                        df.files.files.push(f);
                    } else if entry_path.is_dir() {
                        df.dirs
                            .dirs
                            .push(file::Dir::new(entry_path.display().to_string()));
                    } else {
                        // print!("not target: {:?}", entry_path);
                    }
                }
            }
            df.files
                .files
                .sort_by(|a, b| a.created_at.cmp(&b.created_at));
            let len = df.files.files.len();
            if len > 0 {
                df.has_prev_file = start_index != 0 && len > start_index;

                if (len - 1) > last_index {
                    df.has_next_file = true;
                } else {
                    df.has_next_file = false;
                    last_index = len;
                }
                if last_index > start_index {
                    df.files.files = df.files.files[start_index..last_index].to_vec()
                } else {
                    eprintln!("why ? {} : {}", start_index, last_index);
                }
            }
            return df;
        } else {
            return DirsFiles::new(self.path.clone());
        }
    }
}
