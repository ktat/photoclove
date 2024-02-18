use crate::entity::trash;
use crate::value::file;
use std::{fs, path};

pub fn move_to_trash(file: file::File, trash: trash::Trash) {
    let trash_path = path::Path::new(&trash.dir.path);
    let target_file = path::Path::new(&file.path);
    let parent_path = target_file.parent().unwrap().strip_prefix("/").unwrap();
    print!("pp {:?}", parent_path);
    let target_trash_dir = trash_path.join(parent_path);
    print!("tp {:?}", target_trash_dir);

    // TODO: check directory exists.
    fs::create_dir_all(target_trash_dir.clone());

    let target_path = target_trash_dir.join(target_file.file_name().unwrap());
    eprintln!("{:?} => {:?}", target_file, target_path);
    match fs::copy(target_file, target_path) {
        Ok(_) => match fs::remove_file(target_file) {
            Ok(_) => (),
            Err(err) => {
                eprintln!("failed to remove file after copy: {:?}", err);
            }
        },
        Err(err) => {
            eprintln!("failed to copy file to trash: {:?}", err);
        }
    };
}
