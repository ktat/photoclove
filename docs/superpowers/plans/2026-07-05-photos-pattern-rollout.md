# Photos/Photo pattern rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-rolled filesystem walks + raw string extension checks in four multi-photo processing sites with the `Photos`/`Photo` pattern (and the `find_files` primitive where the base dir is not `import_to`).

**Architecture:** Reuse `photo_service::photos_from_dir_recursive` (import_to-relative Photos, recurses UUID) and `dir_service::find_files` (absolute paths, recurses UUID), plus the pure `Photo` predicates (`is_image`/`is_raw`/`is_heic_or_avif`/`extension`) and path helpers (`absolute_path`/`get_thumbnail_path`). Generation/deletion logic is preserved; only enumeration, predicate, and path derivation change.

**Tech Stack:** Rust (Tauri backend), `cargo test`, `tempfile` (already a dependency).

## Global Constraints

- Files under 600 lines.
- Structured logging only: `log::…(target: "…", "event; key={}", val)`. No `println!`.
- I/O stays in the service layer; the `Photo` entity stays pure.
- Verify from `src-tauri/`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test --bin photoclove`.

---

### Task 1: `filter_image_paths` uses `Photo::is_image()`

**Files:**
- Modify: `src-tauri/src/commands/job_helpers.rs` (remove `is_image_file`, update `filter_image_paths`, add a test module)

**Interfaces:**
- Consumes: `Photo::is_image()` (already exists on `entity::photo::Photo`).
- Produces: `filter_image_paths(&[Photo]) -> Vec<String>` (unchanged signature).

- [ ] **Step 1: Write the failing test**

Append to `src-tauri/src/commands/job_helpers.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::filter_image_paths;
    use crate::entity::photo::Photo;
    use crate::value::file;

    fn photo(rel: &str) -> Photo {
        Photo::new(file::File::from_relative(rel.to_string()), None)
    }

    #[test]
    fn test_filter_image_paths_keeps_only_images() {
        let photos = vec![
            photo("2026-06-29/a/pic.jpg"),
            photo("2026-06-29/a/raw.CR2"),
            photo("2026-06-29/a/clip.mp4"),
            photo("2026-06-29/a/notes.txt"),
        ];
        let result = filter_image_paths(&photos);
        assert_eq!(
            result,
            vec![
                "2026-06-29/a/pic.jpg".to_string(),
                "2026-06-29/a/raw.CR2".to_string(),
            ]
        );
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --bin photoclove test_filter_image_paths_keeps_only_images`
Expected: FAIL (currently the mp4/txt behavior is the same, but the test also guards the refactor; if it already passes, that's fine — proceed to make the internal change and keep it green). If it fails to compile because the test module can't see items, fix the `use` paths.

Note: this test may PASS before the change because `is_image_file` and `is_image()` are equivalent. That is acceptable — it locks the behavior across the refactor. Proceed to Step 3 regardless.

- [ ] **Step 3: Make the change**

In `src-tauri/src/commands/job_helpers.rs`, delete the `is_image_file` function:

```rust
/// Check if a file path is an image file (standard + RAW formats)
pub fn is_image_file(path: &str) -> bool {
    crate::utils::raw_file::is_supported_image(path)
}
```

and change `filter_image_paths` to use the predicate:

```rust
/// Filter photos to only include image files
pub fn filter_image_paths(photos: &[Photo]) -> Vec<String> {
    photos
        .iter()
        .filter(|p| p.is_image())
        .map(|p| p.file.path.clone())
        .collect()
}
```

- [ ] **Step 4: Verify build (no unused-function warning) and test**

Run: `cd src-tauri && cargo clippy --bin photoclove 2>&1 | grep -i "is_image_file" ; cargo test --bin photoclove test_filter_image_paths_keeps_only_images`
Expected: no reference to `is_image_file` remains (grep prints nothing), test PASSES. If clippy reports `is_image_file` as unused, you missed deleting it or another caller exists — search `rg "is_image_file" src` and resolve.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/job_helpers.rs
git commit -m "refactor(job-helpers): filter with Photo::is_image() instead of raw string check"
```

---

### Task 2: `cleanup_raw_copies` uses `find_files` + `Photo::is_raw()`

**Files:**
- Modify: `src-tauri/src/domain_service/photo_service.rs` (the nested `cleanup_raw_copies` fn inside `create_thumbnails`, ~lines 407-422)

**Interfaces:**
- Consumes: `crate::domain_service::dir_service::find_files(&file::Dir) -> file::Files`; `photo::Photo::new(file::File, Option<Config>)`; `Photo::is_raw()`.
- Produces: nothing new (internal cleanup).

- [ ] **Step 1: Replace the recursive nested fn and its call**

In `src-tauri/src/domain_service/photo_service.rs`, replace this block:

```rust
                // Clean up RAW files copied by FolderCompressor (it copies them as-is)
                // Walk through destination directory and subdirectories
                fn cleanup_raw_copies(dir: &PathBuf) {
                    if let Ok(entries) = std::fs::read_dir(dir) {
                        for entry in entries.filter_map(|e| e.ok()) {
                            let path = entry.path();
                            if path.is_dir() {
                                cleanup_raw_copies(&path);
                            } else if raw_file::is_raw_file(&path.to_string_lossy()) {
                                log::info!(target: "photo_service", "thumbnail_cleanup_raw; path={}", path.display());
                                let _ = std::fs::remove_file(&path);
                            }
                        }
                    }
                }
                cleanup_raw_copies(&to);
```

with:

```rust
                // Clean up RAW files copied by FolderCompressor (it copies them as-is).
                // `to` is the thumbnail destination (not import_to), so enumerate with
                // find_files (absolute paths, recurses UUID subdirs) and use the pure
                // Photo::is_raw() predicate.
                let raw_copies = crate::domain_service::dir_service::find_files(
                    &file::Dir::new(to.display().to_string()),
                );
                for f in raw_copies.files {
                    if photo::Photo::new(f.clone(), None).is_raw() {
                        log::info!(target: "photo_service", "thumbnail_cleanup_raw; path={}", f.path);
                        let _ = std::fs::remove_file(&f.path);
                    }
                }
```

Note: `find_files` returns `file::File` with an absolute `path` (it scans `to`). `Photo::is_raw()` only inspects the path string, so `None` config is fine.

- [ ] **Step 2: Verify build + tests**

Run: `cd src-tauri && cargo check --bin photoclove && cargo test --bin photoclove`
Expected: compiles with no warnings; all tests PASS (48+).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/domain_service/photo_service.rs
git commit -m "refactor(thumbnail): clean up copied RAW files via find_files + Photo::is_raw()"
```

---

### Task 3: `process_raw_thumbnails` uses `photos_from_dir_recursive`

**Files:**
- Modify: `src-tauri/src/domain_service/photo_service.rs` (`process_raw_thumbnails` fn ~61-229, and its caller in `create_thumbnails` ~347)

**Interfaces:**
- Consumes: `photos_from_dir_recursive(&file::Dir, &str, Option<&config::Config>) -> photo::Photos`; `Photo::is_raw()`, `Photo::is_heic_or_avif()`, `Photo::absolute_path() -> String`, `Photo::get_thumbnail_path() -> Option<String>`.
- Produces: `process_raw_thumbnails(from: &PathBuf, to: &PathBuf, raw_config: &RawProcessingConfig, config: &crate::entity::config::Config) -> Result<usize, Box<dyn Error>>` (adds a `config` param).

- [ ] **Step 1: Change the signature and body enumeration**

In `src-tauri/src/domain_service/photo_service.rs`, change the signature:

```rust
pub fn process_raw_thumbnails(
    from: &PathBuf,
    to: &PathBuf,
    raw_config: &RawProcessingConfig,
    config: &crate::entity::config::Config,
) -> Result<usize, Box<dyn Error>> {
```

Replace the enumeration scaffolding — from the `let mut dirs_to_process...` block through the start of the per-file loop — i.e. replace this:

```rust
    // Ensure destination directory exists
    if !to.exists() {
        std::fs::create_dir_all(to)?;
    }

    // Collect directories to process: the root directory plus any subdirectories (UUID dirs)
    let mut dirs_to_process: Vec<(PathBuf, PathBuf)> = Vec::new();
    dirs_to_process.push((from.clone(), to.clone()));

    let entries = std::fs::read_dir(from)?;
    for entry in entries {
        let entry = entry?;
        if entry.path().is_dir() {
            let sub_dir_name = entry.file_name();
            let sub_from = from.join(&sub_dir_name);
            let sub_to = to.join(&sub_dir_name);
            dirs_to_process.push((sub_from, sub_to));
        }
    }

    for (dir_from, dir_to) in &dirs_to_process {
        if !dir_from.exists() {
            continue;
        }
        if !dir_to.exists() {
            std::fs::create_dir_all(dir_to)?;
        }

        let dir_entries = std::fs::read_dir(dir_from)?;
        for entry in dir_entries {
            let entry = entry?;
            let file_name = entry.file_name();
            let file_name_str = file_name.to_string_lossy();
            let file_path = entry.path();

            let is_raw = file_path.is_file() && raw_file::is_raw_file(&file_name_str);
            let is_heic_avif = file_path.is_file() && raw_file::is_heic_or_avif(&file_name_str);

            if !is_raw && !is_heic_avif {
                continue;
            }

            // Thumbnail naming: photo.CR2 -> photo.cr2.jpg (lowercase + .jpg)
            let thumbnail_name = format!("{}.jpg", file_name_str.to_lowercase());
            let thumbnail_path = dir_to.join(&thumbnail_name);

            if thumbnail_path.exists() {
                log::debug!(
                    target: "photo_service",
                    "non_native_thumbnail_exists; file={}; thumbnail={}",
                    file_name_str, thumbnail_path.display()
                );
                continue;
            }
```

with this (note: `to` is retained only for the caller's directory-existence semantics; the per-file destination now comes from `Photo::get_thumbnail_path()`):

```rust
    let _ = to; // destination paths now come from Photo::get_thumbnail_path()

    // Enumerate the source date dir (recursing UUID subdirs) as a Photos bundle.
    let photos = photos_from_dir_recursive(
        &file::Dir::new(from.display().to_string()),
        &config.import_to,
        Some(config),
    );

    for photo in photos.photos {
        if !(photo.is_raw() || photo.is_heic_or_avif()) {
            continue;
        }
        let is_heic_avif = photo.is_heic_or_avif();
        let file_name_str = photo.file.name.clone();
        let file_path = std::path::PathBuf::from(photo.absolute_path());

        let Some(thumbnail_path) = photo.get_thumbnail_path().map(std::path::PathBuf::from) else {
            continue;
        };

        if thumbnail_path.exists() {
            log::debug!(
                target: "photo_service",
                "non_native_thumbnail_exists; file={}; thumbnail={}",
                file_name_str, thumbnail_path.display()
            );
            continue;
        }

        // Ensure the thumbnail's parent (date/uuid) directory exists.
        if let Some(parent) = thumbnail_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
```

Then, the existing extraction body (the `if let Some((img, ...)) = exif_thumbnail::extract_exif_thumbnail(&file_path) { ... } else if is_heic_avif { ... } else if raw_config.enable_full_decode { ... } else { ... }`) stays exactly as-is. Only its surrounding loop changed. Finally, replace the loop's closing:

```rust
        }
    } // end dirs_to_process loop

    Ok(count)
}
```

with (one loop now, not two):

```rust
    }

    Ok(count)
}
```

Keep the early guard `if !from.exists() { return Ok(0); }` and `let mut count = 0;` at the top unchanged.

- [ ] **Step 2: Update the caller in `create_thumbnails`**

In `src-tauri/src/domain_service/photo_service.rs`, the call currently reads:

```rust
        match process_raw_thumbnails(&from, &to, raw_cfg) {
```

`create_thumbnails` builds `photo_config` (with `import_to = origin`, `thumbnail_store = dest`) before the date loop. Pass it:

```rust
        match process_raw_thumbnails(&from, &to, raw_cfg, &photo_config) {
```

If `photo_config` is currently constructed AFTER this call site, move its three construction lines (`let mut photo_config = crate::entity::config::Config::new(); photo_config.import_to = origin.display().to_string(); photo_config.thumbnail_store = dest.display().to_string();`) to just before the `process_raw_thumbnails` call, still inside the `for date in dates.dates` loop, so it is in scope here.

- [ ] **Step 3: Verify build + tests**

Run: `cd src-tauri && cargo check --bin photoclove 2>&1 | tail -5 && cargo test --bin photoclove`
Expected: compiles with no warnings (no unused `to`, no unused `raw_file` — `raw_file` is still used elsewhere in the file); all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/domain_service/photo_service.rs
git commit -m "refactor(thumbnail): enumerate RAW/HEIC thumbnails via photos_from_dir_recursive"
```

---

### Task 4: JPEG-cleanup loop uses `photos_from_dir_recursive` (bug fix: recurse UUID)

**Files:**
- Modify: `src-tauri/src/domain_service/photo_service.rs` (the JPEG-cleanup loop in `create_thumbnails`, ~369-401)

**Interfaces:**
- Consumes: `photos_from_dir_recursive`; `Photo::extension() -> String`; `Photo::absolute_path()`, `Photo::get_thumbnail_path()`.
- Produces: nothing new (internal cleanup; now also covers UUID-nested JPEGs).

- [ ] **Step 1: Replace the single-level read_dir loop**

In `src-tauri/src/domain_service/photo_service.rs`, replace this block:

```rust
                let entries = std::fs::read_dir(&from)?;
                for entry in entries {
                    let entry = entry?;
                    let file_name = entry.file_name();
                    let extension = entry
                        .path()
                        .extension()
                        .map(|ext| ext.to_string_lossy().to_lowercase());
                    if let Some(ext) = extension {
                        if ext == "jpg" || ext == "jpeg" {
                            let file_size = entry.metadata()?.len();
                            let file_name_str = file_name.to_string_lossy();
                            let ext_with_dot = format!(".{}", ext);
                            let new_file_name = re.replace(&file_name_str, &ext_with_dot);
                            let new_file_path = to.join(new_file_name.as_ref());
                            if new_file_path.exists() {
                                if file_size < ignore_file_size {
                                    log::info!(target: "photo_service", "thumbnail_cleanup; reason=mini_size; source={:?}; target={:?}; file_size={}; threshold={}", entry.path().to_string_lossy(), new_file_path.clone(), file_size, ignore_file_size);
                                    std::fs::remove_file(new_file_path)?;
                                } else if new_file_path.exists() {
                                    let thumbnail_file_size =
                                        std::path::Path::new(&new_file_path).metadata()?.len();
                                    if thumbnail_file_size == file_size {
                                        log::info!(target: "photo_service", "thumbnail_cleanup; reason=same_size; target={:?}", new_file_path.clone());
                                        std::fs::remove_file(new_file_path)?;
                                    }
                                }
                            } else {
                                log::debug!(target: "photo_service", "thumbnail_status; file={:?}; status=not_exists", new_file_path);
                            }
                        }
                    }
                }
```

with (recurses UUID subdirs via the bundle; thumbnail path from `Photo::get_thumbnail_path()`, which normalizes `.jpe?g` → `.jpg` — matching FolderCompressor output):

```rust
                // Cleanup pass over the source date dir (recursing UUID subdirs, which
                // the old single-level read_dir missed) removing thumbnails that are
                // unwanted: source below the size threshold, or thumbnail not actually
                // smaller than the source (== same size).
                let source_photos = photos_from_dir_recursive(
                    &file::Dir::new(from.display().to_string()),
                    &photo_config.import_to,
                    Some(&photo_config),
                );
                for photo in source_photos.photos {
                    let ext = photo.extension();
                    if ext != "jpg" && ext != "jpeg" {
                        continue;
                    }
                    let source_path = std::path::PathBuf::from(photo.absolute_path());
                    let Some(thumbnail_path) = photo.get_thumbnail_path().map(std::path::PathBuf::from)
                    else {
                        continue;
                    };
                    if !thumbnail_path.exists() {
                        log::debug!(target: "photo_service", "thumbnail_status; file={:?}; status=not_exists", thumbnail_path);
                        continue;
                    }
                    let file_size = source_path.metadata()?.len();
                    if file_size < ignore_file_size {
                        log::info!(target: "photo_service", "thumbnail_cleanup; reason=mini_size; source={:?}; target={:?}; file_size={}; threshold={}", source_path.to_string_lossy(), thumbnail_path.clone(), file_size, ignore_file_size);
                        std::fs::remove_file(&thumbnail_path)?;
                    } else {
                        let thumbnail_file_size = thumbnail_path.metadata()?.len();
                        if thumbnail_file_size == file_size {
                            log::info!(target: "photo_service", "thumbnail_cleanup; reason=same_size; target={:?}", thumbnail_path.clone());
                            std::fs::remove_file(&thumbnail_path)?;
                        }
                    }
                }
```

- [ ] **Step 2: Remove the now-unused `re` regex if it is no longer referenced**

The `re` binding (defined near the top of `create_thumbnails` as `let re = Regex::new(r"\.(?i:jpe?g)$")...`) was only used by the old loop. Run `rg "\bre\b" src-tauri/src/domain_service/photo_service.rs` scoped to `create_thumbnails`. If `re` has no other use, delete its `let re = ...;` line to avoid an unused-variable warning. If it is used elsewhere, leave it.

- [ ] **Step 3: Verify build + tests**

Run: `cd src-tauri && cargo fmt && cargo clippy --all-targets -- -D warnings 2>&1 | tail -5 && cargo test --bin photoclove`
Expected: fmt clean, clippy no warnings/errors, all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/domain_service/photo_service.rs
git commit -m "fix(thumbnail): recurse UUID subdirs in JPEG cleanup via photos_from_dir_recursive"
```

---

## Self-Review

- **Spec coverage:**
  - Spec §1 filter_image_paths → Task 1 ✓
  - Spec §2 process_raw_thumbnails (config param, bundle, predicate, paths) → Task 3 ✓
  - Spec §3 JPEG-cleanup bug fix (recurse UUID) → Task 4 ✓
  - Spec §4 cleanup_raw_copies (find_files + is_raw) → Task 2 ✓
  - Out-of-scope items untouched ✓
  - Testing: Task 1 adds the unit test; Tasks 2-4 rely on build+clippy+existing tests per the spec's "I/O-heavy, don't unit-test decoding" guidance ✓
- **Placeholder scan:** No TBD/TODO; every code step shows full code. The Task 1 note about the test possibly passing pre-change is intentional guidance, not a placeholder.
- **Type consistency:** `process_raw_thumbnails(..., config: &crate::entity::config::Config)` defined in Task 3 and called with `&photo_config` in the same task. `photos_from_dir_recursive(&file::Dir, &str, Option<&Config>)`, `get_thumbnail_path() -> Option<String>`, `absolute_path() -> String`, `is_raw/is_heic_or_avif/is_image/extension` all match their real signatures. `find_files(&file::Dir) -> file::Files` used in Task 2 matches.
- **Ordering note:** Tasks 2, 3, 4 all edit `photo_service.rs` (different regions). Execute sequentially; re-base each task's diff on the prior commit. Task 3 moves the `photo_config` construction earlier if needed — Task 4 depends on `photo_config` being in scope at the JPEG-cleanup loop (it already is, after the `create_thumbnails` video-thumbnail change; Task 3's move keeps it in scope).
