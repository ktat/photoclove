use crate::entity::trash;
use crate::value::file;
use std::{fs, path};

pub fn move_to_trash(file: file::File, trash: trash::Trash) -> Result<(), std::io::Error> {
    let trash_path = path::Path::new(&trash.dir.path);
    let target_file = path::Path::new(&file.path);

    // Check if source file exists
    if !target_file.exists() {
        log::warn!(target: "file_service", "move_to_trash_file_not_found; path={:?}; status=skipping_file_operation", target_file);
        // File doesn't exist, but we still want to remove it from DB
        // Return Ok to allow database cleanup to proceed
        return Ok(());
    }

    let parent_path = target_file.parent().unwrap().strip_prefix("/").unwrap();
    log::debug!(target: "file_service", "move_to_trash_path_info; parent_path={:?}", parent_path);
    let target_trash_dir = trash_path.join(parent_path);
    log::debug!(target: "file_service", "move_to_trash_path_info; trash_dir={:?}", target_trash_dir);

    // Create trash directory structure
    fs::create_dir_all(target_trash_dir.clone())?;

    let target_path = target_trash_dir.join(target_file.file_name().unwrap());
    log::info!(target: "file_service", "move_to_trash; source={:?}; destination={:?}", target_file, target_path);

    // Copy to trash
    fs::copy(target_file, target_path)?;

    // Remove original file
    fs::remove_file(target_file)?;

    log::info!(target: "file_service", "move_to_trash_success; status=completed");
    Ok(())
}

pub fn restore_from_trash(
    file: file::File,
    trash: trash::Trash,
    _library_path: String,
) -> Result<(), std::io::Error> {
    let trash_path = path::Path::new(&trash.dir.path);
    let target_file = path::Path::new(&file.path);

    // Find the file in trash directory structure
    // The trash preserves the full path structure, so we need to strip the leading slash
    let parent_path = target_file.parent().unwrap().strip_prefix("/").unwrap();
    let trash_file_path = trash_path
        .join(parent_path)
        .join(target_file.file_name().unwrap());

    // Restore to original location (target_file.parent() already contains the full path)
    let restore_dir = target_file.parent().unwrap();
    fs::create_dir_all(&restore_dir)?;

    let restore_path = restore_dir.join(target_file.file_name().unwrap());

    log::info!(target: "file_service", "restore_from_trash; source={:?}; destination={:?}", trash_file_path, restore_path);

    // Copy from trash back to library
    fs::copy(&trash_file_path, &restore_path)?;

    // Remove from trash directory
    fs::remove_file(&trash_file_path)?;

    Ok(())
}

pub fn remove_from_trash_permanently(
    file: file::File,
    trash: trash::Trash,
) -> Result<(), std::io::Error> {
    let trash_path = path::Path::new(&trash.dir.path);
    let target_file = path::Path::new(&file.path);

    // Find the file in trash directory structure
    let parent_path = target_file.parent().unwrap().strip_prefix("/").unwrap();
    let trash_file_path = trash_path
        .join(parent_path)
        .join(target_file.file_name().unwrap());

    log::info!(target: "file_service", "remove_from_trash_permanently; path={:?}", trash_file_path);

    // Permanently delete from trash directory
    fs::remove_file(&trash_file_path)?;

    Ok(())
}
