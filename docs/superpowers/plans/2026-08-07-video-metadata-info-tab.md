# 動画メタ情報を info タブに表示する 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 動画ファイルの撮影日時・機種・解像度・長さ・フレームレート・コーデックを ffprobe から取得し、info タブに表示するとともに DB の撮影日時を正しい値に直す。

**Architecture:** `utils/exif_parser.rs` の「動画は空を返す」早期 return を「動画は ffprobe で読む」に置き換える。これで `ExifData::new` の呼び出し元 4 箇所（info タブ / インポート / DB 再構築 / `move_photos_to_exif_date`）が一度に直り、DB カラムもマイグレーションも増えない。EXIF の語彙に無い解像度・長さ・fps・コーデックは `get_photo_info` のレスポンスに専用フィールドとして載せ、DB には保存しない。

**Tech Stack:** Rust (Tauri backend), React (frontend), ffprobe (CLI), chrono, serde_json, i18next

**設計仕様:** `docs/superpowers/specs/2026-08-07-video-metadata-info-tab-design.md`

## Global Constraints

- Rust のログは `log::warn!(target: "module", "event; key={}", value)` 形式。`println!` は使わない。
- フロントエンドのログは `import { logger } from '../../../services/LoggerService.js'`。`console.log` は使わない。
- CSS はハードコード禁止。既存の `styles['photo-info-table']` を使い回し、新規 CSS は追加しない。
- ファイルは 600 行以下を維持する。
- i18n キーは `src/i18n/locales/ja/common.json` と `src/i18n/locales/en/common.json` の 2 ファイルのみに追加する（他 5 言語は `src/i18n/index.js:150` の `fallbackLng: 'en'` で英語にフォールバックする既存の慣習）。
- Rust テストの実行は `cd src-tauri && cargo test <名前>`。
- ffprobe が無い / 失敗する環境でも壊れないこと。テストは ffprobe の実行に依存させない。
- 日時の書式は写真の EXIF と揃えて `YYYY-MM-DD HH:MM:SS`。

---

## File Structure

**新規:**
- `src-tauri/src/utils/video_probe.rs` — ffprobe を起動して動画のストリーム構成を読む薄いラッパ。ドメイン方針を持たない。

**変更:**
- `src-tauri/src/utils/mod.rs` — `pub mod video_probe;` を追加
- `src-tauri/src/domain_service/video_edit_service/probe.rs` — `VideoProbe` / `probe_video` / `parse_frame_rate` を `utils` へ移し、再エクスポートに置き換える。`recorded_at` / `normalize_creation_time` は残す
- `src-tauri/src/domain_service/video_edit_service/merge_args.rs:204` — テストヘルパ `probe()` に新フィールドを足す
- `src-tauri/src/utils/exif_parser.rs` — 動画の早期 return を ffprobe 経路に差し替える
- `src-tauri/src/commands/photo_commands.rs` — `PhotoInfoResponse` に `video` フィールドを追加
- `src/App/PhotosList/PhotoOption/PhotoInfo.jsx` — 動画用の行と写真用の行を切り替える
- `src/i18n/locales/ja/common.json` / `src/i18n/locales/en/common.json` — 新規キー 4 つ

---

### Task 1: `probe_video` を `utils/video_probe.rs` へ移し、コーデックと encoder を読めるようにする

`probe_video` は ffprobe を叩いて JSON を読むだけでドメイン方針を持たないため `utils` が正しい置き場所。この移動によって、次のタスクで `utils/exif_parser.rs` から層を逆転させずに呼べるようになる。

同時に、プロセス起動（`probe_video`）と JSON 解釈（`parse_probe_json`）を分ける。JSON 解釈が純粋関数になり、ffprobe の実行に依存しないテストが書ける。

**Files:**
- Create: `src-tauri/src/utils/video_probe.rs`
- Modify: `src-tauri/src/utils/mod.rs`
- Modify: `src-tauri/src/domain_service/video_edit_service/probe.rs`
- Modify: `src-tauri/src/domain_service/video_edit_service/merge_args.rs:204-212`
- Test: `src-tauri/src/utils/video_probe.rs`（同ファイル内の `#[cfg(test)] mod tests`。このリポジトリの Rust テストはすべてインラインの慣習）

**Interfaces:**
- Produces:
  - `crate::utils::video_probe::VideoProbe` — pub フィールド `width: u32`, `height: u32`, `fps: f64`, `has_audio: bool`, `duration_sec: f64`, `creation_time: Option<String>`, `video_codec: Option<String>`, `encoder: Option<String>`
  - `crate::utils::video_probe::probe_video(path: &str) -> Result<VideoProbe, String>`
  - `crate::domain_service::video_edit_service::probe::{probe_video, VideoProbe}` は再エクスポートとして従来どおり使える

- [ ] **Step 1: 新ファイルに移動＋新フィールドを足したテストを書く**

`src-tauri/src/utils/video_probe.rs` を新規作成し、まずテストだけ書く（実装は Step 3）。

