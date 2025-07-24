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
    log::info!(target: "file_service", "move_to_trash; source={:?}; destination={:?}", target_file, target_path);
    match fs::copy(target_file, target_path) {
        Ok(_) => match fs::remove_file(target_file) {
            Ok(_) => (),
            Err(err) => {
                log::error!(target: "file_service", "move_to_trash_error; operation=remove_after_copy; error={:?}", err);
            }
        },
        Err(err) => {
            log::error!(target: "file_service", "move_to_trash_error; operation=copy_to_trash; error={:?}", err);
        }
    };
}

pub fn restore_from_trash(file: file::File, trash: trash::Trash, library_path: String) -> Result<(), std::io::Error> {
    let trash_path = path::Path::new(&trash.dir.path);
    let target_file = path::Path::new(&file.path);
    let library_base = path::Path::new(&library_path);
    
    // Find the file in trash directory structure
    let parent_path = target_file.parent().unwrap().strip_prefix("/").unwrap();
    let trash_file_path = trash_path.join(parent_path).join(target_file.file_name().unwrap());
    
    // Restore to original location in library
    let restore_dir = library_base.join(parent_path);
    fs::create_dir_all(&restore_dir)?;
    
    let restore_path = restore_dir.join(target_file.file_name().unwrap());
    
    log::info!(target: "file_service", "restore_from_trash; source={:?}; destination={:?}", trash_file_path, restore_path);
    
    // Copy from trash back to library
    fs::copy(&trash_file_path, &restore_path)?;
    
    // Remove from trash directory
    fs::remove_file(&trash_file_path)?;
    
    Ok(())
}

pub fn remove_from_trash_permanently(file: file::File, trash: trash::Trash) -> Result<(), std::io::Error> {
    let trash_path = path::Path::new(&trash.dir.path);
    let target_file = path::Path::new(&file.path);
    
    // Find the file in trash directory structure
    let parent_path = target_file.parent().unwrap().strip_prefix("/").unwrap();
    let trash_file_path = trash_path.join(parent_path).join(target_file.file_name().unwrap());
    
    log::info!(target: "file_service", "remove_from_trash_permanently; path={:?}", trash_file_path);
    
    // Permanently delete from trash directory
    fs::remove_file(&trash_file_path)?;
    
    Ok(())
}
