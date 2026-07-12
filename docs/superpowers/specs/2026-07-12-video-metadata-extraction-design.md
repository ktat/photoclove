# Extract video metadata at import time (ffprobe)

Date: 2026-07-12

## Background

Photos get rich metadata via EXIF (`value/exif.rs`, parsed with `rexif`
through `utils/exif_parser.rs`). Videos get none: `ExifData::new()` is called
unconditionally for every imported file in
`repository/meta_db/sqlite/photo_metadata.rs::record_photos_meta_data`, and
for a video container `rexif` always fails to parse, so the code falls back
to `file.created_datetime()` — the filesystem ctime.

This has two consequences:

1. **Wrong dates.** A video's date-sort/date-grouping key is the file's
   ctime, not its actual recording time. Copying, restoring from backup, or
   any operation that changes ctime silently reshuffles the video into the
   wrong date bucket.
2. **No metadata display.** `PhotoInfo.jsx` unconditionally renders an EXIF
   table; for videos every field is blank except the (wrong) date.

The app already shells out to `ffmpeg` for video thumbnail generation
(`domain_service/photo_service.rs`, `generate_video_thumbnails`), with no
availability check — a failed spawn is logged and the loop continues. CI does
not install ffmpeg/ffprobe, and no existing test depends on the real binary.
`ffprobe` ships in the same suite as `ffmpeg`, so this adds no new runtime
dependency.

Videos are immutable once imported (the app has no video editing), unlike
EXIF orientation which can change via in-app photo edits and is re-synced
on view (`update_exif_if_changed`). Video metadata therefore only needs to be
captured once, at import time.

## Goal

Capture `creation_time`, camera/drone `model`, `width`/`height`, `duration`,
`codec`, and (best-effort) GPS coordinates for imported videos via `ffprobe`,
store them in `photo_metadata`, and surface them in the `PhotoInfo` panel —
while leaving already-imported videos untouched (a one-off backfill script,
if wanted, is out of scope for this change).

## Non-goals

- Backfilling metadata for videos already in the library. The user will
  handle this with a standalone script later.
- Re-syncing video metadata on view (no in-app video editing exists that
  could invalidate it).
- GPS for photos (EXIF GPS tags). Out of scope; the new `gps_latitude`/
  `gps_longitude` columns are written by the video path only for now, but are
  generic enough that a future photo-EXIF-GPS feature could reuse them.
- Map-link rendering for GPS in the UI (plain text only).
- Any change to which videos are considered "supported" (`utils/raw_file.rs`
  extension lists are unaffected).

## Architecture

```
Photo::is_video()
       │
       ├─ false → ExifData::new()              (existing, rexif)
       │
       └─ true  → VideoMetadata::new()          (new, ffprobe)
                        │
                        ▼
              utils/ffprobe.rs (new)
              Command::new("ffprobe") -v quiet -print_format json
                  -show_format -show_streams <path>
              → serde_json → VideoMetadata
```

New files, mirroring the existing EXIF pair:

- `value/video_metadata.rs` — `VideoMetadata` struct + parsing from the
  ffprobe JSON shape (analogous to `value/exif.rs`).
- `utils/ffprobe.rs` — spawns `ffprobe`, wall-clock timeout, JSON parsing
  (analogous to `utils/exif_parser.rs`). ffprobe only reads headers (no frame
  decode), so the timeout can be short — a few seconds, well under the
  minutes-scale budget `photo_service.rs` uses for `ffmpeg` thumbnail
  extraction.

Injection point: `repository/meta_db/sqlite/photo_metadata.rs`, in
`record_photos_meta_data`, replacing the existing
`ExifData::new(abs_file)` call inside the `if let Some(abs_file) = ...`
block:

```rust
if photo.is_video() {
    if let Some(vm) = video_metadata::VideoMetadata::new(&abs_file.path) {
        photo.embed_video_metadata(vm);
    }
    // else: photo keeps ExifData::empty() defaults; date falls back to
    // file.created_datetime() exactly as it does today.
} else {
    let meta = exif::ExifData::new(abs_file);
    photo.embed_exif(meta);
}
```

(`abs_file.path` is read before `abs_file` would otherwise be moved into
`ExifData::new`; the video branch takes a path, not the `File` struct, since
`ffprobe` is a subprocess call, not an EXIF-tag reader.)

`record_photos_meta_data` is reached from photo import
(`job_queue/handlers/import.rs`) and full DB rebuild
(`create_db.rs`/`recovery` paths); both are appropriate places to capture
video metadata. The style-edit path (`style_commands.rs`) re-records a single
photo after an in-app edit, which never applies to videos, so no video-only
handling is needed there.

## Schema (hybrid — reuse overlapping EXIF columns, add video-only columns)

New migration `015_add_video_metadata.sql`:

```sql
ALTER TABLE photo_metadata ADD COLUMN video_duration_secs REAL;
ALTER TABLE photo_metadata ADD COLUMN video_codec TEXT;
ALTER TABLE photo_metadata ADD COLUMN gps_latitude REAL;
ALTER TABLE photo_metadata ADD COLUMN gps_longitude REAL;
```

Field mapping:

