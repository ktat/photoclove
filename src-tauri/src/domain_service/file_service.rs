use crate::value::file;
use crate::domain::trash;
use std::{path,fs};

pub fn move_to_trash (file: file::File, trash: trash::Trash) {
    print!("MOVE TO TRASH");
    let trash_path = path::Path::new(&trash.dir.path);
    let target_file = path::Path::new(&file.path);
    let parent_path = target_file.parent().unwrap().strip_prefix("/").unwrap();
    print!("pp {:?}", parent_path);
    let target_trash_dir = trash_path.join(parent_path);
    print!("tp {:?}", target_trash_dir);

    // TODO: check directory exists.
    fs::create_dir_all(target_trash_dir.clone());

    let target_path = target_trash_dir.join(target_file.file_name().unwrap());
    print!("{:?} => {:?}", target_file, target_path);
    fs::rename(target_file, target_path);
}