```rust
//! Reading the properties of a video file with ffprobe.
//!
//! A thin wrapper around the `ffprobe` CLI: it starts the process and turns
//! its JSON into a struct, and holds no policy about what the values mean.
//! Both the video merge editor and the EXIF parser read videos through here.

use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// ffprobe only reads headers, so a short timeout is enough to catch a hang.
const PROBE_TIMEOUT: Duration = Duration::from_secs(30);
/// How often the run loop polls the child process's state.
const POLL_INTERVAL: Duration = Duration::from_millis(200);
/// Used when ffprobe cannot report a usable frame rate.
const DEFAULT_FPS: f64 = 30.0;

/// The properties of a video file that callers need.
#[derive(Debug, Clone)]
pub struct VideoProbe {
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub has_audio: bool,
    pub duration_sec: f64,
    /// The container's `creation_time` tag, when the camera wrote one.
    pub creation_time: Option<String>,
    /// The video stream's codec, e.g. `"hevc"`.
    pub video_codec: Option<String>,
    /// The container's `encoder` tag, which is where an action camera writes
    /// its model name, e.g. `"DJI OsmoAction6"`.
    pub encoder: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Trimmed from a real DJI Osmo Action 6 clip. Note the two video streams:
    /// index 0 is the recording, index 5 is an embedded mjpeg thumbnail.
    const DJI_JSON: &[u8] = br#"{
      "streams": [
        {"index": 0, "codec_name": "hevc", "codec_type": "video",
         "width": 1920, "height": 1080, "r_frame_rate": "30000/1001"},
        {"index": 1, "codec_name": "aac", "codec_type": "audio",
         "r_frame_rate": "0/0"},
        {"index": 5, "codec_name": "mjpeg", "codec_type": "video",
         "width": 1280, "height": 720, "r_frame_rate": "90000/1"}
      ],
      "format": {
        "duration": "11.968000",
        "tags": {
          "creation_time": "2026-06-29T04:30:05.000000Z",
          "encoder": "DJI OsmoAction6"
        }
      }
    }"#;

    #[test]
    fn reads_every_field_from_a_real_clip() {
        let probe = parse_probe_json(DJI_JSON, "/x.mp4").expect("parse");

        assert_eq!(probe.width, 1920);
        assert_eq!(probe.height, 1080);
        assert!((probe.fps - 29.97).abs() < 0.01);
        assert!(probe.has_audio);
        assert!((probe.duration_sec - 11.968).abs() < 0.001);
        assert_eq!(
            probe.creation_time.as_deref(),
            Some("2026-06-29T04:30:05.000000Z")
        );
        assert_eq!(probe.video_codec.as_deref(), Some("hevc"));
        assert_eq!(probe.encoder.as_deref(), Some("DJI OsmoAction6"));
    }

    #[test]
    fn takes_the_first_video_stream_not_the_embedded_thumbnail() {
        // The mjpeg stream at index 5 is a 1280x720 thumbnail. Picking it
        // would report the wrong resolution and codec for the whole file.
        let probe = parse_probe_json(DJI_JSON, "/x.mp4").expect("parse");
        assert_eq!((probe.width, probe.height), (1920, 1080));
        assert_eq!(probe.video_codec.as_deref(), Some("hevc"));
    }

    #[test]
    fn optional_tags_are_none_when_the_container_has_none() {
        let json = br#"{
          "streams": [
            {"codec_name": "h264", "codec_type": "video",
             "width": 640, "height": 480, "r_frame_rate": "25"}
          ],
          "format": {"duration": "3.0"}
        }"#;
        let probe = parse_probe_json(json, "/x.mp4").expect("parse");

        assert_eq!(probe.creation_time, None);
        assert_eq!(probe.encoder, None);
        assert!(!probe.has_audio);
        assert!((probe.duration_sec - 3.0).abs() < f64::EPSILON);
    }

    #[test]
    fn rejects_a_file_with_no_usable_video_stream() {
        let no_video = br#"{"streams": [{"codec_type": "audio"}], "format": {}}"#;
        assert!(parse_probe_json(no_video, "/x.mp4").is_err());

        let zero_size = br#"{
          "streams": [{"codec_type": "video", "width": 0, "height": 0}],
          "format": {}
        }"#;
        assert!(parse_probe_json(zero_size, "/x.mp4").is_err());
    }

    #[test]
    fn parses_rational_and_plain_frame_rates() {
        assert!((parse_frame_rate("30000/1001") - 29.97).abs() < 0.01);
        assert!((parse_frame_rate("25") - 25.0).abs() < f64::EPSILON);
        // 0/0 is what ffprobe reports for streams with no usable rate.
        assert!((parse_frame_rate("0/0") - DEFAULT_FPS).abs() < f64::EPSILON);
        assert!((parse_frame_rate("") - DEFAULT_FPS).abs() < f64::EPSILON);
    }
}
```

`src-tauri/src/utils/mod.rs` の `pub mod raw_file;` の次の行に追加:

```rust
pub mod video_probe;
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd src-tauri && cargo test --lib utils::video_probe 2>&1 | tail -20`
Expected: コンパイルエラー。`cannot find function 'parse_probe_json' in this scope` と `cannot find function 'parse_frame_rate' in this scope`

- [ ] **Step 3: 実装を書く**

`src-tauri/src/utils/video_probe.rs` の `#[cfg(test)] mod tests` の**前**に挿入する。`probe_video` / `parse_frame_rate` の中身は `domain_service/video_edit_service/probe.rs:25-115,159-170` からの移動で、変更点は (a) `FFMPEG_POLL_INTERVAL` を同ファイルの `POLL_INTERVAL` に変えたこと、(b) ffprobe 引数に `codec_name` と `format_tags=encoder` を足したこと、(c) JSON 解釈を `parse_probe_json` に切り出したこと の 3 点。

