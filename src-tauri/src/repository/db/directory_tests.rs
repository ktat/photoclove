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
    // Start from an empty tree: the move tests relocate files, and residue
    // from an earlier run would make a later one pass or fail on its own
    // leftovers rather than on what the test did.
    let _ = std::fs::remove_dir_all(&root);
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
fn test_get_photos_in_date_excludes_missing_files() {
    let (root, dir, mut metas) = setup_library("missing_files", &["a.jpg", "b.jpg"]);
    // Metadata row whose file does not exist on disk
    let ghost = format!("{}/ghost.jpg", TEST_DATE);
    let p = photo::Photo::new(file::File::from_relative(ghost.clone()), None);
    metas.insert(&ghost, photo_meta::PhotoMeta::new_from_photo(&p));
    // Ensure it really doesn't exist
    assert!(!root.join(TEST_DATE).join("ghost.jpg").exists());

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
        None,
    ));
    assert_eq!(
        paths(&photos),
        vec![
            format!("{}/a.jpg", TEST_DATE),
            format!("{}/b.jpg", TEST_DATE)
        ]
    );
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

/// A photo whose EXIF date says `date_time`, at `<TEST_DATE>/<name>`.
fn photo_dated(name: &str, date_time: &str) -> photo::Photo {
    let mut p = photo::Photo::new(
        file::File::new(format!("/library/{}/{}", TEST_DATE, name)),
        None,
    );
    let mut exif = exif::ExifData::empty();
    exif.date_time = date_time.to_string();
    p.embed_exif(exif);
    p
}

#[test]
fn a_photo_is_dated_from_its_own_exif() {
    // Stills carry a real EXIF timestamp, so the file is authoritative and the
    // database is not consulted even when it holds something else.
    let rel = format!("{}/P1012715.JPG", TEST_DATE);
    let stored = HashMap::from([(rel.clone(), "2024-05-20 00:00:00".to_string())]);
    let photo = photo_dated("P1012715.JPG", "2024-05-13 05:43:43");

    assert_eq!(
        target_date_string(&photo, &rel, &stored, TEST_DATE),
        "2024-05-13"
    );
}

#[test]
fn a_video_is_dated_from_the_database_not_its_container() {
    // The probe would say 2016-02-29 for this clip: a Panasonic DMC-GX8 writes
    // local time labelled UTC, so converting it adds nine hours and crosses
    // midnight. The database holds the date verified against the photos shot
    // alongside it, and that is what decides where the file goes.
    let rel = format!("{}/P1120741.MP4", TEST_DATE);
    let stored = HashMap::from([(rel.clone(), "2016-02-28 16:09:10".to_string())]);
    let video = photo_dated("P1120741.MP4", "2016-02-29 01:09:10");

    assert_eq!(
        target_date_string(&video, &rel, &stored, TEST_DATE),
        "2016-02-28"
    );
}

#[test]
fn a_video_the_database_does_not_know_stays_where_it_is() {
    // Returning the directory it already sits in means the caller's
    // `dir.path != new_dir.path` check fails and the file is left alone.
    // Moving on a value known to be unreliable is worse than not moving.
    let video = photo_dated("P1120741.MP4", "2016-02-29 01:09:10");

    assert_eq!(
        target_date_string(
            &video,
            &format!("{}/P1120741.MP4", TEST_DATE),
            &HashMap::new(),
            TEST_DATE
        ),
        TEST_DATE
    );
}

#[test]
fn a_stored_video_date_is_truncated_to_the_day() {
    // The database stores "YYYY-MM-DD HH:MM:SS"; a directory name is the date.
    let rel = format!("{}/DJI_0001.MP4", TEST_DATE);
    let stored = HashMap::from([(rel.clone(), "2026-06-29 13:30:05".to_string())]);
    let video = photo_dated("DJI_0001.MP4", "2026-06-29 13:30:05");

    assert_eq!(
        target_date_string(&video, &rel, &stored, TEST_DATE),
        "2026-06-29"
    );
}

#[test]
fn moving_a_video_reports_it_so_its_row_and_thumbnail_can_follow() {
    // Renaming the file is only half a move. The caller needs to know what
    // went where to bring the database row (star, comment, tags) and the
    // thumbnail along, so the job reports every rename it performed.
    let (root, dir, _metas) = setup_library("move_reports", &["clip.MP4"]);
    let elsewhere = "2016-02-28";
    let stored = HashMap::from([(
        format!("{}/clip.MP4", TEST_DATE),
        format!("{} 16:09:10", elsewhere),
    )]);

    let (dates, moved) = block_on(dir.move_photos_to_exif_date(
        date::Date::from_string(&TEST_DATE.to_string(), Some("-")),
        stored,
    ));

    assert!(
        root.join(elsewhere).join("clip.MP4").exists(),
        "the file itself should have moved"
    );
    assert!(!root.join(TEST_DATE).join("clip.MP4").exists());
    assert_eq!(
        moved,
        vec![repository::MovedFile {
            from: format!("{}/clip.MP4", TEST_DATE),
            to: format!("{}/clip.MP4", elsewhere),
            to_date: elsewhere.to_string(),
        }]
    );
    // Both the source and the destination need re-indexing afterwards.
    let changed: Vec<String> = dates.dates.iter().map(|d| d.to_string()).collect();
    assert!(changed.contains(&TEST_DATE.to_string()));
    assert!(changed.contains(&elsewhere.to_string()));
}

#[test]
fn a_video_with_no_stored_date_is_left_alone_and_not_reported() {
    let (root, dir, _metas) = setup_library("move_skips_unknown", &["clip.MP4"]);

    let (_dates, moved) = block_on(dir.move_photos_to_exif_date(
        date::Date::from_string(&TEST_DATE.to_string(), Some("-")),
        HashMap::new(),
    ));

    assert!(root.join(TEST_DATE).join("clip.MP4").exists());
    assert!(moved.is_empty());
}

#[test]
fn moving_a_file_out_of_an_import_directory_keeps_that_directory() {
    // The scan descends into an import's UUID subdirectory. Rebuilding the
    // destination from the date and the file name flattened that directory
    // away, which is how a clip ended up separated from its thumbnail and its
    // database row - both keyed by the whole relative path.
    let uuid = "e67cf3e1-0795-49fb-8914-0b640948ff78";
    let (root, dir, _metas) = setup_library("move_keeps_uuid", &[]);
    let import_dir = root.join(TEST_DATE).join(uuid);
    std::fs::create_dir_all(&import_dir).unwrap();
    std::fs::write(import_dir.join("clip.MP4"), b"x").unwrap();

    let elsewhere = "2016-02-28";
    let stored = HashMap::from([(
        format!("{}/{}/clip.MP4", TEST_DATE, uuid),
        format!("{} 16:09:10", elsewhere),
    )]);

    let (_dates, moved) = block_on(dir.move_photos_to_exif_date(
        date::Date::from_string(&TEST_DATE.to_string(), Some("-")),
        stored,
    ));

    assert!(
        root.join(elsewhere).join(uuid).join("clip.MP4").exists(),
        "the import directory should exist under the new date"
    );
    assert!(!root.join(elsewhere).join("clip.MP4").exists());
    assert_eq!(
        moved,
        vec![repository::MovedFile {
            from: format!("{}/{}/clip.MP4", TEST_DATE, uuid),
            to: format!("{}/{}/clip.MP4", elsewhere, uuid),
            to_date: elsewhere.to_string(),
        }]
    );
}
