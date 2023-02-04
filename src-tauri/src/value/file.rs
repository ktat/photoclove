use crate::repository;
use crate::value::date;
use chrono::{DateTime, Datelike, Local, TimeZone};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::os::unix::prelude::MetadataExt;
use std::path::Path;
use std::{fs, time::UNIX_EPOCH};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct File {
    pub path: String,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Files {
    pub files: Vec<File>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Dir {
    pub path: String,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Dirs {
    pub dirs: Vec<Dir>,
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
        let cp = fs::canonicalize(p);
        if cp.is_err() {
            eprintln!("Invalid path: {:?}", cp.err());
            return Dir {
                path: "/".to_string(),
            };
        } else {
            let ap = fs::canonicalize(p).unwrap().as_path().display().to_string();
            return Dir { path: ap };
        }
    }

    pub fn to_date(&mut self) -> Option<date::Date> {
        let re = Regex::new(r"([0-9]{4})-(0?[1-9]|1[012])-(0?[1-9]|(1|2)[0-9]|30|31)/?$").unwrap();
        let cap_result = re.captures(self.path.as_str());
        if cap_result.is_none() {
            print!("capture error: {}", self.path);
            return Option::None;
        }
        let cap = cap_result.unwrap();
        return Option::Some(
            date::Date::new(
                cap[1].parse::<i32>().unwrap(),
                cap[2].parse::<u32>().unwrap(),
                cap[3].parse::<u32>().unwrap(),
            )
            .unwrap(),
        );
    }
    pub fn child(&self, path: String) -> Dir {
        Dir::new(self.path.to_string() + "/" + &path)
    }

    pub fn find_files(&self) -> Files {
        let mut f = Files { files: Vec::new() };
        let readdir = fs::read_dir(&self.path);
        if readdir.is_ok() {
            for entry in readdir.unwrap() {
                let entry = entry.unwrap();
                let entry_path = entry.path();
                let file_name = entry_path.file_name().unwrap();

                if file_name.to_string_lossy().chars().next().unwrap() == '.' {
                    continue;
                }
                if entry_path.display().to_string() != ".".to_string() && entry_path.is_file() {
                    f.files.push(File::new(entry_path.display().to_string()));
                }
            }
            return f;
        } else {
            panic!("Cannot readdir: {}", self.path.to_string())
        }
    }

    pub fn find_directories(&self, regex: &Option<Regex>) -> Dirs {
        let mut f = Dirs { dirs: Vec::new() };
        let res = fs::read_dir(&self.path);
        if res.is_ok() {
            for entry in res.unwrap() {
                if entry.is_err() {
                    print!("{:?}", entry.err());
                    continue;
                }
                let entry = entry.unwrap();
                let entry_path = entry.path();
                let t = &entry_path.display().to_string();
                let cap_result = regex.as_ref().unwrap().captures(t);
                if cap_result.is_none() {
                    continue;
                }
                let cap = cap_result.unwrap();
                if regex.is_some() && cap.len() == 0 {
                    continue;
                } else if date::Date::new(
                    cap[1].parse::<i32>().unwrap(),
                    cap[2].parse::<u32>().unwrap(),
                    cap[3].parse::<u32>().unwrap(),
                )
                .is_none()
                {
                    print!("{:?}\n", cap);
                    continue;
                }

                if entry_path.display().to_string() != ".".to_string() && entry_path.is_dir() {
                    f.dirs.push(Dir::new(entry_path.display().to_string()));
                }
            }
        } else {
            let p = self.path.as_str();
            panic!("Cannot open directory: {}", p)
        }
        f
    }

    pub fn find_date_like_directories(&self) -> Dirs {
        let re = &Option::Some(
            Regex::new(r"([0-9]{4})-(0?[1-9]|1[012])-(0?[1-9]|(1|2)[0-9]|30|31)/?$").unwrap(),
        );
        self.find_directories(re)
    }
}

impl File {
    pub fn new(path: String) -> File {
        let p = Path::new(&path);
        let cp = fs::canonicalize(p);
        if cp.is_err() {
            panic!("Invalid path: {:?}, {:?}", path, cp.err());
        } else {
            let ap = cp.unwrap().as_path().display().to_string();
            return File { path: ap };
        }
    }

    pub fn new_if_exists(path: String) -> Option<File> {
        let p = Path::new(&path);
        let cp = fs::canonicalize(p);
        if cp.is_err() {
            eprintln!("Invalid path: {:?}, {:?}", path, cp.err());
            return Option::None;
        } else {
            let ap = cp.unwrap().as_path().display().to_string();
            return Option::Some(File { path: ap });
        }
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
        let metadata = std::fs::metadata(&self.path).unwrap();
        let epoch = metadata.ctime();
        Local.timestamp_opt(epoch, 0).unwrap()
    }

    pub fn filename(&self) -> String {
        let remove_path = regex::Regex::new("^.+/").unwrap();
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

    #[test]
    fn test_find_files() {
        let path = "tests/assets/files";
        let dir = file::Dir::new(path.to_string());
        let files = dir.find_files();
        assert_eq!(files.files.len(), 3);
    }
}
