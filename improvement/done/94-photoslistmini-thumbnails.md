# Improvement #94: Use on-demand thumbnails for import mode in PhotosListMini thumbnail list

## 問題

PhotosListMini（フルスクリーン表示）の下部サムネイル一覧で、import modeの写真がオリジナルファイルを読み込んでいる。

### 現状の実装

`src/App/PhotosList/PhotosListMini.jsx` line 587-596:

```javascript
if (!photosListImgSrc[v.originalPath]) {
    if (v.hasThumbnail) {
        const thumbnailSrc = v.thumbnailPath();
        photosListImgSrc[v.originalPath] = convertFileSrc(thumbnailSrc);
    } else {
        // Use Photo entity display path method for fallback
        const displayPath = v.displayPath();
        photosListImgSrc[v.originalPath] = convertFileSrc(displayPath);
    }
}
```

### 問題点

1. **import_sourceの写真は`hasThumbnail=false`**: バックエンドでサムネイルが登録されていない
2. **サムネイルの場所が異なる**:
   - 通常モード: `config.thumbnail_store`ディレクトリ
   - Import mode: `~/.cache/photoclove/thumbnails/`キャッシュディレクトリ
3. **オンデマンド生成が必要**: import modeではサムネイルがまだ生成されていない可能性がある

結果、import modeの写真は`displayPath()`（オリジナルファイル）が使われ、大きなファイルを読み込んでしまう。

## 解決策

import modeの写真の場合、PhotoGrid.jsxと同じロジックを使用：

1. `get_thumbnail_path()`でキャッシュパスを取得
2. 初期表示でサムネイルキャッシュパスを設定（存在しなくても）
3. onErrorでオンデマンド生成 + リトライ
4. 失敗時はオリジナル → エラー画像のフォールバック

### 実装方針

#### Phase 1: 初期パス設定の変更

```javascript
if (!photosListImgSrc[v.originalPath]) {
    if (v.import_source === true) {
        // Import mode: キャッシュパスを取得（まだ生成されていなくてもOK）
        if (!v._cachedThumbnailPath) {
            invoke('get_thumbnail_path', { photoPath: v.originalPath })
                .then(cachePath => {
                    v._cachedThumbnailPath = convertFileSrc(cachePath);
                    // 既にレンダリングされている場合は更新
                    if (photosListImgSrc[v.originalPath] === "") {
                        photosListImgSrc[v.originalPath] = v._cachedThumbnailPath;
                        // 再レンダリングをトリガー
                        setPhotosListImgSrc({...photosListImgSrc});
                    }
                })
                .catch(err => {
                    logger.warn('PhotosListMini', 'thumbnail_path_failed', 'Failed to get thumbnail cache path', {
                        photoPath: v.originalPath,
                        error: err.message
                    });
                });
        }
        // 一旦空文字列を設定（onErrorで処理）
        photosListImgSrc[v.originalPath] = v._cachedThumbnailPath || "";
    } else if (v.hasThumbnail) {
        // 通常モード: 既存のサムネイル
        const thumbnailSrc = v.thumbnailPath();
        photosListImgSrc[v.originalPath] = convertFileSrc(thumbnailSrc);
    } else {
        // 通常モードでサムネイルなし: オリジナル
        const displayPath = v.displayPath();
        photosListImgSrc[v.originalPath] = convertFileSrc(displayPath);
    }
}
```

#### Phase 2: onErrorハンドラーの拡張

```javascript
onError={(e) => {
    // Already showing error image
    if (e.target.src.includes('/img_error.png')) {
        return;
    }

    // Import mode: on-demand thumbnail generation
    if (v.import_source === true) {
        // Step 1: Generate thumbnail
        if (!e.target.dataset.thumbnailGenerated) {
            e.target.dataset.thumbnailGenerated = 'true';
            const imgElement = e.target;
            
            invoke('get_resized_image', {
                pathStr: v.originalPath,
                maxSize: 200
            })
                .then(() => invoke('get_thumbnail_path', { photoPath: v.originalPath }))
                .then(cachePath => {
                    const thumbnailUrl = convertFileSrc(cachePath) + '?t=' + Date.now();
                    if (imgElement) {
                        imgElement.src = thumbnailUrl;
                    }
                })
                .catch(err => {
                    logger.error('PhotosListMini', 'thumbnail_generation_failed', 'Failed to generate thumbnail', {
                        photoPath: v.originalPath,
                        error: err.message
                    });
                    // Fallback to original
                    if (imgElement && !imgElement.dataset.triedOriginal) {
                        imgElement.dataset.triedOriginal = 'true';
                        imgElement.src = convertFileSrc(v.originalPath);
                    }
                });
            return;
        }

        // Step 2: Thumbnail generation failed, try original
        if (!e.target.dataset.triedOriginal) {
            e.target.dataset.triedOriginal = 'true';
            e.target.src = convertFileSrc(v.originalPath);
            return;
        }

        // Step 3: Final fallback
        e.target.src = "/img_error.png";
        return;
    }

    // Normal mode: existing logic
    if (v.hasThumbnail && !e.target.dataset.triedOriginal) {
        e.target.dataset.triedOriginal = "true";
        const originalSrc = convertFileSrc(v.displayPath());
        e.target.src = originalSrc;
    } else {
        e.target.src = "/img_error.png";
    }
}}
```

### 変更ファイル

- `src/App/PhotosList/PhotosListMini.jsx`: サムネイル一覧のロジック (line 587-636)

### 期待される効果

- Import modeのサムネイル一覧でキャッシュされたサムネイルを使用
- オンデマンドでサムネイル生成
- メモリ使用量と読み込み時間の削減
- PhotoGridと一貫した動作

### テスト項目

1. Import modeでフルスクリーン表示を開く
2. 下部サムネイル一覧でキャッシュされたサムネイルが表示される
3. サムネイルがない場合、onErrorで生成される
4. 左右矢印キーで写真を切り替え、サムネイル一覧が更新される
5. 通常モード・trash modeで既存の動作が維持される