```rust
/// Reads the stream layout of `path` with ffprobe.
pub fn probe_video(path: &str) -> Result<VideoProbe, String> {
    let mut child = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name,width,height,r_frame_rate",
            "-show_entries",
            "format=duration",
            // Separate calls accumulate per section, so this adds the tags
            // without dropping the stream and format entries above.
            "-show_entries",
            "format_tags=creation_time,encoder",
            "-of",
            "json",
        ])
        .arg(path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start ffprobe for {}: {}", path, e))?;

    let deadline = Instant::now() + PROBE_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "ffprobe timed out after {}s for {}",
                        PROBE_TIMEOUT.as_secs(),
                        path
                    ));
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("ffprobe failed for {}: {}", path, e));
            }
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Cannot read ffprobe output for {}: {}", path, e))?;
    if !output.status.success() {
        return Err(format!(
            "ffprobe failed for {}: {}",
            path,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    parse_probe_json(&output.stdout, path)
}

/// Turns ffprobe's JSON into a [`VideoProbe`].
///
/// Split out from [`probe_video`] so the interpretation of ffprobe's output is
/// testable without ffprobe installed.
fn parse_probe_json(stdout: &[u8], path: &str) -> Result<VideoProbe, String> {
    let parsed: serde_json::Value = serde_json::from_slice(stdout)
        .map_err(|e| format!("Cannot parse ffprobe output for {}: {}", path, e))?;

    let empty = Vec::new();
    let streams = parsed["streams"].as_array().unwrap_or(&empty);
    // The first video stream is the recording. A camera may append others -
    // DJI writes an mjpeg thumbnail as a second video stream - and those
    // would report the wrong resolution and codec for the file.
    let video = streams
        .iter()
        .find(|s| s["codec_type"].as_str() == Some("video"))
        .ok_or_else(|| format!("No video stream found in {}", path))?;
    let has_audio = streams
        .iter()
        .any(|s| s["codec_type"].as_str() == Some("audio"));

    let width = video["width"].as_u64().unwrap_or(0) as u32;
    let height = video["height"].as_u64().unwrap_or(0) as u32;
    if width == 0 || height == 0 {
        return Err(format!("Video stream in {} has no usable dimensions", path));
    }

    Ok(VideoProbe {
        width,
        height,
        fps: parse_frame_rate(video["r_frame_rate"].as_str().unwrap_or("")),
        has_audio,
        duration_sec: parsed["format"]["duration"]
            .as_str()
            .and_then(|d| d.parse::<f64>().ok())
            .unwrap_or(0.0),
        creation_time: parsed["format"]["tags"]["creation_time"]
            .as_str()
            .map(str::to_string),
        video_codec: video["codec_name"].as_str().map(str::to_string),
        encoder: parsed["format"]["tags"]["encoder"]
            .as_str()
            .map(str::to_string),
    })
}

/// ffprobe reports frame rates as a rational string such as `"30000/1001"`.
/// Falls back to [`DEFAULT_FPS`] when the field is missing or degenerate.
fn parse_frame_rate(raw: &str) -> f64 {
    let (num, den) = match raw.split_once('/') {
        Some((n, d)) => (n.parse::<f64>().ok(), d.parse::<f64>().ok()),
        None => (raw.parse::<f64>().ok(), Some(1.0)),
    };
    match (num, den) {
        (Some(n), Some(d)) if n > 0.0 && d > 0.0 => n / d,
        _ => DEFAULT_FPS,
    }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd src-tauri && cargo test --lib utils::video_probe 2>&1 | tail -20`
Expected: 5 tests passed（この時点で `video_edit_service/probe.rs` に重複定義が残っているが、モジュールが別なのでコンパイルは通る）

- [ ] **Step 5: 移動元を再エクスポートに置き換える**

`src-tauri/src/domain_service/video_edit_service/probe.rs` を丸ごと以下に置き換える。`VideoProbe` / `probe_video` / `parse_frame_rate` とそのテストは Task 1 で `utils` に移したので消し、`recorded_at` / `normalize_creation_time` とそのテストだけを残す。

