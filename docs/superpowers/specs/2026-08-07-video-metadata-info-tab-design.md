# 動画のメタ情報を info タブに表示する

> **【破棄】この設計は実装されなかった。** 調査の途中で、同じ機能が既に PR #12
> `feat/video-metadata-extraction`（main に 2026-08-06 マージ、`a4963323`）で
> 実装済みであることが判明したため。上流は `src-tauri/src/utils/ffprobe.rs` と
> `src-tauri/src/value/video_metadata.rs` を使い、`PhotoInfo.jsx` と i18n も対応
> 済み（GPS 付き）。上流の設計は
> `docs/superpowers/specs/2026-07-12-video-metadata-extraction-design.md` を参照。
>
> この文書から実際に反映されたのは 1 点だけ: 上流が `model` /
> `com.apple.quicktime.model` しか見ておらず、DJI が機種名を書く `encoder` タグを
> 読まないという穴。`fe9a7eb4` で修正した。以下は調査の記録として残す。

## 背景

info タブを動画で開くと、ISO・機種・撮影日時などがすべて空欄になる。

原因は `src-tauri/src/utils/exif_parser.rs:52-59`。動画拡張子のファイルは EXIF パースを一切せず空の結果を返して即 return している。

```rust
if raw_file::is_video_file(path) {
    return Ok(ExifParseResult { entries: Vec::new() });
}
```

これは 2026-07-02 のコミット `5366abeb` で、rexif が数 GB の動画を丸ごとメモリに読み込んでアプリがハングする問題を防ぐために意図的に入れられたもの。動画コンテナに JPEG/TIFF EXIF が無いのは事実なので、この早期 return 自体は正しい。足りないのは「動画には動画のメタデータ取得手段がある」という分岐。

### 派生している不具合

EXIF が空になると `src-tauri/src/value/exif.rs:147-150` のフォールバックで `file.created_datetime()`（Unix では inode の `ctime`）が撮影日時として使われる。

対象ファイル `DJI_20260629133004_0254_D.MP4` の実測値:

| 項目 | 値 |
|---|---|
| コンテナの `creation_time`（本来の撮影日時） | `2026-06-29T04:30:05Z` = **2026-06-29 13:30:05 JST** |
| `ctime`（ライブラリへコピーした時刻） | `2026-07-01 08:12:16` |

ファイル名の `133004` が示すとおり 13:30 撮影だが、info タブには 7/1 8:12 が出る。さらにこの値は `photo_commands.rs:284` の `update_exif_if_changed` で DB の `exif_date_time` に書き戻され、一覧のソート（`photo_metadata.rs:349` の `COALESCE(exif_date_time_original, exif_date_time, photo_date)`）と日付範囲検索（`search.rs:48,59`）にも波及している。

### ffprobe で取得できるもの（実測）

```text
format.tags.encoder        "DJI OsmoAction6"
format.tags.creation_time  "2026-06-29T04:30:05.000000Z"
format.duration            "11.968000"
stream[0].codec_name       "hevc"
stream[0].width/height     1920 / 1080
stream[0].r_frame_rate     "30000/1001"
```

`probe_video`（`domain_service/video_edit_service/probe.rs:25`）が既にこの大半を読んでいるが、動画結合エディタの並べ替え専用で `get_photo_info` からは呼ばれていない。

## 方針

`utils/exif_parser.rs` の「動画は空を返す」分岐を「動画は ffprobe で読む」に置き換える。`ExifData::new` の呼び出し元 4 箇所（info タブ / インポート / DB 再構築 / `move_photos_to_exif_date`）がすべて一度に直り、DB カラムもマイグレーションも増えない。

解像度・長さ・fps・コーデックは EXIF の語彙に無いので、info タブ専用の別フィールドとしてレスポンスに載せる（DB には保存しない）。

## 変更

### 1. `src-tauri/src/utils/video_probe.rs`（新規）

`domain_service/video_edit_service/probe.rs` から `VideoProbe` / `probe_video` / `parse_frame_rate` を移動する。`probe_video` は ffprobe を叩いて JSON を読むだけでドメイン方針を持たないため、`utils` が正しい置き場所。この移動により `utils/exif_parser.rs` が層を逆転させずに使える。

`VideoProbe` に 2 フィールド追加:

