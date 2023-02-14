use crate::value::{date, file};
use regex::Regex;
use std::fs;

pub fn find_files(dir: &file::Dir) -> file::Files {
    let mut f = file::Files { files: Vec::new() };
    let readdir = fs::read_dir(&dir.path);
    if readdir.is_ok() {
        for entry in readdir.unwrap() {
            let entry = entry.unwrap();
            let entry_path = entry.path();
            let file_name = entry_path.file_name().unwrap();

            if file_name.to_string_lossy().chars().next().unwrap() == '.' {
                continue;
            }
            if entry_path.display().to_string() != ".".to_string() && entry_path.is_file() {
                f.files
                    .push(file::File::new(entry_path.display().to_string()));
            }
        }
        return f;
    } else {
        panic!("Cannot readdir: {}", dir.path.to_string())
    }
}

pub fn find_directories(dir: &file::Dir, regex: &Option<Regex>) -> file::Dirs {
    let mut f = file::Dirs { dirs: Vec::new() };
    let res = fs::read_dir(&dir.path);
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
                f.dirs
                    .push(file::Dir::new(entry_path.display().to_string()));
            }
        }
    } else {
        let p = dir.path.as_str();
        panic!("Cannot open directory: {}", p)
    }
    f
}

pub fn find_date_like_directories(dir: &file::Dir) -> file::Dirs {
    let re = &Option::Some(
        Regex::new(r"/([0-9]{4})-(0?[1-9]|1[012])-(0?[1-9]|(1|2)[0-9]|30|31)/?$").unwrap(),
    );
    find_directories(dir, re)
}

#[cfg(test)]
mod tests {
    use crate::domain_service::dir_service::find_files;
    use crate::value::file;

    #[test]
    fn test_find_files() {
        let path = "tests/assets/files";
        let dir = file::Dir::new(path.to_string());
        let files = find_files(&dir);
        assert_eq!(files.files.len(), 3);
    }
}