| `VideoMetadata` field | Storage | Rationale |
|---|---|---|
| `creation_time` | existing `exif_date_time_original` | Reuses the date-sort/grouping key path unchanged; no new column needed |
| `model` | existing `exif_model` | `PhotoInfo`'s existing "Model" row works unmodified for video |
| `width` / `height` | existing `exif_xresolution` / `exif_yresolution` | Same type (TEXT); stringified on write |
| `duration_secs` | new `video_duration_secs` | No existing analog |
| `codec` | new `video_codec` | No existing analog |
| `gps_latitude` / `gps_longitude` | new `gps_latitude` / `gps_longitude` | No existing analog anywhere in the schema (photos don't have GPS today either) |

`VideoMetadata` (`value/video_metadata.rs`):

```rust
pub struct VideoMetadata {
    pub creation_time: String,       // "YYYY-MM-DD HH:MM:SS", local time
    pub model: String,
    pub width: String,
    pub height: String,
    pub duration_secs: Option<f64>,
    pub codec: String,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
}
```

`Photo::embed_video_metadata(&mut self, meta: VideoMetadata)` (new, mirrors
`embed_exif`) fans `creation_time`/`model`/`width`/`height` into the existing
`ExifData` fields and stores `duration_secs`/`codec`/`gps_latitude`/
`gps_longitude` on four new `Photo` fields, which the existing INSERT/UPDATE
path in `photo_metadata.rs` writes to the four new columns.

`entity/photo_meta.rs::PhotoMeta` (and the query behind
`PhotoMeta::new_with_data`) gains the same four fields so `get_photo_info` can
read them back out for display.

## Extraction logic details

**Timezone.** `ffprobe`'s `format.tags.creation_time` is UTC ISO-8601 (e.g.
`2026-06-29T09:48:43.000000Z`) on the containers this app encounters (MP4/MOV
from phones and drones), while EXIF `DateTimeOriginal` is local camera time.
Mixing the two would put same-moment photos and videos in different date
buckets. `VideoMetadata::new` parses the UTC timestamp and converts to
`chrono::Local` (the timezone already used elsewhere, e.g. `value/file.rs`)
before formatting as `"%Y-%m-%d %H:%M:%S"`.

**GPS.** Embedding format is muxer-dependent (e.g. QuickTime-style containers
often use a `com.apple.quicktime.location.ISO6709` tag like
`+35.1234-139.1234+012.345/`); many DJI MP4s don't expose GPS through
`ffprobe -show_format` tags at all. GPS extraction is best-effort: if an
ISO 6709 string is present, parse it with a regex
(`^([+-]\d+\.?\d*)([+-]\d+\.?\d*)`); otherwise leave both fields `None`. A
missing GPS tag is not logged as an error.

**Failure handling.** Spawn failure, timeout, and JSON-parse failure are all
treated as "extraction failed": `VideoMetadata::new` returns `None`, the
`Photo` keeps `ExifData::empty()` defaults, and the date falls back to
`file.created_datetime()` — byte-for-byte the same behavior the app has
today. This mirrors the existing `ffmpeg` thumbnail-generation failure
handling (log, continue) rather than introducing a new failure mode.

**Video stream selection.** `ffprobe`'s `streams` array can contain audio and
video entries; `codec`/`width`/`height` come from the first entry with
`codec_type == "video"`. `duration` prefers `format.duration` (covers the
whole container) and falls back to the video stream's own `duration` field
if the format-level one is absent.

## Frontend (`PhotoInfo.jsx`)

Branch on `props.currentPhoto?.isVideo()`:

- **Video**: hide the photo-only EXIF rows that are always blank for video
  (ISO, F-number, shutter speed, lens model/make, exposure mode, white
  balance) and add: Duration (formatted `mm:ss` from `video.duration_secs`),
  Codec (`video.codec`), GPS (`"{lat}, {lon}"` plain text if both present,
  otherwise omitted — no map link in this iteration). Recording date and
  Model reuse the existing EXIF rows unchanged, since they're populated
  through the same `exif_date_time_original`/`exif_model` columns.
- **Photo**: unchanged.

Backend: `PhotoInfoResponse` (`commands/photo_commands.rs`) gains an optional
`video: Option<serde_json::Value>` field, populated from the new `PhotoMeta`
fields when `photo.is_video()`, alongside the existing `exif` field.

## Testing

- **Rust unit tests** for `utils/ffprobe.rs` JSON parsing, using canned JSON
  strings (no real `ffprobe` invocation): normal case, multiple streams
  (audio+video), missing `creation_time`, missing/malformed GPS tag, and the
  UTC→local conversion at a DST boundary.
- **Unit tests** for the ISO 6709 GPS parser: well-formed string, missing
  trailing slash, missing altitude component, malformed input.
- **No integration test spawns the real `ffprobe` binary** — CI has neither
  `ffmpeg` nor `ffprobe` installed, and no existing test in the codebase
  depends on the real `ffmpeg` binary either (thumbnail generation is
  untested end-to-end for the same reason). Verified manually against real
  drone footage instead.
- **Frontend**: a small test (or manual check if awkward to isolate) that
  `PhotoInfo.jsx` hides the photo-only rows and shows the video rows when
  `isVideo()` is true.

## Out-of-scope follow-ups (not part of this change)

- A standalone backfill script to re-run `ffprobe` extraction over the
  existing library (mentioned by the user as a separate, later task).
- GPS map-link rendering.
- Extending EXIF GPS extraction for photos to populate the same
  `gps_latitude`/`gps_longitude` columns.
