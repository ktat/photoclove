# Current Implementation Analysis

## Importer.jsx Features to Preserve

### Key Features:
1. **Directory Navigation**: 左側のディレクトリツリーでフォルダ移動
2. **File Filtering**: 日付フィルター (`importerFilter`)
3. **Selection System**: 複数写真選択とプレビュー
4. **Infinite Scroll**: スクロールベースのページング
5. **Batch Operations**: Select All, Select All in Page, Unselect All
6. **Import Progress**: リアルタイム進行状況表示

## Backend APIs (ほぼそのまま使用可能)

### `show_importer` API ✅
```rust
fn show_importer(
    path_str: Option<&str>,     // ディレクトリパス
    date_str: Option<&str>,     // 日付フィルター
    page: usize,                // ページ番号 
    num: usize,                 // 1ページの件数
) -> String                     // JSON: Importer構造体
```

**戻り値構造 (PhotosListと高い互換性):**
```rust
Importer {
    dirs_files: DirsFiles {
        dir: Dir,                    // 現在のディレクトリ
        files: Files { files: Vec<File> }, // ← PhotosListで使用可能！
        dirs: Dirs { dirs: Vec<Dir> },     // サブディレクトリ
        has_next_file: bool,         // ← ページネーション対応！
        has_prev_file: bool,
    },
    page: usize,                 // ← 現在ページ
    paths: Vec<String>,          // インポート元パス一覧
}

File {
    path: String,        // ← PhotosListで使用中
    name: String,
    created_at: String,  // ← PhotosListで使用中  
    // ...
}
```

### `get_photos_to_import_under_directory`: 全件取得API ✅

## Import Progress 問題 🚨

### 現状の問題:
1. **二重のProgress System**: JobQueueベースと古いImportProgressが共存
2. **フロントエンドが古いAPI使用**: `get_import_progress` (JobQueueと連動していない)
3. **Progress Eventの不一致**: JobQueueは `import_progress` eventを emit、フロントエンドは polling

### 修正が必要:
```javascript
// 現在: polling ベース (古い)
invoke("get_import_progress").then((r) => {
    let data = JSON.parse(r);
    props.setImportProgress(data);
});

// 修正後: event listener ベース
useEffect(() => {
  const unlisten = listen("import_progress", (event) => {
    const [jobUnitId, currentFile, progress] = event.payload;
    setImportProgress({
      now_importing: progress < 100,
      progress: Math.round(progress),
      current_file: currentFile,
      job_unit_id: jobUnitId
    });
  });
  return () => unlisten();
}, []);
```