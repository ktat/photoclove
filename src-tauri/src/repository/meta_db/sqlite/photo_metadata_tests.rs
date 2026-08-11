//! Tests for photo metadata recording and retrieval.
//!
//! Split out of `photo_metadata.rs`, which had grown past the repository's
//! file-length limit. Included with `#[path]` from there, matching how
//! `directory.rs` carries `directory_tests.rs`.

use super::*;

fn setup_db(name: &str) -> SQLite {
    let dir = std::env::temp_dir()
        .join("photoclove_photo_metadata_tests")
        .join(name);
    std::fs::create_dir_all(&dir).unwrap();
    let db_file = dir.join("photoclove.db");
    if db_file.exists() {
        std::fs::remove_file(&db_file).unwrap();
    }
    SQLite::new(dir.to_str().unwrap().to_string())
}

#[test]
fn test_get_photo_meta_data_in_date_filters_by_date_and_hydrates_tags() {
    let db = setup_db("in_date");
    let conn = db.get_connection().unwrap();
    conn.execute(
        "INSERT INTO photo_metadata (path, photo_date, star, comment) VALUES
         ('2024-05-13/a.jpg', '2024-05-13 10:00:00', 3, 'hi'),
         ('2024-05-13/b.jpg', '2024-05-13 11:00:00', 0, ''),
         ('2024-05-14/c.jpg', '2024-05-14 09:00:00', 0, '')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO photo_collections (type, name, color) VALUES ('tag', 'trip', '#fff')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO photo_collection_items (collection_id, photo_path)
         VALUES ((SELECT id FROM photo_collections WHERE name='trip'), '2024-05-13/a.jpg')",
        [],
    )
    .unwrap();
    // Deleted photo on the same date must be excluded
    conn.execute(
        "INSERT INTO photo_metadata (path, photo_date, delete_flg) VALUES
         ('2024-05-13/deleted.jpg', '2024-05-13 12:00:00', 1)",
        [],
    )
    .unwrap();

    let date = date::Date::new(2024, 5, 13).unwrap();
    let metas = get_photo_meta_data_in_date(&db, date).unwrap();

    assert_eq!(
        metas.keys().len(),
        2,
        "same-date photos only, minus deleted"
    );
    let a = metas.get("2024-05-13/a.jpg").unwrap();
    assert_eq!(a.star.star(), 3);
    assert_eq!(a.comment.comment(), "hi");
    assert_eq!(a.photo_time(), "2024-05-13 10:00:00");
    let tags = a.tags_string().expect("a.jpg has a tag");
    assert!(tags.contains("trip"), "tags_string={}", tags);

    let b = metas.get("2024-05-13/b.jpg").unwrap();
    assert!(b.tags_string().is_none(), "b.jpg has no tags");

    assert!(metas.get("2024-05-14/c.jpg").is_none());
    assert!(metas.get("2024-05-13/deleted.jpg").is_none());
}

#[test]
fn test_record_photos_meta_data_video_without_ffprobe_falls_back_to_ctime() {
    // No real video file on disk (ffprobe will fail to find it, or
    // isn't installed in this test environment either way) — this test
    // only asserts the row gets written at all with a non-empty date,
    // covering the fallback path without depending on ffprobe being
    // installed.
    let db = setup_db("video_no_ffprobe");
    let dir = std::env::temp_dir()
        .join("photoclove_photo_metadata_video_tests")
        .join("video_no_ffprobe_files")
        .join("2024-05-13");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("clip.mp4"), b"not a real video").unwrap();

    let f = file::File::from_relative("2024-05-13/clip.mp4".to_string());
    let photo = photo::Photo::new(f, None);

    let inserted = record_photos_meta_data(&db, vec![photo]).unwrap();
    assert_eq!(inserted, 1);

    let conn = db.get_connection().unwrap();
    let date: String = conn
        .query_row(
            "SELECT photo_date FROM photo_metadata WHERE path = ?1",
            params!["2024-05-13/clip.mp4"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(date, "2024-05-13 00:00:00");
}

#[test]
fn test_get_stored_capture_times_drops_only_the_dateless_row() {
    // A row with no usable date must drop itself and nothing else: the
    // caller falls back to an empty map on `Err`, which would freeze every
    // file in the directory rather than just the one bad row.
    let db = setup_db("stored_capture_times");
    let conn = db.get_connection().unwrap();
    conn.execute(
        "INSERT INTO photo_metadata (path, photo_date, exif_date_time, exif_date_time_original)
         VALUES ('2024-05-13/dated.mp4', '2024-05-13 00:00:00', '2024-05-14 09:00:00', NULL),
                ('2024-05-13/undated.mp4', '', NULL, NULL),
                ('2024-05-13/sub/nested.mp4', '2024-05-13 00:00:00', NULL, NULL)",
        [],
    )
    .unwrap();

    let times =
        get_stored_capture_times(&db, date::Date::new(2024, 5, 13).unwrap()).expect("query");

    assert_eq!(
        times.get("2024-05-13/dated.mp4").map(String::as_str),
        Some("2024-05-14 09:00:00"),
        "exif_date_time outranks photo_date"
    );
    assert!(
        !times.contains_key("2024-05-13/undated.mp4"),
        "no date means no entry"
    );
    assert_eq!(
        times.get("2024-05-13/sub/nested.mp4").map(String::as_str),
        Some("2024-05-13 00:00:00"),
        "rows in an import subdirectory are keyed by their whole path"
    );
}
