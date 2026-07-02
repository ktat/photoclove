# Photos-centric directory scanning for thumbnail generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make video thumbnail generation iterate a `Photos` bundle and use `Photo`-level type/path methods instead of raw `read_dir` + string checks.

**Architecture:** Add pure type-decision methods to the `Photo` entity, add a service-layer `photos_from_dir_recursive` that scans a directory (including UUID subdirectories) into a `photo::Photos`, then rewrite `generate_video_thumbnails` to consume that bundle and reuse `Photo::get_thumbnail_path()` / `Photo::absolute_path()`.

**Tech Stack:** Rust (Tauri backend), `cargo test`, `tempfile` crate (already a dependency), `ffmpeg` (external, invoked via `std::process::Command`).

## Global Constraints

- Keep files under 600 lines.
- Structured logging only: `log::info!/debug!/error!(target: "...", "event; key={}", val)`. No `println!`.
- I/O stays in the service/repository layer; the `Photo` entity stays pure (no filesystem access in `entity/photo.rs`).
- Rust check/tests: `cargo test --bin photoclove` and `cargo check --bin photoclove` run from `src-tauri/`.

---

### Task 1: `Photo` type-decision methods

**Files:**
- Modify: `src-tauri/src/entity/photo.rs` (add methods to `impl Photo`, add tests to the existing `#[cfg(test)] mod tests` at line ~361)

**Interfaces:**
- Consumes: `crate::utils::raw_file::{is_video_file, is_raw_file, is_heic_or_avif, is_supported_image}` (all exist).
- Produces:
  - `Photo::extension(&self) -> String`
  - `Photo::is_video(&self) -> bool`
  - `Photo::is_raw(&self) -> bool`
  - `Photo::is_heic_or_avif(&self) -> bool`
  - `Photo::is_image(&self) -> bool`

- [ ] **Step 1: Write the failing test**

Add to `mod tests` in `src-tauri/src/entity/photo.rs`:

```rust
    #[test]
    fn test_type_predicates() {
        let mk = |p: &str| photo::Photo::new(file::File::from_relative(p.to_string()), None);
        assert!(mk("2026-06-29/uuid/DJI.MP4").is_video());
        assert!(!mk("2026-06-29/uuid/DJI.MP4").is_image());
        assert!(mk("d/x.jpg").is_image());
        assert!(!mk("d/x.jpg").is_video());
        assert!(mk("d/x.CR2").is_raw());
        assert!(mk("d/x.heic").is_heic_or_avif());
        assert_eq!(mk("d/x.MP4").extension(), "mp4");
        assert_eq!(mk("d/noext").extension(), "");
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --bin photoclove test_type_predicates -- --nocapture`
Expected: FAIL — compile error `no method named is_video` (methods not defined yet).

- [ ] **Step 3: Write minimal implementation**

Add inside `impl Photo { ... }` in `src-tauri/src/entity/photo.rs` (e.g. right after `absolute_path`):

```rust
    /// Lowercase file extension without the dot (empty string if none).
    pub fn extension(&self) -> String {
        std::path::Path::new(&self.file.path)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default()
    }

    /// True if the file is a supported video (mp4/webm/mov/...).
    pub fn is_video(&self) -> bool {
        crate::utils::raw_file::is_video_file(&self.file.path)
    }

    /// True if the file is a RAW camera file.
    pub fn is_raw(&self) -> bool {
        crate::utils::raw_file::is_raw_file(&self.file.path)
    }

    /// True if the file is a HEIC/HEIF/AVIF file.
    pub fn is_heic_or_avif(&self) -> bool {
        crate::utils::raw_file::is_heic_or_avif(&self.file.path)
    }

    /// True if the file is a supported still image (standard + RAW).
    pub fn is_image(&self) -> bool {
        crate::utils::raw_file::is_supported_image(&self.file.path)
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test --bin photoclove test_type_predicates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/entity/photo.rs
git commit -m "feat(photo): add pure type-decision methods (is_video/is_raw/is_heic_or_avif/is_image/extension)"
```

---

### Task 2: `photos_from_dir_recursive` service constructor

**Files:**
- Modify: `src-tauri/src/domain_service/photo_service.rs` (add function after `photos_from_dir` at line ~20; add test to the existing `#[cfg(test)] mod tests` at line ~337)

