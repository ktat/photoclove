use crate::value::date;
use chrono::{Local, TimeZone};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::os::unix::prelude::MetadataExt;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct File {
    pub path: String,
    pub name: String,
    pub created_at: String,
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
    let metadata = std::fs::metadata(path).unwrap();
    let epoch = metadata.ctime();
    Local.timestamp_opt(epoch, 0).unwrap().to_string()
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
            eprintln!("Invalid path for Dir: {:?}", cp.err());
            return Dir {
                path: "/".to_string(),
                created_at: get_created_time("/".to_string()),
            };
        } else {
            let ap = fs::canonicalize(p).unwrap().as_path().display().to_string();
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
}

impl File {
    pub fn new(path: String) -> File {
        let p = Path::new(&path);
        let cp = fs::canonicalize(p);
        if cp.is_err() {
            panic!("Invalid path for file(new): {:?}, {:?}", path, cp.err());
        } else {
            let ap = cp.unwrap().as_path().display().to_string();
            let file_name = p.file_name().unwrap().to_str().unwrap().to_string();
            return File {
                path: ap.clone(),
                name: file_name,
                created_at: get_created_time(ap),
            };
        }
    }

    pub fn new_if_exists(path: String) -> Option<File> {
        let p = Path::new(&path);
        let cp = fs::canonicalize(p);
        if cp.is_err() {
            eprintln!(
                "Invalid path for file(new_if_exists): {:?}, {:?}",
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
}
