# Roll the Photos/Photo pattern into remaining multi-photo processing sites

Date: 2026-07-05

## Background

An earlier change introduced two enumeration primitives and pure `Photo`
predicates, and migrated video-thumbnail generation to them:

- `photo_service::photos_from_dir_recursive(dir, import_to, config) -> photo::Photos`
  — scans a directory (recursing UUID subdirectories) into a `Photos` bundle,
  with paths relative to `import_to` and `config` embedded so `Photo::absolute_path`
  / `Photo::get_thumbnail_path` resolve.
- `dir_service::find_files(dir) -> file::Files` — absolute paths, recurses UUID
  subdirectories (the primitive `photos_from_dir_recursive` is built on).
- `Photo::is_video / is_raw / is_heic_or_avif / is_image / extension` — pure,
  I/O-free predicates delegating to `utils::raw_file`.

Several other sites still enumerate files with hand-rolled `read_dir` walks and
re-derive extension logic with raw string checks (`raw_file::is_*` on `&str`,
`path.extension()` comparisons). This change rolls the established pattern into
those sites for consistency, and fixes one latent bug found along the way.

## Goal

Convert the identified multi-photo processing sites to use the `Photos`/`Photo`
pattern (or the `find_files` primitive where the base directory is not
`import_to`), replacing manual enumeration and string-based extension checks.

## Scope (4 sites)

### 1. `commands/job_helpers.rs::filter_image_paths` (trivial)

`filter_image_paths` already receives `&[Photo]`. Replace the raw-string route
with the predicate on the object in hand:

```rust
// before
.filter(|p| is_image_file(&p.file.path))
// after
.filter(|p| p.is_image())
```

`is_image_file(path: &str)` is retained only if it still has other callers;
otherwise remove it. (Verify at implementation time; remove if unused.)

### 2. `photo_service::process_raw_thumbnails` (source dir → import_to-relative)

Currently `(from: &PathBuf, to: &PathBuf, raw_config: &RawProcessingConfig)` with
a hand-rolled two-level `read_dir` (root + one level of UUID subdirs) and
`raw_file::is_raw_file`/`is_heic_or_avif` on raw filename strings.

- Add a `config: &config::Config` parameter. `create_thumbnails` already builds
  `photo_config` (with `import_to = origin`, `thumbnail_store = dest`) before the
  date loop; pass it in.
- Replace the manual walk with
  `photos_from_dir_recursive(&file::Dir::new(from...), &config.import_to, Some(config))`.
- Filter with `photo.is_raw() || photo.is_heic_or_avif()`.
- Source path = `photo.absolute_path()`; output path = `photo.get_thumbnail_path()`
  (which already produces the `{filename_lowercase}.jpg` RAW/HEIC form the current
  code builds manually). Create the output's parent dir before writing.
- Keep the EXIF/HEIC/RAW extraction + full-decode fallback logic unchanged; only
  enumeration, predicate, and path derivation change.
- `from`/`to` are retained for the early `if !from.exists() { return Ok(0) }`
  guard and directory creation.

### 3. `photo_service::create_thumbnails` — JPEG cleanup loop (BUG FIX)

Currently `std::fs::read_dir(&from)` single-level, `entry.path().extension()`
compared to `"jpg"`/`"jpeg"` with a `.jpe?g` regex. It does NOT recurse into
UUID subdirectories, so thumbnails for UUID-nested JPEGs are never cleaned — a
latent bug.

- Replace with `photos_from_dir_recursive(&file::Dir::new(from...), &photo_config.import_to, Some(&photo_config))`
  so UUID-nested photos are included (the bug fix).
- Filter JPEGs via `photo.extension()` (`"jpg"` or `"jpeg"`).
- Source file = `photo.absolute_path()`, thumbnail = `photo.get_thumbnail_path()`
  (handles `.jpe?g` → `.jpg` normalization the regex did).
- Keep the existing size-comparison delete rules unchanged: remove the thumbnail
  when the source is smaller than `ignore_file_size`, or when the thumbnail's
  size equals the source's (i.e. not actually compressed).

### 4. `photo_service::create_thumbnails::cleanup_raw_copies` (dest dir → NOT import_to)

Currently a nested recursive `read_dir` over the thumbnail destination `to`,
deleting files where `raw_file::is_raw_file(path)`.

- The base directory is `to` (thumbnail dest), NOT `import_to`, so
  `photos_from_dir_recursive` (which relativizes to `import_to`) does not fit.
  Use the absolute-path primitive instead:
  `dir_service::find_files(&file::Dir::new(to...))`.
- For each returned `file::File`, use the `Photo` predicate:
  `if photo::Photo::new(file, None).is_raw() { remove_file(&file.path) }`
  (no config needed; `is_raw` is a pure path check). The `File` from `find_files`
  carries the absolute path to delete.
- Behavior note: the current hand-rolled recursion descends into ALL
  subdirectories, whereas `find_files` recurses only UUID-named subdirectories.
  Under the thumbnail dest, subdirectories are UUID dirs, so this is equivalent
  in practice; documented here as an intentional, accepted difference.

## Out of scope (per prior agreement)

- `job_queue/executor.rs` AI-tagging filter and `s3_sync.rs` face-thumbnail loop
  — operate on `Vec<String>` with no `Photo` in scope; wrapping each string in a
  `Photo` just to call one predicate is not worth it.
- `repository/dir.rs` import regex — already centralized in a single regex.
- `stats_queries.rs` (extension-agnostic size counting), `dir_service::find_files`
  (the primitive itself), `repository/db/directory.rs` (already Photo-based; its
  `matches_extension_filter` is a different, user-supplied-filter feature).

## Testing

- `filter_image_paths`: unit test that a mixed `Vec<Photo>` (jpg, cr2, mp4, txt)
  returns only image paths (jpg + cr2), excluding the mp4 and txt.
- `process_raw_thumbnails` / JPEG cleanup / `cleanup_raw_copies` are I/O-heavy
  (image decode, ffmpeg-adjacent, filesystem) and thinly unit-tested today. Limit
  changes to enumeration/predicate/path derivation and rely on: `cargo build`,
  `cargo clippy -D warnings`, existing tests, and — where cheap — a `tempfile`
  test that the enumeration includes UUID-nested files (proving the recursion,
  i.e. the JPEG-cleanup bug fix). Do not attempt to unit-test the actual image
  decoding.

## Global constraints

- Files under 600 lines; structured logging only (no `println!`); I/O stays in
  the service layer, the `Photo` entity stays pure.
- Verify from `src-tauri/`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
  `cargo test --bin photoclove`.

## Risks

- `Photo::new` performs one `stat` per file (via `created_datetime()`); these
  sites may stat more files than before. Acceptable (same tradeoff accepted for
  `generate_video_thumbnails`).
- Site #3 changes behavior (now recurses UUID subdirs) — this is the intended
  bug fix, not a regression.