```rust
//! Deciding when a video was recorded.
//!
//! The mechanics of running ffprobe live in [`crate::utils::video_probe`];
//! this module owns the policy of what to do with what it reports. The
//! re-export keeps `super::probe::{probe_video, VideoProbe}` working for the
//! merge code.

pub use crate::utils::video_probe::{probe_video, VideoProbe};

/// When a video was recorded, as an RFC 3339 timestamp.
///
/// Prefers the container's `creation_time` tag, which is what a camera writes,
/// and falls back to the file's modification time - the same thing the import
/// pipeline dates videos by, since video containers carry no EXIF.
pub fn recorded_at(path: &str) -> Result<String, String> {
    match probe_video(path) {
        Ok(probe) => match probe.creation_time {
            Some(created) => match normalize_creation_time(&created) {
                Some(normalized) => return Ok(normalized),
                None => log::warn!(
                    target: "video_edit_service",
                    "creation_time_unparsable; path={}; value={}",
                    path, created
                ),
            },
            None => log::debug!(target: "video_edit_service", "no_creation_time; path={}", path),
        },
        Err(e) => {
            log::warn!(target: "video_edit_service", "recorded_at_probe_failed; path={}; error={}", path, e);
        }
    }

    let modified = std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .map_err(|e| format!("Cannot read the modification time of {}: {}", path, e))?;
    Ok(chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339())
}

/// Turns a container `creation_time` tag into the RFC 3339 form [`recorded_at`]
/// promises its callers.
///
/// ffprobe passes the tag through verbatim, so a container written by something
/// other than a camera can carry anything at all. Returns `None` for a value
/// that is not a timestamp, which sends [`recorded_at`] to its
/// modification-time fallback rather than leaking an unparsable string.
fn normalize_creation_time(raw: &str) -> Option<String> {
    chrono::DateTime::parse_from_rfc3339(raw.trim())
        .ok()
        .map(|parsed| parsed.with_timezone(&chrono::Utc).to_rfc3339())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_only_parsable_creation_times() {
        // The form a camera writes.
        assert_eq!(
            normalize_creation_time("2024-05-06T07:08:09.000000Z").as_deref(),
            Some("2024-05-06T07:08:09+00:00")
        );
        // An offset is normalized to UTC so callers get one comparable form.
        assert_eq!(
            normalize_creation_time("2024-05-06T16:08:09+09:00").as_deref(),
            Some("2024-05-06T07:08:09+00:00")
        );
        // Anything that is not RFC 3339 is rejected rather than passed on.
        assert_eq!(normalize_creation_time("2024-05-06 07:08:09"), None);
        assert_eq!(normalize_creation_time("not a date"), None);
        assert_eq!(normalize_creation_time(""), None);
    }

    #[test]
    fn recorded_at_falls_back_to_the_modification_time() {
        // A text file cannot be probed, so this reaches the fallback whether or
        // not ffprobe is installed on the machine running the tests.
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("not-a-video.txt");
        std::fs::write(&path, b"x").expect("write file");
        let modified = std::fs::metadata(&path)
            .and_then(|meta| meta.modified())
            .expect("modification time");

        let recorded = recorded_at(path.to_str().expect("utf-8 path")).expect("recorded_at");

        assert_eq!(
            recorded,
            chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339()
        );
    }
}
```

`normalize_creation_time` は private のまま。Task 2 の `exif_parser` は `utils` 層なので、`domain_service` のこの関数を借りると層が逆転する。あちらは RFC 3339 のパースを自前で持つ（3 行で済む）。

- [ ] **Step 6: テストヘルパに新フィールドを足す**

`src-tauri/src/domain_service/video_edit_service/merge_args.rs:204-212` の `probe()` ヘルパを差し替える:

```rust
    fn probe(width: u32, height: u32, has_audio: bool) -> VideoProbe {
        VideoProbe {
            width,
            height,
            fps: 30.0,
            has_audio,
            duration_sec: 60.0,
            creation_time: None,
            video_codec: None,
            encoder: None,
        }
    }
```

- [ ] **Step 7: 全体がビルドとテストを通ることを確認**

Run: `cd src-tauri && cargo test --lib video_probe && cargo test --lib video_edit_service 2>&1 | tail -20`
Expected: すべて passed。重複定義や未使用 import の警告が出たら直す

Run: `cd src-tauri && cargo clippy --lib 2>&1 | grep -E "^(error|warning)" | head -20`
Expected: 新しい error / warning が出ないこと

- [ ] **Step 8: コミット**

```bash
git add src-tauri/src/utils/video_probe.rs src-tauri/src/utils/mod.rs \
        src-tauri/src/domain_service/video_edit_service/probe.rs \
        src-tauri/src/domain_service/video_edit_service/merge_args.rs
git commit -m "refactor: probe_video を utils に移しコーデックと encoder を読めるようにする"
```

---

### Task 2: 動画の EXIF 相当を ffprobe から取り出す

`exif_parser.rs` の動画の早期 return を差し替える。これが今回の中心で、`ExifData::new` の呼び出し元 4 箇所がすべてこの 1 箇所で直る。

**Files:**
- Modify: `src-tauri/src/utils/exif_parser.rs:52-59`
- Test: `src-tauri/src/utils/exif_parser.rs`（同ファイル内に `#[cfg(test)] mod tests` を新設）

**Interfaces:**
- Consumes: `crate::utils::video_probe::{VideoProbe, probe_video}`（Task 1）、`crate::domain_service::video_edit_service::probe::normalize_creation_time`（Task 1 で `pub` にしたもの）
- Produces: 動画に対して `parse_exif` が `ExifTagKind::DateTime` / `ExifTagKind::DateTimeOriginal` / `ExifTagKind::Model` の `ExifEntry` を返すようになる。`value/exif.rs` の既存のマッピングがそのまま拾う

- [ ] **Step 1: 失敗するテストを書く**