```rust
pub video_codec: Option<String>,  // stream[video].codec_name
pub encoder: Option<String>,      // format.tags.encoder
```

ffprobe 引数に `codec_name` と `format_tags=encoder` を追加する。既存フィールドの意味は変えないので `merge.rs` / `merge_args.rs` の本体は無変更（`merge_args.rs:204` のテストヘルパ `probe()` だけ新フィールドを埋める）。

`probe_video` はポーリング間隔に `video_edit_service/mod.rs` の `FFMPEG_POLL_INTERVAL` を使っているので、移動先に同等の定数を持たせる。

テスト容易性のため、プロセス起動と JSON 解釈を分ける:

```rust
pub fn probe_video(path: &str) -> Result<VideoProbe, String>   // ffprobe を起動して parse_probe_json に渡す
fn parse_probe_json(stdout: &[u8], path: &str) -> Result<VideoProbe, String>  // 純粋関数
```

`video_edit_service/probe.rs` には `recorded_at` と `normalize_creation_time` が残り、先頭で

```rust
pub use crate::utils::video_probe::{probe_video, VideoProbe};
```

と再エクスポートする。これで `merge.rs` の `use super::probe::probe_video` と `merge_args.rs` の `use super::probe::VideoProbe` はそのまま通り、`video_edit_service/mod.rs` の `pub use probe::recorded_at` も変更なし。

### 2. `src-tauri/src/utils/exif_parser.rs`

動画の早期 return を差し替える:

```rust
if raw_file::is_video_file(path) {
    return Ok(ExifParseResult { entries: video_entries(path) });
}
```

```rust
/// 動画コンテナから EXIF 相当の情報を取り出す。
/// ffprobe が失敗した場合やタグが無い場合は空を返し、
/// 呼び出し元のファイル作成時刻フォールバックに委ねる。
fn video_entries(path: &str) -> Vec<ExifEntry> {
    match video_probe::probe_video(path) {
        Ok(probe) => entries_from_probe(&probe),
        Err(e) => { log::warn!(...); Vec::new() }
    }
}

/// 純粋関数。プローブ結果を ExifEntry に写す。
fn entries_from_probe(probe: &VideoProbe) -> Vec<ExifEntry>
```

生成するエントリ:

| タグ | 値 | 元 |
|---|---|---|
| `DateTime` | `2026-06-29 13:30:05` | `creation_time` をローカルタイムゾーンに変換 |
| `DateTimeOriginal` | 同上 | 同上 |
| `Model` | `DJI OsmoAction6` | `encoder` タグ |

`DateTimeOriginal` も入れるのは、一覧ソートの `COALESCE(exif_date_time_original, exif_date_time, photo_date)` が第一優先で見る列だから。片方だけだと DB 上で NULL のままになりソート順が直らない。

`creation_time` が無い、または RFC 3339 として解釈できない場合は日時エントリを出さない（`Model` だけ出す）。既存の `normalize_creation_time` と同じ判定を使う。

変換は `chrono::DateTime::parse_from_rfc3339` → `with_timezone(&Local)` → `format("%Y-%m-%d %H:%M:%S")`。写真の EXIF 日時と同じ書式なので `value/exif.rs` のコロン→ハイフン変換をそのまま通過し、`date::DateTime::are_equal` の比較にも乗る。

**既知の制約**: 一部のカメラはローカル時刻を UTC として書き込む（MP4 の既知の癖）。その場合タイムゾーン分ずれる。DJI は真の UTC を書いている（`creation_time` の 04:30:05Z がファイル名の `133004` と JST で一致）ことを実測で確認済みのため、標準解釈のまま実装し、ヒューリスティックは入れない。

### 3. `src-tauri/src/commands/photo_commands.rs`

`PhotoInfoResponse` に追加:

```rust
video: Option<VideoInfo>,
```

```rust
#[derive(Serialize)]
struct VideoInfo {
    width: u32,
    height: u32,
    fps: f64,
    duration_sec: f64,
    video_codec: String,
}
```

`photo_info_blocking` で `raw_file::is_video_file(&actual_path)` のとき `probe_video` を呼んで詰める。失敗時は `None`（写真と同じ表示になるだけで、他は壊れない）。

