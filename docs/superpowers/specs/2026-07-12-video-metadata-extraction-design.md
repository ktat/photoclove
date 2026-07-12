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

`get_photo_info` (the single-photo info panel) already has a live-read +
self-heal pattern for photos: it re-parses EXIF from the file on every view
(`ExifData::new(f)`, in `photo_commands.rs::photo_info_blocking`), diffs all
20 `exif_*` columns against the DB row, and updates only what drifted
(`update_exif_if_changed`, `repository/meta_db/sqlite/exif.rs`) — the
displayed value always comes from the file, the DB is an opportunistically-
healed cache used by bulk operations (sort/search/stats), never by this
single-item display itself. This change reuses that exact mechanism for
video rather than introducing a separate one.

## Goal

Capture `creation_time`, camera/drone `model`, `width`/`height`, `duration`,
`codec`, and (best-effort) GPS coordinates for imported videos via `ffprobe`,
store them in `photo_metadata`, and surface them in the `PhotoInfo` panel —
while leaving already-imported videos untouched (a one-off backfill script,
if wanted, is out of scope for this change).

## Non-goals

- Backfilling metadata for videos already in the library. The user will
  handle this with a standalone script later.
- Persisting duration/codec/GPS to the database. Verified (grep) that no
  search/filter/stats feature reads them; `get_photo_info` can supply them
  live from the same `ffprobe` call used for display, so there is nothing to
  cache and no schema change is needed for them (see Schema below).
- GPS for photos (EXIF GPS tags) — out of scope entirely, no shared column to
  design for since video GPS isn't stored either.
- Map-link rendering for GPS in the UI (plain text only).
- Any change to which videos are considered "supported" (`utils/raw_file.rs`
  extension lists are unaffected).
- Changing `get_photo_info`'s live-read-and-heal architecture for photos.
  It's an existing, deliberate mechanism (not a bug); this change extends it
  to video, it doesn't redesign it.

## Architecture

Two call sites need video handling, and they need different things from
`ffprobe`:

```
1. Import  (repository/meta_db/sqlite/photo_metadata.rs::record_photos_meta_data)
   Bulk write path. Populates the columns bulk sort/search/stats already read.

   Photo::is_video()
          │
          ├─ false → ExifData::new(file)                (existing, rexif)
          │
          └─ true  → ffprobe::probe(path)                (new)
                            │
                            ▼
                     VideoMetadata::to_exif_data()        (new)
                            │
                            ▼
                     photo.embed_exif(..)                 (existing, unchanged)

2. Info panel  (commands/photo_commands.rs::photo_info_blocking)
   Single-item live display path. Mirrors the existing photo branch instead
   of reading the DB.

   Photo::is_video()
          │
          ├─ false → ExifData::new(file) + update_exif_if_changed   (existing)
          │
          └─ true  → ffprobe::probe(path)                            (new)
                            │
                            ├─→ VideoMetadata::to_exif_data() → update_exif_if_changed   (existing fn, reused)
                            └─→ duration/codec/GPS → PhotoInfoResponse.video (new field, not persisted)
```

New files:

- `value/video_metadata.rs` — `VideoMetadata` struct, parsed from the
  `ffprobe` JSON shape, plus `to_exif_data(&self) -> exif::ExifData`, which
  fills only `date_time_original`/`model`/`make`/`xresolution`/`yresolution`
  (leaving every photo-only field — ISO, f-number, lens, etc. — empty, same
  as `ExifData::empty()`).
- `utils/ffprobe.rs` — spawns `ffprobe`, wall-clock timeout, JSON parsing
  into `VideoMetadata` (analogous to `utils/exif_parser.rs`). ffprobe only
  reads headers (no frame decode), so the timeout can be short — a few
  seconds, well under the minutes-scale budget `photo_service.rs` uses for
  `ffmpeg` thumbnail extraction.

**Why two call sites instead of one.** The bug this change fixes — wrong
date-sort/grouping — is caused by `exif_date_time_original` never being
populated for video at import; that write only happens once, in
`record_photos_meta_data`, and bulk operations (`get_photo_meta_data_in_date`
and friends) read only the DB, so this path is mandatory. The info panel
(`get_photo_info`) is a single, user-triggered, on-demand action (not a bulk
loop), so mirroring the photo architecture exactly — live `ffprobe` call,
self-heal via the existing `update_exif_if_changed`, no new DB columns for
display-only fields — is both simpler and consistent with how photos already
work, per the discussion above.

