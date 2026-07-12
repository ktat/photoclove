use super::*;

const TEST_DATE: &str = "2024-05-13";

fn test_config(thumbnail_store: &str) -> config::Config {
    serde_json::from_value(serde_json::json!({
        "repository": { "store": "directory", "option": {} },
        "import_to": "/library",
        "export_from": [],
        "trash_path": "/trash",
        "thumbnail_store": thumbnail_store,
        "thumbnail_ratio": 0.1,
        "thumbnail_compression_quality": 80.0,
        "thumbnail_ignore_file_size": 0,
        "copy_parallel": 1,
        "thumbnail_parallel": 1,
        "use_count": 0
    }))
    .unwrap()
}

/// Create a library root with photo files under a date directory and
/// matching PhotoMetas keyed by relative path.
fn setup_library(
    test_name: &str,
    file_names: &[&str],
) -> (std::path::PathBuf, Directory, photo_meta::PhotoMetas) {
    let root = std::env::temp_dir()
        .join("photoclove_directory_tests")
        .join(test_name);
    let date_dir = root.join(TEST_DATE);
    std::fs::create_dir_all(&date_dir).unwrap();

    let mut metas = photo_meta::PhotoMetas::new();
    for name in file_names {
        std::fs::write(date_dir.join(name), b"x").unwrap();
        let rel = format!("{}/{}", TEST_DATE, name);
        let p = photo::Photo::new(file::File::from_relative(rel.clone()), None);
        metas.insert(&rel, photo_meta::PhotoMeta::new_from_photo(&p));
    }

    let dir = Directory::new(root.to_str().unwrap().to_string());
    (root, dir, metas)
}

fn block_on<F: std::future::Future>(f: F) -> F::Output {
    tokio::runtime::Runtime::new().unwrap().block_on(f)
}

fn paths(photos: &photo::Photos) -> Vec<String> {
    photos.photos.iter().map(|p| p.file.path.clone()).collect()
}

#[test]
fn test_get_photos_in_date_pagination() {
    let (_root, dir, metas) = setup_library("pagination", &["a.jpg", "b.jpg", "c.jpg"]);
    let date = date::Date::from_string(&TEST_DATE.to_string(), Some("-"));

    let page1 = block_on(dir.get_photos_in_date(
        &metas,
        date,
        Sort::NameAsc,
        2,
        1,
        0,
        0,
        false,
        "all",
        None,
    ));
    assert_eq!(
        paths(&page1),
        vec![
            format!("{}/a.jpg", TEST_DATE),
            format!("{}/b.jpg", TEST_DATE)
        ]
    );
    assert!(page1.has_next);
    assert!(!page1.has_prev);

    let page2 = block_on(dir.get_photos_in_date(
        &metas,
        date,
        Sort::NameAsc,
        2,
        2,
        0,
        0,
        false,
        "all",
        None,
    ));
    assert_eq!(paths(&page2), vec![format!("{}/c.jpg", TEST_DATE)]);
    assert!(!page2.has_next);
    assert!(page2.has_prev);
}

#[test]
fn test_get_photos_in_date_sets_thumbnail_state_for_returned_page() {
    let (root, dir, metas) = setup_library("thumbnail_state", &["a.jpg", "b.jpg"]);
    // Thumbnail exists for a.jpg only
    let thumb_store = root.join("thumbs");
    std::fs::create_dir_all(thumb_store.join(TEST_DATE)).unwrap();
    std::fs::write(thumb_store.join(TEST_DATE).join("a.jpg"), b"t").unwrap();

    let conf = test_config(thumb_store.to_str().unwrap());
    let date = date::Date::from_string(&TEST_DATE.to_string(), Some("-"));
    let photos = block_on(dir.get_photos_in_date(
        &metas,
        date,
        Sort::NameAsc,
        10,
        1,
        0,
        0,
        false,
        "all",
        Some(conf),
    ));
    assert_eq!(photos.photos.len(), 2);
    assert!(photos.photos[0].has_thumbnail, "a.jpg has a thumbnail");
    assert!(!photos.photos[1].has_thumbnail, "b.jpg has no thumbnail");
}

#[test]
fn test_get_next_and_prev_photo_in_date() {
    let (_root, dir, metas) = setup_library("navigation", &["a.jpg", "b.jpg", "c.jpg"]);
    let date = date::Date::from_string(&TEST_DATE.to_string(), Some("-"));

    let next_of_b = block_on(dir.get_next_photo_in_date(
        &metas,
        &format!("{}/b.jpg", TEST_DATE),
        date,
        Sort::NameAsc,
        None,
    ));
    assert_eq!(next_of_b.unwrap().file.path, format!("{}/c.jpg", TEST_DATE));

    let next_of_c = block_on(dir.get_next_photo_in_date(
        &metas,
        &format!("{}/c.jpg", TEST_DATE),
        date,
        Sort::NameAsc,
        None,
    ));
    assert!(next_of_c.is_none());

    let prev_of_b = block_on(dir.get_prev_photo_in_date(
        &metas,
        &format!("{}/b.jpg", TEST_DATE),
        date,
        Sort::NameAsc,
        None,
    ));
    assert_eq!(prev_of_b.unwrap().file.path, format!("{}/a.jpg", TEST_DATE));

    let prev_of_a = block_on(dir.get_prev_photo_in_date(
        &metas,
        &format!("{}/a.jpg", TEST_DATE),
        date,
        Sort::NameAsc,
        None,
    ));
    assert!(prev_of_a.is_none());

    let next_of_unknown = block_on(dir.get_next_photo_in_date(
        &metas,
        &format!("{}/zzz.jpg", TEST_DATE),
        date,
        Sort::NameAsc,
        None,
    ));
    assert!(next_of_unknown.is_none());
}