info タブを開くと ffprobe が 2 回起動する（`ExifData::new` 内で 1 回、`VideoInfo` 用に 1 回）。ffprobe はヘッダしか読まないので 1 ファイルあたり数十 ms、単一ファイルの操作でしか起きないため、プローブ結果を `ExifData::new` から引き回す複雑さに見合わないと判断して許容する。

### 4. `src/App/PhotosList/PhotoOption/PhotoInfo.jsx`

`photoInfo.video` の有無でテーブル行を切り替える。行のかたまりを同一ファイル内のローカルコンポーネント `PhotoExifRows` / `VideoInfoRows` に切り出す（新規ファイルは作らない。現状 315 行 → 約 380 行）。

動画のときの行:

| 行 | i18n キー | 値の例 |
|---|---|---|
| ファイル名 | `fileName` | （共通） |
| ファイルサイズ | `fileSize` | （共通） |
| 撮影日時 | `dateTime` | 2026-06-29 13:30:05 |
| 機種 | `model` | DJI OsmoAction6 |
| 解像度 | `resolution` (新規) | 1920 × 1080 |
| 長さ | `duration` (新規) | 0:11 |
| フレームレート | `frameRate` (新規) | 29.97 fps |
| 映像コーデック | `videoCodec` (新規) | hevc |
| Google フォト URL | `googlePhotosUrl` | （共通） |

写真専用の行（ISO / 絞り値 / シャッター速度 / レンズ / レンズメーカー / メーカー / 焦点距離 / デジタルズーム倍率 / 露出 / ホワイトバランス / 向き）は動画では描画しない。

書式:
- 解像度 `${width} × ${height}`
- 長さ: 1 時間未満は `M:SS`、以上は `H:MM:SS`
- フレームレート: 小数第 2 位まで、末尾ゼロは落とす（`29.97 fps` / `30 fps`）

新規 i18n キー `photoInfo.resolution` / `duration` / `frameRate` / `videoCodec` を追加する。`photoInfo` セクションを持つのは `ja` と `en` の `common.json` だけで、他の 5 言語（de / es / fr / zh-CN / zh-TW）は `src/i18n/index.js:150` の `fallbackLng: 'en'` で英語にフォールバックしている。既存の慣習に合わせて ja と en の 2 ファイルのみ更新する。

スタイルは既存の `styles['photo-info-table']` をそのまま使い、CSS は追加しない。

## テスト

Rust 単体テスト（ffprobe の実行に依存しない純粋関数を対象にする）:

- `utils/video_probe.rs::parse_probe_json`
  - 実測 JSON のフィクスチャから `codec_name` / `encoder` / 解像度 / fps / duration を読めること
  - 映像ストリームが複数ある場合（DJI は index 0 が hevc、index 5 に mjpeg サムネイルがある）先頭の映像ストリームを採ること
  - `encoder` タグが無いコンテナで `None` になること
- `utils/exif_parser.rs::entries_from_probe`
  - `DateTime` / `DateTimeOriginal` / `Model` の 3 エントリが出ること
  - UTC → ローカルで日付が跨ぐケース（`2026-06-29T20:00:00Z` → JST で 6/30）
  - `creation_time` が `None` または解釈不能なとき日時エントリを出さないこと
  - `encoder` が `None` のとき `Model` を出さないこと

既存の `probe.rs` のテスト（`parse_frame_rate` / `normalize_creation_time` / `recorded_at` フォールバック）は移動先に合わせて振り分ける。

手動確認:

- `/mnt/picture/00 pictures/2026-06-29/caa83a09-5960-46f1-90f1-6bc0769eb42f/DJI_20260629133004_0254_D.MP4` の info タブに撮影日時 `2026-06-29 13:30:05`、機種 `DJI OsmoAction6`、1920 × 1080、0:11、29.97 fps、hevc が出ること
- 写真の info タブが従来どおりであること
- ffprobe が失敗するファイル（拡張子だけ `.mp4` の壊れたファイル）で info タブが落ちないこと

## スコープ外

- GPS 情報。DJI は `CAM meta` データストリームに独自形式で持っており、汎用の取り出し手段が無い。
- 動画のサムネイル生成・再生まわり。今回は触らない。
- `xresolution` / `yresolution` カラムへの画素数の書き込み。これらは写真の DPI を意味する列で、意味が変わってしまう。