`src-tauri/src/utils/exif_parser.rs` の末尾に追加:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::video_probe::VideoProbe;

    fn probe(creation_time: Option<&str>, encoder: Option<&str>) -> VideoProbe {
        VideoProbe {
            width: 1920,
            height: 1080,
            fps: 29.97,
            has_audio: true,
            duration_sec: 11.968,
            creation_time: creation_time.map(str::to_string),
            video_codec: Some("hevc".to_string()),
            encoder: encoder.map(str::to_string),
        }
    }

    fn value_of(entries: &[ExifEntry], tag: ExifTagKind) -> Option<String> {
        entries
            .iter()
            .find(|e| e.tag == tag)
            .map(|e| e.value_readable.clone())
    }

    /// The local time a UTC timestamp lands on depends on the machine's zone,
    /// so the tests assert against the same conversion rather than a literal.
    fn expected_local(utc: &str) -> String {
        chrono::DateTime::parse_from_rfc3339(utc)
            .expect("rfc 3339")
            .with_timezone(&chrono::Local)
            .format("%Y-%m-%d %H:%M:%S")
            .to_string()
    }

    #[test]
    fn a_camera_clip_yields_both_date_fields_and_the_model() {
        let entries = entries_from_probe(&probe(
            Some("2026-06-29T04:30:05.000000Z"),
            Some("DJI OsmoAction6"),
        ));

        let want = expected_local("2026-06-29T04:30:05Z");
        assert_eq!(value_of(&entries, ExifTagKind::DateTime).as_ref(), Some(&want));
        // DateTimeOriginal matters as much as DateTime: the photo list sorts by
        // COALESCE(exif_date_time_original, exif_date_time, photo_date), so
        // leaving it NULL would keep the list order wrong.
        assert_eq!(
            value_of(&entries, ExifTagKind::DateTimeOriginal).as_ref(),
            Some(&want)
        );
        assert_eq!(
            value_of(&entries, ExifTagKind::Model).as_deref(),
            Some("DJI OsmoAction6")
        );
    }

    #[test]
    fn converts_utc_to_local_across_a_date_boundary() {
        // 20:00 UTC is the next day in JST. Formatting the UTC value verbatim
        // would file the clip under the wrong date.
        let entries = entries_from_probe(&probe(Some("2026-06-29T20:00:00.000000Z"), None));
        assert_eq!(
            value_of(&entries, ExifTagKind::DateTime),
            Some(expected_local("2026-06-29T20:00:00Z"))
        );
    }

    #[test]
    fn omits_the_date_when_the_container_has_no_usable_creation_time() {
        // No entry means ExifData::new falls back to the file creation time,
        // which is the behaviour videos had before ffprobe was wired in.
        for raw in [None, Some("not a date"), Some("2026-06-29 13:30:05")] {
            let entries = entries_from_probe(&probe(raw, Some("DJI OsmoAction6")));
            assert_eq!(value_of(&entries, ExifTagKind::DateTime), None, "raw={:?}", raw);
            assert_eq!(
                value_of(&entries, ExifTagKind::DateTimeOriginal),
                None,
                "raw={:?}",
                raw
            );
            // The model is independent of the timestamp and still comes through.
            assert_eq!(
                value_of(&entries, ExifTagKind::Model).as_deref(),
                Some("DJI OsmoAction6")
            );
        }
    }

    #[test]
    fn omits_the_model_when_the_container_has_no_encoder_tag() {
        let entries = entries_from_probe(&probe(Some("2026-06-29T04:30:05Z"), None));
        assert_eq!(value_of(&entries, ExifTagKind::Model), None);
    }

    #[test]
    fn a_container_with_nothing_useful_yields_nothing() {
        assert!(entries_from_probe(&probe(None, None)).is_empty());
    }
}
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd src-tauri && cargo test --lib utils::exif_parser 2>&1 | tail -20`
Expected: コンパイルエラー `cannot find function 'entries_from_probe' in this scope`

- [ ] **Step 3: 実装を書く**

`src-tauri/src/utils/exif_parser.rs:52-59` の早期 return を差し替える。差し替え前:

```rust
    // Videos have no JPEG/TIFF EXIF. Skip them early: rexif::parse_file would read
    // the entire file into memory, which hangs the app on multi-GB video files.
    if raw_file::is_video_file(path) {
        return Ok(ExifParseResult {
            entries: Vec::new(),
        });
    }
```

差し替え後:

```rust
    // Videos have no JPEG/TIFF EXIF, and rexif::parse_file would read the
    // entire file into memory looking for one - which hangs the app on
    // multi-GB video files. ffprobe reads only the container headers.
    if raw_file::is_video_file(path) {
        return Ok(ExifParseResult {
            entries: video_entries(path),
        });
    }
```

同ファイルの `parse_exif` の直後に追加:

```rust
/// The EXIF-equivalent fields a video container carries.
///
/// Returns an empty list when ffprobe is missing or fails, which leaves
/// `ExifData::new` on its file-creation-time fallback - the behaviour videos
/// had before this path existed.
fn video_entries(path: &str) -> Vec<ExifEntry> {
    match crate::utils::video_probe::probe_video(path) {
        Ok(probe) => entries_from_probe(&probe),
        Err(e) => {
            log::warn!(target: "exif_parser", "video_probe_failed; path={}; error={}", path, e);
            Vec::new()
        }
    }
}

/// Maps a probe onto EXIF tags.
///
/// Split from [`video_entries`] so the mapping is testable without ffprobe.
fn entries_from_probe(probe: &crate::utils::video_probe::VideoProbe) -> Vec<ExifEntry> {
    let mut entries = Vec::new();

    let entry = |tag: ExifTagKind, value: String| ExifEntry {
        tag,
        value: value.clone(),
        value_readable: value,
        ext_data: Vec::new(),
    };

    // The tag is UTC; the library dates photos in local time.
    let recorded = probe
        .creation_time
        .as_deref()
        .and_then(local_datetime_from_utc);
    if let Some(recorded) = recorded {
        // Both fields, because the photo list sorts by
        // COALESCE(exif_date_time_original, exif_date_time, photo_date) and
        // only writing one of them would leave the other NULL in the DB.
        entries.push(entry(ExifTagKind::DateTime, recorded.clone()));
        entries.push(entry(ExifTagKind::DateTimeOriginal, recorded));
    }

    // An action camera writes its model name into the container's `encoder`
    // tag; there is no separate make/model box in MP4.
    if let Some(encoder) = probe.encoder.as_deref() {
        if !encoder.trim().is_empty() {
            entries.push(entry(ExifTagKind::Model, encoder.trim().to_string()));
        }
    }

    entries
}