`record_photos_meta_data` is reached from photo import
(`job_queue/handlers/import.rs`) and full DB rebuild
(`create_db.rs`/`recovery` paths); both are appropriate places to capture
video metadata. The style-edit path (`style_commands.rs`) re-records a single
photo after an in-app edit, which never applies to videos, so no video-only
handling is needed there.

**Third call site, found during planning:**
`repository/db/directory.rs::move_photos_to_exif_date` — the "move photos to
EXIF date" directory-menu action — calls `Photo::new_with_exif(file)`, which
also calls `ExifData::new()` unconditionally. Same bug, same fix: branch on
`is_video()` and use `VideoMetadata::to_exif_data()` instead. This function
only needs `created_date_string()` (derived from `time`/`date_time`), so no
other part of it changes.

## Schema — no migration

No new columns. Confirmed by grep across `search.rs`, `filter_options.rs`,
and `stats/stats_queries.rs`: `exif_model`/`exif_make` are read by the camera
search filter, the camera-filter dropdown, and burst grouping — worth
writing. `exif_xresolution`/`exif_yresolution` and any duration/codec/GPS
column are read by nothing — not worth adding.

| `VideoMetadata` field | Storage | Rationale |
|---|---|---|
| `creation_time` | existing `exif_date_time_original` | The date-sort/grouping bug fix; read by bulk list/date queries |
| `model` | existing `exif_model` | Read by search filter, camera-filter dropdown, burst grouping |
| `make` | existing `exif_make` | Same three consumers as `model` (they're always queried together) |
| `width` / `height` | existing `exif_xresolution` / `exif_yresolution` | Zero marginal cost — same `ffprobe` call already returns them, existing columns/INSERT slots already exist; harmless even though nothing reads them back yet |
| `duration_secs`, `codec`, `gps_latitude`, `gps_longitude` | not persisted | No consumer; supplied live by `get_photo_info` only (see below) |

`VideoMetadata` (`value/video_metadata.rs`):

```rust
pub struct VideoMetadata {
    pub creation_time: String,       // "YYYY-MM-DD HH:MM:SS", local time
    pub make: String,
    pub model: String,
    pub width: String,
    pub height: String,
    pub duration_secs: Option<f64>,
    pub codec: String,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
}
```

No changes to `entity/photo.rs` (no new `Photo` fields, no new
`embed_video_metadata` method) and no changes to `entity/photo_meta.rs` —
`VideoMetadata::to_exif_data()` produces a plain `exif::ExifData` that flows
through the `embed_exif` and `update_exif_if_changed` functions exactly as
photo EXIF does today.

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
`video: Option<serde_json::Value>` field. In `photo_info_blocking`, when
`photo.is_video()`, it's built directly from the live `VideoMetadata`
(`duration_secs`, `codec`, `gps_latitude`, `gps_longitude`) — no DB read.
`exif` continues to come from `VideoMetadata::to_exif_data()` synced through
`update_exif_if_changed`, same as the photo branch.

## Testing

- **Rust unit tests** for `utils/ffprobe.rs` JSON parsing, using canned JSON
  strings (no real `ffprobe` invocation): normal case, multiple streams
  (audio+video), missing `creation_time`, missing/malformed GPS tag, and the
  UTC→local conversion at a DST boundary.
- **Unit tests** for the ISO 6709 GPS parser: well-formed string, missing
  trailing slash, missing altitude component, malformed input.
- **Unit test** for `VideoMetadata::to_exif_data()`: only
  `date_time_original`/`make`/`model`/`xresolution`/`yresolution` are set,
  every other `ExifData` field stays empty (so `update_exif_if_changed` never
  touches ISO/f-number/lens/etc. for a video row).
- **Existing test coverage for `update_exif_if_changed` is reused as-is** —
  it's driven purely by the `ExifData` it's handed, so no video-specific
  changes to that function are needed or tested.
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
- A `gps_latitude`/`gps_longitude` (or similar) column for photos or videos,
  if a future feature (e.g. a map view) needs GPS to be queryable in bulk
  rather than read live per item.
