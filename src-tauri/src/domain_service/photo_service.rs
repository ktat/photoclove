use crate::domain::photo;
use crate::repository::{MetaDB, MetaInfoDB};
use crate::value::{comment, date, file, star};
use image_compressor::{Factor, FolderCompressor};
use std::error::Error;
use std::path::PathBuf;
use std::sync::mpsc;

pub fn photos_from_dir(files: file::Files) -> photo::Photos {
    let mut photos = photo::Photos::new();
    for file in files.files {
        let p = photo::Photo::new(file);
        photos.photos.push(p)
    }
    photos
}

pub fn save_photo_star(db: &MetaDB, photo: &photo::Photo, star: star::Star) {
    db.save_star(photo, star)
}

pub fn save_photo_comment(db: &MetaDB, photo: &photo::Photo, comment: comment::Comment) {
    db.save_comment(photo, comment)
}

pub async fn create_thumbnails(
    dates: date::Dates,
    origin: &PathBuf,
    dest: &PathBuf,
    thread_count: u32,
    quolity: f32,
    size_ratio: f32,
) -> Result<(), Box<dyn Error>> {
    let mut last_result: Result<(), Box<dyn Error>> = Result::Ok(());
    for date in dates.dates {
        eprintln!("{}", date.to_string());
        let (tx, tr) = mpsc::channel(); // Sender and Receiver. for more info, check mpsc and message passing.
        let from = origin.join(date.to_string());
        let to = dest.join(date.to_string());

        let mut comp = FolderCompressor::new(from, to);
        let factor = Factor::new(quolity * 100 as f32, size_ratio);
        comp.set_factor(factor);
        comp.set_thread_count(thread_count);
        comp.set_sender(tx);
        let r = comp.compress();
        match r {
            Ok(ret) => {
                last_result = r;
                eprintln!("Success");
            }
            Err(ref e) => {
                eprintln!("{}", e.to_string());
                return r;
            }
        }
    }

    return last_result;
}

#[cfg(test)]
mod tests {
    use crate::domain_service::{dir_service, photo_service};
    use crate::value::file;

    #[test]
    fn test_make_photos() {
        let dir = file::Dir::new("tests/assets/files".to_string());
        let files = dir_service::find_files(&dir);
        let photos = photo_service::photos_from_dir(files);
        assert_eq!(photos.photos.len(), 3)
    }
}