/// Turns a container `creation_time` tag into the local `YYYY-MM-DD HH:MM:SS`
/// form the rest of the app dates photos with.
///
/// Returns `None` for anything that is not RFC 3339 - ffprobe passes the tag
/// through verbatim, so a container written by something other than a camera
/// can carry any string at all.
fn local_datetime_from_utc(raw: &str) -> Option<String> {
    chrono::DateTime::parse_from_rfc3339(raw.trim())
        .ok()
        .map(|parsed| {
            parsed
                .with_timezone(&chrono::Local)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        })
}
```

`video_edit_service` 側の `normalize_creation_time` は借りない。`utils` から `domain_service` を参照すると層が逆転するし、こちらが欲しいのはローカル時刻の文字列であって RFC 3339 への正規化ではない。判定（RFC 3339 として読めるものだけ通す）は同じなので、Step 1 のテストが両者のずれを検出する。

- [ ] **Step 4: テストが通ることを確認**

Run: `cd src-tauri && cargo test --lib utils::exif_parser 2>&1 | tail -20`
Expected: 5 tests passed

- [ ] **Step 5: 実ファイルで確かめる**

一時的な検証バイナリではなく、テストから実ファイルを読んで目視する。以下を一時ファイルに書いて実行し、確認できたら消す:

```bash
cd src-tauri && cat > /tmp/claude-1000/-home-ktat-git-github-photoclove/0e765d70-348b-4244-96c8-87583d1fbcd5/scratchpad/check.sh <<'EOF'
ffprobe -v error \
  -show_entries stream=codec_type,codec_name,width,height,r_frame_rate \
  -show_entries format=duration \
  -show_entries format_tags=creation_time,encoder \
  -of json \
  "/mnt/picture/00 pictures/2026-06-29/caa83a09-5960-46f1-90f1-6bc0769eb42f/DJI_20260629133004_0254_D.MP4"
EOF
sh /tmp/claude-1000/-home-ktat-git-github-photoclove/0e765d70-348b-4244-96c8-87583d1fbcd5/scratchpad/check.sh
```

Expected: `codec_name: "hevc"`, `width: 1920`, `height: 1080`, `creation_time: "2026-06-29T04:30:05.000000Z"`, `encoder: "DJI OsmoAction6"` が含まれること。Task 1 で書いた ffprobe 引数がこの出力を実際に返すことの確認

- [ ] **Step 6: コミット**

```bash
git add src-tauri/src/utils/exif_parser.rs
git commit -m "fix: 動画の撮影日時と機種を ffprobe から取得する"
```

---

### Task 3: 解像度・長さ・fps・コーデックを get_photo_info のレスポンスに載せる

EXIF の語彙に無い動画固有の値を、info タブ専用のフィールドとして返す。DB には保存しない。

**Files:**
- Modify: `src-tauri/src/commands/photo_commands.rs:28-47`（`PhotoInfoResponse`）、`:277-307`（`photo_info_blocking`）、`:309-`（ファイルが存在しない場合の分岐）

**Interfaces:**
- Consumes: `crate::utils::video_probe::probe_video`（Task 1）、`crate::utils::raw_file::is_video_file`
- Produces: `get_photo_info` の JSON に `video` キーが増える。動画でないか ffprobe が失敗した場合は `null`
  ```json
  "video": { "width": 1920, "height": 1080, "fps": 29.97,
             "duration_sec": 11.968, "video_codec": "hevc" }
  ```

- [ ] **Step 1: レスポンス構造体に `video` を足す**

`src-tauri/src/commands/photo_commands.rs` の `PhotoInfoResponse` の `exif` フィールドの後ろに追加:

```rust
    /// Container properties of a video file. `None` for photos, and for
    /// videos ffprobe could not read.
    pub video: Option<VideoInfo>,
}

/// The video-only properties the info tab shows. These have no EXIF
/// equivalent, so they travel outside `exif` and are not stored in the DB.
#[derive(serde::Serialize)]
pub struct VideoInfo {
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub duration_sec: f64,
    pub video_codec: String,
}
```

（元の構造体の閉じ括弧 `}` を上の形に置き換える）

- [ ] **Step 2: `photo_info_blocking` で埋める**

`photo_commands.rs:296` の `let file_size = ...` の直後に追加:

```rust
            // Videos carry their properties in the container, not in EXIF.
            // ffprobe reads only the headers, so this is cheap even on a
            // multi-GB file on NFS.
            let video = if crate::utils::raw_file::is_video_file(&actual_path) {
                match crate::utils::video_probe::probe_video(&actual_path) {
                    Ok(probe) => Some(VideoInfo {
                        width: probe.width,
                        height: probe.height,
                        fps: probe.fps,
                        duration_sec: probe.duration_sec,
                        video_codec: probe.video_codec.unwrap_or_default(),
                    }),
                    Err(e) => {
                        log::warn!(target: "photo_info", "video_probe_failed; path={}; error={}", actual_path, e);
                        None
                    }
                }
            } else {
                None
            };
```

`PhotoInfoResponse` のリテラルに `video,` を足す:

```rust
            let response = PhotoInfoResponse {
                original_path: path_str.to_string(),
                current_path: actual_path,
                is_trashed,
                file_size,
                meta: meta_value,
                exif: exif_value,
                video,
            };
