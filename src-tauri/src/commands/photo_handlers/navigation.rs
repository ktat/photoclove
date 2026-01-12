//! Photo navigation handlers.
//!
//! Handles next/previous photo navigation within a date.

use crate::entity::photo;
use crate::entity::photo_meta;
use crate::repository::{self, MetaInfoDB, RepositoryDB};
use crate::value::date;

/// Navigation direction
#[derive(Debug, Clone, Copy)]
pub enum Direction {
    Next,
    Previous,
}

/// Get adjacent photo in a date's photo list.
///
/// Returns the path of the next or previous photo within the same date,
/// respecting the specified sort order.
///
/// # Arguments
/// * `repo_db` - Repository database connection
/// * `meta_db` - Metadata database connection
/// * `direction` - Navigation direction (Next or Previous)
/// * `path` - Current photo path
/// * `date` - Date to search within
/// * `sort_value` - Sort order value
///
/// # Returns
/// Path of adjacent photo, or empty string if none
pub async fn get_adjacent_photo<M: MetaInfoDB, R: RepositoryDB>(
    repo_db: &R,
    meta_db: &M,
    direction: Direction,
    path: &str,
    date: date::Date,
    sort_value: i32,
) -> Result<String, ()> {
    // Get metadata for the date
    let meta_data = match meta_db.get_photo_meta_data_in_date(date) {
        Ok(data) => data,
        Err(_e) => photo_meta::PhotoMetas::new(),
    };

    let photo: Option<photo::Photo> = match direction {
        Direction::Next => {
            repo_db
                .get_next_photo_in_date(
                    &meta_data,
                    path,
                    date,
                    repository::sort_from_int(sort_value),
                    None,
                )
                .await
        }
        Direction::Previous => {
            repo_db
                .get_prev_photo_in_date(
                    &meta_data,
                    path,
                    date,
                    repository::sort_from_int(sort_value),
                    None,
                )
                .await
        }
    };

    if let Some(p) = photo {
        Ok(p.file.path)
    } else {
        Ok(String::new())
    }
}

/// Handle get next photo request.
///
/// # Arguments
/// * `repo_db` - Repository database connection
/// * `meta_db` - Metadata database connection
/// * `path` - Current photo path
/// * `date_str` - Date string to search within
/// * `sort_value` - Sort order value
///
/// # Returns
/// Next photo path, empty string if none
pub async fn handle_next<M: MetaInfoDB, R: RepositoryDB>(
    repo_db: &R,
    meta_db: &M,
    path: &str,
    date_str: &str,
    sort_value: i32,
) -> Result<String, ()> {
    if date_str.trim().is_empty() {
        return Err(());
    }
    let d = date::Date::from_string(&date_str.to_string(), None);
    get_adjacent_photo(repo_db, meta_db, Direction::Next, path, d, sort_value).await
}

/// Handle get previous photo request.
///
/// # Arguments
/// * `repo_db` - Repository database connection
/// * `meta_db` - Metadata database connection
/// * `path` - Current photo path
/// * `date_str` - Date string to search within
/// * `sort_value` - Sort order value
///
/// # Returns
/// Previous photo path, empty string if none
pub async fn handle_prev<M: MetaInfoDB, R: RepositoryDB>(
    repo_db: &R,
    meta_db: &M,
    path: &str,
    date_str: &str,
    sort_value: i32,
) -> Result<String, ()> {
    if date_str.trim().is_empty() {
        return Err(());
    }
    let d = date::Date::from_string(&date_str.to_string(), None);
    get_adjacent_photo(repo_db, meta_db, Direction::Previous, path, d, sort_value).await
}
