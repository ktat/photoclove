# Photos-centric directory scanning for thumbnail generation

Date: 2026-07-02

## Background

File-walking operations (notably video thumbnail generation) currently work
directly on the filesystem with `std::fs::read_dir` plus ad-hoc string
extension checks. `create_thumbnails` / `generate_video_thumbnails` re-derive
directory structure and thumbnail output paths by hand.

The domain already has the right pieces:

- `dir_service::find_files(dir)` recurses into UUID subdirectories.
- `photo_service::photos_from_dir(files)` wraps a `Files` list into a
  `photo::Photos` bundle (no pagination applied).
- `Photo::get_thumbnail_path()` computes the thumbnail output path from the
  relative `file.path` (handles the `.jpg` suffix for videos/RAW/HEIC and the
  UUID subdirectory layout).
- `Photo::absolute_path()` computes the source path from `import_to`.

What is missing is (a) a single entry point that scans a directory (including
UUID subdirectories) into a `Photos` bundle, and (b) type-decision methods on
`Photo` so callers stop doing scattered string checks.

## Goal

Make thumbnail generation operate on a `Photos` bundle and use `Photo`-level
methods for type decisions and path derivation. Establish the foundation
(`photos_from_dir_recursive` + `Photo` type methods) and migrate only the
**video** thumbnail step in this change.

## Non-goals

- Image / RAW / HEIC thumbnail generation (`FolderCompressor`,
  `process_raw_thumbnails`) stays as-is.
- The display path and pagination-bearing photo collections are unchanged.
- No UUID-directory aggregate entity (the bundle is just `Photos`).

## Design

### 1. `Photo` type-decision methods (`entity/photo.rs`)

Pure methods, no I/O, delegating to `utils::raw_file`:

```rust
impl Photo {
    /// Lowercase file extension without the dot (empty if none).
    pub fn extension(&self) -> String;
    pub fn is_video(&self) -> bool;         // raw_file::is_video_file
    pub fn is_raw(&self) -> bool;           // raw_file::is_raw_file
    pub fn is_heic_or_avif(&self) -> bool;  // raw_file::is_heic_or_avif
    pub fn is_image(&self) -> bool;         // raw_file::is_supported_image
}
```

All operate on `self.file.path`. Existing `get_thumbnail_path()` and
`absolute_path()` are reused unchanged.

### 2. Recursive bundle constructor (`domain_service/photo_service.rs`)

```rust
pub fn photos_from_dir_recursive(
    dir: &file::Dir,
    import_to: &str,
    config: Option<&config::Config>,
) -> photo::Photos
```

Behavior:

1. `dir_service::find_files(dir)` — recurses UUID subdirectories, returns
   absolute paths.
2. For each file, convert to a relative path against `import_to` and build
   `Photo::new(File::from_relative(rel), config.cloned())`.
3. Collect into `photo::Photos` with `has_next = has_prev = false` (no
   pagination — this is a scan bundle, not a display page).

Rationale: I/O stays in the service/repository layer; the `Photo` entity stays
pure. `config` is passed so `absolute_path()` / `get_thumbnail_path()` work.

### 3. Migrate `generate_video_thumbnails` to the bundle

Replace the manual `read_dir` recursion + string checks + path mirroring with:

```rust
let cfg = config::Config::new(); // matches record_photos_all_meta_data precedent
let photos = photos_from_dir_recursive(&file::Dir::new(from_str), &cfg.import_to, Some(&cfg));
for photo in photos.photos {
    if !photo.is_video() { continue; }
    let Some(thumb) = photo.get_thumbnail_path() else { continue; };
    if std::path::Path::new(&thumb).exists() { continue; } // skip existing
    // ffmpeg -ss 00:00:01.000 -i {photo.absolute_path()} -vframes 1 {thumb}
}
```

Notes:

- `get_thumbnail_path()` already produces `{thumbnail_store}/{date}/{uuid}/{file}.jpg`,
  so the manual UUID mirroring in the current code is removed.
- Keep fast input seeking (`-ss` before `-i`) for multi-GB files.
- Keep skip-if-exists so re-runs do not re-invoke ffmpeg on large videos.
- Create the parent directory of `thumb` before invoking ffmpeg.

**Config approach (chosen: A).** `photos_from_dir_recursive` takes explicit
`import_to` + `Option<&Config>`. `create_thumbnails` obtains the config via
`Config::new()` once (same pattern as `record_photos_all_meta_data`), avoiding
changes to `create_thumbnails`' signature or its callers.

### 4. Tests

- Unit tests for `Photo::is_video / is_raw / is_heic_or_avif / is_image /
  extension` (path-based, no I/O).
- A test that `photos_from_dir_recursive` collects photos from UUID
  subdirectories (temp dir or `tests/assets`), verifying relative paths.

## Risks / considerations

- `photos_from_dir_recursive` returns metadata-free photos (no DB star/comment/
  EXIF). This is intentional — it is a filesystem scan bundle for processing,
  not for display. Documented on the function.
- `Config::new()` reads `~/.photoclove.yml`; called once per `create_thumbnails`
  invocation (not per file), consistent with existing code.