```

注意: `actual_path` は `current_path` に move されるので、`video` の計算はその**前**に置くこと。

- [ ] **Step 3: ファイルが存在しない場合の分岐も直す**

`photo_commands.rs:309` 以降の `None => { ... }` の中にも `PhotoInfoResponse` のリテラルがある。そこに `video: None,` を足す。

Run: `cd src-tauri && cargo build --lib 2>&1 | grep -E "^error" -A 5 | head -20`
Expected: `missing field 'video'` のエラーが出た箇所をすべて潰し、最終的にエラーなし

- [ ] **Step 4: ビルドとテストが通ることを確認**

Run: `cd src-tauri && cargo test --lib 2>&1 | tail -10`
Expected: すべて passed

Run: `cd src-tauri && cargo clippy --lib 2>&1 | grep -E "^(error|warning)" | head -20`
Expected: 新しい error / warning が出ないこと

- [ ] **Step 5: コミット**

```bash
git add src-tauri/src/commands/photo_commands.rs
git commit -m "feat: get_photo_info が動画の解像度と長さとコーデックを返すようにする"
```

---

### Task 4: info タブで動画用の行を出す

**Files:**
- Modify: `src/App/PhotosList/PhotoOption/PhotoInfo.jsx`
- Modify: `src/i18n/locales/ja/common.json`
- Modify: `src/i18n/locales/en/common.json`

**Interfaces:**
- Consumes: `photoInfo.video`（Task 3）— `{ width, height, fps, duration_sec, video_codec }` または `null`

- [ ] **Step 1: i18n キーを足す**

`src/i18n/locales/ja/common.json` の `photoInfo` セクション、`"orientation": "向き",` の次の行に追加:

```json
    "resolution": "解像度",
    "duration": "長さ",
    "frameRate": "フレームレート",
    "videoCodec": "映像コーデック",
```

`src/i18n/locales/en/common.json` の `photoInfo` セクション、`"orientation"` の次の行に追加:

```json
    "resolution": "Resolution",
    "duration": "Duration",
    "frameRate": "Frame Rate",
    "videoCodec": "Video Codec",
