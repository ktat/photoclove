use crate::entity::photo;
use crate::repository::{MetaDB, MetaInfoDB};
use crate::value::{comment, date, file, star};
use image_compressor::{Factor, FolderCompressor};
use regex::Regex;
use std::error::Error;
use std::path::PathBuf;
use std::process::Command;
use std::sync::mpsc;

pub fn photos_from_dir(files: file::Files) -> photo::Photos {
    let mut photos = photo::Photos::new();
    for file in files.files {
        let p = photo::Photo::new(file, Option::None);
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
    ignore_file_size: u32,
) -> Result<(), Box<dyn Error>> {
    let mut last_result: Result<(), Box<dyn Error>> = Result::Ok(());
    for date in dates.dates {
        eprintln!("{}", date.to_string());
        let (tx, tr) = mpsc::channel(); // Sender and Receiver. for more info, check mpsc and message passing.
        let from = origin.join(date.to_string());
        let to = dest.join(date.to_string());
        let mut comp = FolderCompressor::new(from.clone(), to.clone());
        let factor = Factor::new(quolity * 100 as f32, size_ratio);
        comp.set_factor(factor);
        comp.set_thread_count(thread_count);
        comp.set_sender(tx);
        let r = comp.compress();
        match r {
            Ok(ret) => {
                last_result = r;
                let ignore_file_size = ignore_file_size as u64;
                eprintln!("target: {:?} => {:?}", from, to);
                let entries = std::fs::read_dir(&from)?;

                for entry in entries {
                    let entry = entry?;
                    let file_name = entry.file_name();
                    let extension = entry
                        .path()
                        .extension()
                        .map(|ext| ext.to_string_lossy().to_lowercase());
                    if let Some(ext) = extension {
                        if ext == "jpg" || ext == "jpeg" {
                            let file_size = entry.metadata()?.len();
                            let file_name_str = file_name.to_string_lossy();
                            let re = Regex::new(r"\.(?i:jpe?g)$").unwrap();
                            let ext_with_dot = format!(".{}", ext);
                            let new_file_name = re.replace(&file_name_str, &ext_with_dot);
                            let new_file_path = to.join(new_file_name.as_ref());
                            if new_file_path.exists() {
                                if file_size < ignore_file_size {
                                    eprintln!(
                                        "remove mini size thumbnail: {:?} < {:?} {:?} < {:?}",
                                        entry.path().to_string_lossy(),
                                        new_file_path.clone(),
                                        file_size,
                                        ignore_file_size
                                    );
                                    std::fs::remove_file(new_file_path)?;
                                } else if new_file_path.exists() {
                                    let thumbnail_file_size =
                                        std::path::Path::new(&new_file_path).metadata()?.len();
                                    if thumbnail_file_size == file_size {
                                        eprintln!(
                                            "remove same size thumbnail: {:?}",
                                            new_file_path.clone()
                                        );
                                        std::fs::remove_file(new_file_path)?;
                                    }
                                }
                            } else {
                                eprintln!("{:?} not exists", new_file_path);
                            }
                        } else if ext == "mp4" || ext == "webm" {
                            let thumbnail_file_name =
                                format!("{}.jpg", file_name.to_string_lossy());
                            let thumbnail_path = to.join(thumbnail_file_name);
                            eprintln!("target {:?} => {:?}", file_name, thumbnail_path.clone());
                            let output = Command::new("ffmpeg")
                                .arg("-i")
                                .arg(entry.path().to_str().unwrap())
                                .arg("-ss")
                                .arg("00:00:01.000")
                                .arg("-vframes")
                                .arg("1")
                                .arg(thumbnail_path.clone())
                                .output();
                            if output.is_ok() {
                                let o = output.unwrap();
                                if o.status.success() {
                                    eprintln!("success!: {:?}", thumbnail_path);
                                } else {
                                    eprintln!(
                                        "Error!: {:?}, {:?} : {:?}",
                                        entry.path(),
                                        thumbnail_path,
                                        o.stderr,
                                    );
                                }
                            } else {
                                eprintln!("ffmpeg error: {:?}", output.err());
                            }
                        }
                    }
                }
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