**Interfaces:**
- Consumes: `crate::domain_service::dir_service::find_files`, `file::to_relative_path`, `file::File::from_relative`, `file::Dir`, `photo::Photo::new`, `photo::Photos::new`, `crate::entity::config::Config`.
- Produces:
  - `photo_service::photos_from_dir_recursive(dir: &file::Dir, import_to: &str, config: Option<&crate::entity::config::Config>) -> photo::Photos`

- [ ] **Step 1: Write the failing test**

Add to `mod tests` in `src-tauri/src/domain_service/photo_service.rs`:

```rust
    #[test]
    fn test_photos_from_dir_recursive_includes_uuid_subdir() {
        use std::fs;
        let tmp = tempfile::tempdir().unwrap();
        let base = tmp.path();
        let uuid = "caa83a09-5960-46f1-90f1-6bc0769eb42f";
        let date_dir = base.join("2026-06-29");
        let uuid_dir = date_dir.join(uuid);
        fs::create_dir_all(&uuid_dir).unwrap();
        fs::write(uuid_dir.join("video.mp4"), b"x").unwrap();
        fs::write(date_dir.join("top.jpg"), b"x").unwrap();

        let dir = file::Dir::new(date_dir.display().to_string());
        let photos = photo_service::photos_from_dir_recursive(
            &dir,
            &base.display().to_string(),
            None,
        );

        let paths: Vec<String> = photos.photos.iter().map(|p| p.file.path.clone()).collect();
        assert!(paths.iter().any(|p| p == "2026-06-29/caa83a09-5960-46f1-90f1-6bc0769eb42f/video.mp4"));
        assert!(paths.iter().any(|p| p == "2026-06-29/top.jpg"));
        assert!(!photos.has_next && !photos.has_prev);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --bin photoclove test_photos_from_dir_recursive_includes_uuid_subdir`
Expected: FAIL — `no function named photos_from_dir_recursive`.

- [ ] **Step 3: Write minimal implementation**

Add after `photos_from_dir` (around line 20) in `src-tauri/src/domain_service/photo_service.rs`:

```rust
/// Scan `dir` (recursing into UUID subdirectories) into a `Photos` bundle.
///
/// This is a filesystem scan bundle for processing (thumbnails, rebuild), not a
/// display page: photos carry no DB metadata (star/comment/EXIF) and no
/// pagination is applied (`has_next`/`has_prev` stay `false`). File paths are
/// stored relative to `import_to`. `config` is embedded so `Photo::absolute_path`
/// and `Photo::get_thumbnail_path` resolve correctly.
pub fn photos_from_dir_recursive(
    dir: &file::Dir,
    import_to: &str,
    config: Option<&crate::entity::config::Config>,
) -> photo::Photos {
    let files = crate::domain_service::dir_service::find_files(dir);
    let mut photos = photo::Photos::new();
    for f in files.files {
        let relative_path = file::to_relative_path(&f.path, import_to);
        let p = photo::Photo::new(file::File::from_relative(relative_path), config.cloned());
        photos.photos.push(p);
    }
    photos
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test --bin photoclove test_photos_from_dir_recursive_includes_uuid_subdir`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/domain_service/photo_service.rs
git commit -m "feat(photo-service): add photos_from_dir_recursive scan bundle"
```

---

### Task 3: Migrate `generate_video_thumbnails` to the `Photos` bundle

**Files:**
- Modify: `src-tauri/src/domain_service/photo_service.rs`
  - Replace the whole `fn generate_video_thumbnails(from: &Path, to: &Path) { ... }` (starts ~line 211).
  - In `create_thumbnails`: build a `Config` before the date loop and change the call site (currently `generate_video_thumbnails(&from, &to);` ~line 355).

**Interfaces:**
- Consumes: `photos_from_dir_recursive` (Task 2); `Photo::is_video`, `Photo::get_thumbnail_path`, `Photo::absolute_path`; `crate::entity::config::Config::new`.
- Produces: `generate_video_thumbnails(date_dir: &std::path::Path, config: &crate::entity::config::Config)` (private; internal refactor — no new public API).

- [ ] **Step 1: Replace `generate_video_thumbnails` with the bundle-based version**

Replace the entire existing `fn generate_video_thumbnails(from: &Path, to: &Path) { ... }` with:

```rust
/// Generate thumbnails for videos under `date_dir`, recursing into UUID
/// subdirectories. Reuses `Photo::get_thumbnail_path` for the output location
/// (which already mirrors the `{date}/{uuid}/{file}.jpg` layout) and
/// `Photo::absolute_path` for the source. Existing thumbnails are skipped so
/// re-runs do not re-invoke ffmpeg on large video files.
fn generate_video_thumbnails(date_dir: &Path, config: &crate::entity::config::Config) {
    let dir = file::Dir::new(date_dir.display().to_string());
    let photos = photos_from_dir_recursive(&dir, &config.import_to, Some(config));

    for photo in photos.photos {
        if !photo.is_video() {
            continue;
        }
        let Some(thumbnail_path) = photo.get_thumbnail_path() else {
            continue;
        };
        if Path::new(&thumbnail_path).exists() {
            log::debug!(target: "photo_service", "video_thumbnail; status=skip_exists; path={}", thumbnail_path);
            continue;
        }
        if let Some(parent) = Path::new(&thumbnail_path).parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                log::error!(target: "photo_service", "video_thumbnail_mkdir_failed; dir={}; error={}", parent.display(), e);
                continue;
            }
        }
        let source = photo.absolute_path();
        log::info!(target: "photo_service", "video_thumbnail; source={}; target={}", source, thumbnail_path);
        // `-ss` before `-i` uses fast input seeking, essential for multi-GB videos.
        let output = Command::new("ffmpeg")
            .arg("-ss")
            .arg("00:00:01.000")
            .arg("-i")
            .arg(&source)
            .arg("-vframes")
            .arg("1")
            .arg(&thumbnail_path)
            .output();
        match output {
            Ok(o) if o.status.success() => {
                log::info!(target: "photo_service", "video_thumbnail; status=success; path={}", thumbnail_path);
            }
            Ok(o) => {
                log::error!(target: "photo_service", "video_thumbnail_error; source={}; target={}; stderr={}", source, thumbnail_path, String::from_utf8_lossy(&o.stderr));
            }
            Err(e) => {
                log::error!(target: "photo_service", "ffmpeg_error; error={:?}", e);
            }
        }
    }
}
```

- [ ] **Step 2: Build the Config and update the call site in `create_thumbnails`**

In `create_thumbnails`, immediately before the `for date in dates.dates {` loop, add:

```rust
    // Config whose import_to/thumbnail_store match the caller's origin/dest, so
    // Photo path helpers resolve to exactly these locations.
    let mut photo_config = crate::entity::config::Config::new();
    photo_config.import_to = origin.display().to_string();
    photo_config.thumbnail_store = dest.display().to_string();
```

Then change the call site from:

```rust
                generate_video_thumbnails(&from, &to);
```

to:

```rust
                generate_video_thumbnails(&from, &photo_config);
```

- [ ] **Step 3: Verify it compiles with no warnings**

Run: `cd src-tauri && cargo check --bin photoclove`
Expected: `Finished` with no warnings (in particular, no "unused variable `to`" — `to` is still used by the jpg-cleanup loop and `cleanup_raw_copies(&to)`).

- [ ] **Step 4: Run the full test suite**

Run: `cd src-tauri && cargo test --bin photoclove`
Expected: PASS — all tests (including Task 1/2 tests) green, 0 failed.

- [ ] **Step 5: Clippy check**

Run: `cd src-tauri && cargo clippy --bin photoclove 2>&1 | tail -5`
Expected: no new clippy errors from the changed file.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/domain_service/photo_service.rs
git commit -m "refactor(thumbnail): generate video thumbnails from a Photos bundle"
```

---

## Self-Review

- **Spec coverage:**
  - Spec §1 (Photo type methods) → Task 1. ✓
  - Spec §2 (`photos_from_dir_recursive`) → Task 2. ✓
  - Spec §3 (migrate `generate_video_thumbnails`, config approach A) → Task 3. ✓ (config built via `Config::new()` with import_to/thumbnail_store overridden to origin/dest for exact consistency).
  - Spec §4 (tests) → Task 1 (predicates) + Task 2 (recursive scan). ✓
  - Non-goals (image/RAW/HEIC generation, display path, no new aggregate) → untouched; only the video branch changes. ✓
- **Placeholder scan:** No TBD/TODO; every code step shows full code. ✓
- **Type consistency:** `photos_from_dir_recursive(&file::Dir, &str, Option<&Config>) -> photo::Photos` is defined in Task 2 and consumed identically in Task 3. `generate_video_thumbnails(&Path, &Config)` signature matches its call site. `Photo` methods used in Task 3 (`is_video`, `get_thumbnail_path`, `absolute_path`) are defined in Task 1 or already exist. ✓
- **Note:** ffmpeg execution itself is not unit-tested (external binary + large files); Task 3's deliverable is guarded by compile + clippy + the lower-level unit tests, consistent with the existing untested `create_thumbnails` I/O path.