```

- [ ] **Step 2: 書式化ヘルパを足す**

`src/App/PhotosList/PhotoOption/PhotoInfo.jsx` の `formatFileSize` の直後（16 行目の後）に追加:

```javascript
function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '';
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatFrameRate(fps) {
    if (!fps || fps <= 0) return '';
    // 29.97 keeps its decimals, 30 does not become "30.00".
    return `${Number(fps.toFixed(2))} fps`;
}
```

- [ ] **Step 3: 行のかたまりを 2 つのコンポーネントに切り出す**

同ファイル内、`function PhotoInfo(props) {` の**前**に追加。`PhotoExifRows` の中身は現在の `PhotoInfo.jsx:243-259` からの移動:

```javascript
/** The EXIF rows a still photo has. Videos carry none of these. */
function PhotoExifRows({ exif, t }) {
    const v = (key) => (exif ? exif[key] : "");
    return (
        <>
            <tr><th>{t('photoInfo.iso')}</th><td>{v('iso')}</td></tr>
            <tr><th>{t('photoInfo.fNumber')}</th><td>{v('fnumber')}</td></tr>
            <tr><th>{t('photoInfo.shutterSpeed')}</th><td>{v('exposure_time')}</td></tr>
            <tr><th>{t('photoInfo.lensModel')}</th><td>{v('lens_model')}</td></tr>
            <tr><th>{t('photoInfo.lensMake')}</th><td>{v('lens_make')}</td></tr>
            <tr><th>{t('photoInfo.make')}</th><td>{v('make')}</td></tr>
            <tr><th>{t('photoInfo.model')}</th><td>{v('model')}</td></tr>
            <tr><th>{t('photoInfo.dateTime')}</th><td>{v('date_time')}</td></tr>
            <tr><th>{t('photoInfo.focalLength')}</th><td>{exif ?
                exif.focal_length == exif.focal_length_in35mm_film
                    ? exif.focal_length
                    : exif.focal_length + "(" + exif.focal_length_in35mm_film + ")" : ""}
            </td></tr>
            <tr><th>{t('photoInfo.digitalZoomRatio')}</th><td>{v('digital_zoom_ratio')}</td></tr>
            <tr><th>{t('photoInfo.exposureMode')}</th><td>{v('exposure_mode')}</td></tr>
            <tr><th>{t('photoInfo.whiteBalanceMode')}</th><td>{v('white_balance_mode')}</td></tr>
            <tr><th>{t('photoInfo.orientation')}</th><td>{v('orientation')}</td></tr>
        </>
    );
}

/** The container properties a video has instead of EXIF. */
function VideoInfoRows({ exif, video, t }) {
    return (
        <>
            <tr><th>{t('photoInfo.dateTime')}</th><td>{exif ? exif.date_time : ""}</td></tr>
            <tr><th>{t('photoInfo.model')}</th><td>{exif ? exif.model : ""}</td></tr>
            <tr><th>{t('photoInfo.resolution')}</th><td>{`${video.width} × ${video.height}`}</td></tr>
            <tr><th>{t('photoInfo.duration')}</th><td>{formatDuration(video.duration_sec)}</td></tr>
            <tr><th>{t('photoInfo.frameRate')}</th><td>{formatFrameRate(video.fps)}</td></tr>
            <tr><th>{t('photoInfo.videoCodec')}</th><td>{video.video_codec}</td></tr>
        </>
    );
}
```

- [ ] **Step 4: テーブルで切り替える**

`PhotoInfo.jsx:243-259`（`{t('photoInfo.iso')}` の行から `{t('photoInfo.orientation')}` の行まで）を以下の 1 ブロックに置き換える:

```javascript
                        {photoInfo.video
                            ? <VideoInfoRows exif={photoInfo.exif} video={photoInfo.video} t={t} />
                            : <PhotoExifRows exif={photoInfo.exif} t={t} />}
```

`{t('photoInfo.googlePhotosUrl')}` の行はこのブロックの後ろに残し、写真でも動画でも出す。

- [ ] **Step 5: lint とテストを走らせる**

Run: `pnpm lint 2>&1 | tail -20`
Expected: 新しい error が出ないこと（ハードコード CSS 検出を含む。今回 CSS は追加していないので引っかからないはず）

Run: `pnpm test 2>&1 | tail -20`
Expected: 既存のテストがすべて passed

- [ ] **Step 6: 実際のアプリで確認**

Run: `pnpm tauri dev`

確認すること:

1. `/mnt/picture/00 pictures/2026-06-29/caa83a09-5960-46f1-90f1-6bc0769eb42f/DJI_20260629133004_0254_D.MP4` を開いて info タブを見る
   - 撮影日時 `2026-06-29 13:30:05`（`2026-07-01 08:12:16` ではない）
   - 機種 `DJI OsmoAction6`
   - 解像度 `1920 × 1080`
   - 長さ `0:11`
   - フレームレート `29.97 fps`
   - 映像コーデック `hevc`
   - ISO・絞り値・シャッター速度・レンズ・焦点距離などの行が出ていないこと
2. 同じディレクトリの JPEG を開いて info タブを見る
   - 従来どおり ISO・絞り値などが出ること
   - 解像度・長さ・フレームレート・映像コーデックの行が出ていないこと
3. LogViewer にエラーが出ていないこと

- [ ] **Step 7: DB が直ったことを確認**

Step 6 で info タブを開いたことで `update_exif_if_changed` が走っているはず。

まず DB の場所を特定する（NAS 上にあるので `find ~` では見つからない）:

Run: `find /mnt/picture ~ -maxdepth 4 -name "photoclove.db" 2>/dev/null | head`

見つかったパスを使って:

```bash
sqlite3 "<見つかったパス>" \
  "SELECT exif_date_time, exif_date_time_original, exif_model
     FROM photo_metadata
    WHERE path LIKE '%DJI_20260629133004_0254_D.MP4';"
```

Expected: `2026-06-29 13:30:05|2026-06-29 13:30:05|DJI OsmoAction6`

LogViewer で `exif_sync_update` を検索し、`fields_updated=exif_date_time,exif_date_time_original,exif_model` を含む行が出ていることも確認する。

- [ ] **Step 8: コミット**

```bash
git add src/App/PhotosList/PhotoOption/PhotoInfo.jsx \
        src/i18n/locales/ja/common.json src/i18n/locales/en/common.json
git commit -m "feat: info タブに動画の解像度と長さとコーデックを表示する"
```

---

## Self-Review

**仕様カバレッジ:**

| 仕様の節 | 対応タスク |
|---|---|
| 1. `utils/video_probe.rs` 新規（`video_codec` / `encoder` 追加、`parse_probe_json` 分離、`FFMPEG_POLL_INTERVAL` 相当の定数） | Task 1 |
| 1. `video_edit_service/probe.rs` を再エクスポートに、`merge_args.rs` テストヘルパ更新 | Task 1 Step 5-6 |
| 2. `exif_parser.rs` の動画分岐差し替え、`DateTime` / `DateTimeOriginal` / `Model` の生成、失敗時は空 | Task 2 |
| 3. `PhotoInfoResponse.video` と `VideoInfo` | Task 3 |
| 4. `PhotoInfo.jsx` の行切り替え、書式、i18n | Task 4 |
| テスト（`parse_probe_json` / `entries_from_probe`） | Task 1 Step 1、Task 2 Step 1 |
| 手動確認（対象 DJI ファイル / 写真 / 壊れたファイル） | Task 4 Step 6 |

**スコープ外（仕様どおり手をつけない）:** GPS、動画サムネイル生成・再生、`xresolution` / `yresolution` への画素数書き込み。

**型の一貫性:** `VideoProbe` のフィールド名は Task 1 の定義（`width` / `height` / `fps` / `has_audio` / `duration_sec` / `creation_time` / `video_codec` / `encoder`）を Task 2・Task 3 でそのまま使用。Rust 側 `VideoInfo` の `video_codec` / `duration_sec` は serde のデフォルト（rename なし）でそのまま JSON キーになり、Task 4 の JSX が同名で読む。

**層の向き:** `utils` は `domain_service` を参照しない。`utils/video_probe.rs`（Task 1）を `domain_service/video_edit_service/probe.rs` が使う向きだけがあり、逆は無い。Task 2 の `local_datetime_from_utc` が `normalize_creation_time` を借りずに自前で RFC 3339 をパースするのはこのため。

**ffprobe 非依存:** Task 1・Task 2 のテストはすべてフィクスチャと構造体リテラルで、ffprobe を起動しない。Task 1 Step 7 に残る `recorded_at_falls_back_to_the_modification_time` はテキストファイルを渡すので ffprobe の有無に依らない。
