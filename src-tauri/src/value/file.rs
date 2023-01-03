pub mod file {
    use std::fs;
    use serde::{Serialize, Deserialize};

    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct File {
        pub path: String,
    }

    pub struct Files {
        pub files: Vec<File>,
    }

    pub struct Dir {
        pub path: String,        
    }
    pub struct Dirs {
        pub dirs: Vec<Dir>,        
    }

    impl Dir {
        pub fn new(path: String) -> Dir{
            Dir {
                path
            }
        }
        // TODO: error handling
        pub fn to_date(&mut self) -> crate::value::date::date::Date {
            let mut ymd = self.path.split("/").last().unwrap().split("-");
            let year = ymd.next().unwrap().parse::<i32>().unwrap();
            let month = ymd.next().unwrap().parse::<u32>().unwrap();
            let day = ymd.next().unwrap().parse::<u32>().unwrap();
            crate::value::date::date::Date::new(year, month, day).unwrap()
        }
        pub fn child (&self, path: String) -> Dir {
            Dir::new(self.path.to_string() + "/" + &path)
        }

        pub fn find_files(&self) -> Files {
            let mut f = Files {
                files: Vec::new(),
            };
            let readdir = fs::read_dir(&self.path);
            if readdir.is_ok() {
                for entry in readdir.unwrap() {
                    let entry = entry.unwrap();
                    let entry_path = entry.path();
                    if entry_path.display().to_string() != ".".to_string() && entry_path.is_file() {
                        f.files.push(File::new(entry_path.display().to_string()));
                    }
                }
                return f
            } else {
                panic!("Cannot readdir: {}", self.path.to_string())
            }
        }
        pub fn find_directories(&self) -> Dirs {
            let mut f = Dirs {
                dirs: Vec::new(),
            };
            let mut res = fs::read_dir(&self.path);
            if res.is_ok() {
               for entry in res.unwrap() {
                    let entry = entry.unwrap();
                    let entry_path = entry.path();
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
    }

    impl File {
        pub fn new(path: String) -> File{
            File {
                path
            }
        }

        pub fn create_file_if_not_exists(&self) -> bool {
            let p = std::path::Path::new(&self.path);
            let mut created = false;
            if ! p.exists() {
                created = true;
                std::fs::File::create(&self.path).expect("create failed");
            }
            return created
        }

    }
}

#[cfg(test)]
mod tests {
    use crate::value::file::*;

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
