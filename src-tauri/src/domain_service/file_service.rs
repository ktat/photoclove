use crate::entity::trash;
use crate::value::file;
use std::{fs, path};

/// Get relative parent path from a file path, stripping the leading "/" on Unix
fn get_relative_parent(target_file: &path::Path) -> Result<path::PathBuf, std::io::Error> {
    let parent = target_file.parent().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Cannot get parent directory: {:?}", target_file),
        )
    })?;

    // On Unix, strip the leading "/" to get a relative path for joining with trash directory
    #[cfg(not(windows))]
    {
        parent
            .strip_prefix("/")
            .map(|p| p.to_path_buf())
            .or_else(|_| Ok(parent.to_path_buf()))
    }

    #[cfg(windows)]
    {
        Ok(parent.to_path_buf())
    }
}

pub fn move_to_trash(file: file::File, trash: trash::Trash, relative_path: &str) -> Result<(), std::io::Error> {
    let trash_path = path::Path::new(&trash.dir.path);
    let source_file = path::Path::new(&file.path);

    // Check if source file exists
    if !source_file.exists() {
        log::warn!(target: "file_service", "move_to_trash_file_not_found; path={:?}; status=skipping_file_operation", source_file);
        // File doesn't exist, but we still want to remove it from DB
        // Return Ok to allow database cleanup to proceed
        return Ok(());
    }

    // Use relative_path for simple trash directory structure
    // e.g., "2024-01-15/uuid/photo.jpg" → trash_dir/2024-01-15/uuid/
    let rel = path::Path::new(relative_path);
    let rel_parent = rel.parent().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Cannot get parent from relative path: {}", relative_path),
        )
    })?;
    let target_trash_dir = trash_path.join(rel_parent);
    log::debug!(target: "file_service", "move_to_trash_path_info; relative_path={}; trash_dir={:?}", relative_path, target_trash_dir);

    // Create trash directory structure
    fs::create_dir_all(target_trash_dir.clone())?;

    let file_name = source_file.file_name().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Cannot get filename: {:?}", source_file),
        )
    })?;
    let target_path = target_trash_dir.join(file_name);
    log::info!(target: "file_service", "move_to_trash; source={:?}; destination={:?}", source_file, target_path);

    // Copy to trash
    fs::copy(source_file, &target_path)?;

    // Remove original file
    fs::remove_file(source_file)?;

    log::info!(target: "file_service", "move_to_trash_success; status=completed");
    Ok(())
}

pub fn restore_from_trash(
    file: file::File,
    trash: trash::Trash,
    _library_path: String,
    relative_path: &str,
) -> Result<(), std::io::Error> {
    let trash_path = path::Path::new(&trash.dir.path);
    let restore_to = path::Path::new(&file.path);

    // Try new structure first: trash_path/relative_path
    let new_trash_file = trash_path.join(relative_path);

    // Fallback to old structure: trash_path/abs_path_without_leading_slash
    let old_trash_file = {
        let old_parent = get_relative_parent(restore_to)?;
        let file_name = restore_to.file_name().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Cannot get filename: {:?}", restore_to),
            )
        })?;
        trash_path.join(&old_parent).join(file_name)
    };

    let trash_file_path = if new_trash_file.exists() {
        new_trash_file
    } else if old_trash_file.exists() {
        log::info!(target: "file_service", "restore_from_trash_fallback; using_old_structure; path={:?}", old_trash_file);
        old_trash_file
    } else {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("File not found in trash: tried {:?} and {:?}", new_trash_file, old_trash_file),
        ));
    };

    // Restore to original location
    let restore_dir = restore_to.parent().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Cannot get parent directory for restore: {:?}", restore_to),
        )
    })?;
    fs::create_dir_all(&restore_dir)?;

    let file_name = restore_to.file_name().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Cannot get filename: {:?}", restore_to),
        )
    })?;
    let restore_path = restore_dir.join(file_name);

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
    relative_path: &str,
) -> Result<(), std::io::Error> {
    let trash_path = path::Path::new(&trash.dir.path);

    // Try new structure first: trash_path/relative_path
    let new_trash_file = trash_path.join(relative_path);

    // Fallback to old structure: trash_path/abs_path_without_leading_slash
    let target_file = path::Path::new(&file.path);
    let old_trash_file = {
        let old_parent = get_relative_parent(target_file)?;
        let file_name = target_file.file_name().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Cannot get filename: {:?}", target_file),
            )
        })?;
        trash_path.join(&old_parent).join(file_name)
    };

    let trash_file_path = if new_trash_file.exists() {
        new_trash_file
    } else if old_trash_file.exists() {
        log::info!(target: "file_service", "remove_permanently_fallback; using_old_structure; path={:?}", old_trash_file);
        old_trash_file
    } else {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("File not found in trash: tried {:?} and {:?}", new_trash_file, old_trash_file),
        ));
    };

    log::info!(target: "file_service", "remove_from_trash_permanently; path={:?}", trash_file_path);

    // Permanently delete from trash directory
    fs::remove_file(&trash_file_path)?;

    Ok(())
}
