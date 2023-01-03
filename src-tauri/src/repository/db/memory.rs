pub mod memory {
    // just a dummy module for test

    use crate::repository::*;
    use crate::value::file::*;
    pub struct Memory {
    }

    impl RepositoryDB for Memory {
        fn connect(&self) {
            // nothing to do
        }
        fn get_dates(&self) -> date::Dates {
            let mut dates = date::Dates{ dates: Vec::new()};
            dates.dates.push(date::Date::new(2022,2,1).unwrap());
            dates.dates.push(date::Date::new(2022,2,2).unwrap());
            dates
        }
        fn get_photos_in_date(&self, date: date::Date) -> photo::Photos {
            let mut photos = photo::Photos{ files: Vec::new() };
            photos.files.push(photo::Photo::new(file::File::new("./tests/assets/files/a.jpg".to_string())));
            photos.files.push(photo::Photo::new(file::File::new("./tests/assets/files/b.jpg".to_string())));
            photos.files.push(photo::Photo::new(file::File::new("./tests/assets/files/c.jpg".to_string())));
            photos
        }
        fn embed_photo_exif_data(&self, mut photo: photo::Photo) {
            photo.exif_entries = photo.exif();
        }
    }

    impl Memory {
        pub fn new() -> Memory {
            Memory{}
        }
    }

}