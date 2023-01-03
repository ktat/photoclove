pub mod directory {
    // just a dummy module for test

    use rexif;
    use crate::repository::*;
    use crate::value::file::*;
    use crate::domain::photo::*;
    pub struct Directory {
        path: file::Dir
    }

    impl RepositoryDB for Directory {
        fn connect(&self) {
            // nothing to do
        }
        fn get_dates(&self) -> date::Dates {
            let mut dates = date::Dates{ dates: Vec::new()};
            let dirs = self.path.find_directories();
            for mut dir in dirs.dirs {
                dates.dates.push(dir.to_date())
            }
            dates
        }
        fn get_photos_in_date(&self, date: date::Date) -> photo::Photos {
            let dir = self.path.child(date.to_string());
            let files = dir.find_files();
            let mut photos = photo::Photos{ files: Vec::new() };
            for f in files.files {
                let p = photo::Photo::new(f);
                photos.files.push(p)
            }
            photos
        }
        fn embed_photo_exif_data(&self, mut photo: photo::Photo) {
            photo.exif_entries = photo.exif();
        }
    }

    impl Directory {
        pub fn new(path: String) -> Directory {
            let dir = file::Dir::new(path);
            Directory{ path: dir }
        }
    }

}