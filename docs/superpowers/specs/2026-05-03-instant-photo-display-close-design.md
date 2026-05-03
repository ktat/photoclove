# Instant Return From PhotoDisplay (Phase 2)

**Date:** 2026-05-03
**Status:** Design (approved scope, awaiting implementation plan; depends on Phase 1)
**Depends on:** [2026-05-03-photos-state-unification-design.md](./2026-05-03-photos-state-unification-design.md)

## 背景と動機

個別写真表示 (`PhotoDisplay`) から写真一覧 (`PhotosList`) に戻る時、現状は無条件でバックエンドから photos を再取得して "Loading your photos..." 画面を表示する (`src/hooks/usePhotoDisplay.js:108-111`, `src/hooks/usePhotoListLoading.js:67-75`)。

```js
// closePhotoDisplay (現状)
const fetchPhotos = async () => refreshPhotos();
fetchPhotos().catch(error => handleError(error, 'Refresh photos after closing display'));
```

`refreshPhotosOnly` は `setPhotoLoading(true)` → 最低 500ms 強制待機 → バックエンド再取得 → `setPhotoLoading(false)` を行う。`photoLoading=true` の間 `PhotosList.jsx:538` で `<PhotoLoading>` (= "Loading your photos...") が表示される。

SPA であり、写真一覧 state は PhotoDisplay 中も保持されているため、編集を in-memory のリスト操作で完結させれば close 時に瞬時復帰できる。

## ゴール

PhotoDisplay 内のすべての編集経路を **`allPhotosForCurrentFetch` への in-memory 更新のみ** で完結させ、`closePhotoDisplay` のバックエンド再取得を完全廃止する。close 時は瞬時に grid に戻る。

## Non-goals

- 各 view mode の photos source の統一 (Phase 1 で完了している前提)
- バックエンドの API 変更 (Save as Copy 用のメタデータ取得は既存 API で足りる前提、足りなければ最小追加)
- 並行リフレッシュ (background refetch) の導入 — 不要

## 前提

Phase 1 (state 統一) 完了済。`allPhotosForCurrentFetch` が全 view mode の grid 入力。`useFilteredPhotos` の source 分岐は削除済み。

## 設計

### 1. 同期抑制 (核心)

`src/hooks/usePhotoDataSync.js` の `useFilteredPhotosSync` を `currentPhoto != null` の間だけ凍結する:

```js
const currentPhotoPath = currentPhoto?.originalPath;  // stable string で比較

useEffect(() => {
    if (currentPhotoPath) return; // PhotoDisplay 中は凍結
    if (filteredPhotos.length > 0 || allPhotosForCurrentFetch.length > 0) {
        const photosAsJSON = filteredPhotos
            .filter(photo => photo && typeof photo.toJSON === 'function')
            .map(photo => photo.toJSON());
        setPhotosListMiniAllPhotos(photosAsJSON);
        // displayedPhotoCount はリセットしない (PhotoDisplay 開く前の scroll 位置を保持)
        // 配列長変化があった場合は編集ヘルパー内で displayedPhotoCount も調整される
    }
}, [filteredPhotos, allPhotosForCurrentFetch, infiniteScrollEnabled, currentPhotoPath]);
```

**deps の注意**:
- `currentPhoto` 自体は entity object なので参照 identity が頻繁に変わる → `currentPhoto?.originalPath` (string) で比較
- `infiniteScrollEnabled` は deps に残す (設定 toggle 時の同期に必要)

`displayedPhotoCount` は `infiniteScrollEnabled` 時に「現在表示している photos の数」(深スクロールで増えた値) を保持する。PhotoDisplay 開く前の値を保ち、編集による配列長変化があれば編集ヘルパー内で調整する:
- 削除 (-N): `setDisplayedPhotoCount(prev => Math.max(50, Math.min(prev - removedBeforeCount, newLength)))`
- Save as Copy (+1): 挿入位置が `displayedPhotoCount` 範囲内なら `setDisplayedPhotoCount(prev => prev + 1)`

**理由**:
- 編集で `allPhotosForCurrentFetch` を即時更新すると `useFilteredPhotos` (useMemo) が再計算しフィルタから除外されることがある
- これが PhotoDisplay 中に `photosListMiniAllPhotos` (= 前後 navigation 配列) に反映されると **navigation の index がズレる**
- 凍結することで PhotoDisplay 中はスナップショット保持
- close (`currentPhoto = null`) で effect が走り、最新の filter/sort 結果が反映される

凍結方針の整理:
- 「凍結」= `useFilteredPhotosSync` effect 経由の自動同期を停止
- 削除操作 (`handlePhotoRemovalNavigation`) は **直接 `setPhotosListMiniAllPhotos` を呼ぶ** ことで凍結中も即座に反映 (既存挙動維持)。これは矛盾ではなく **「凍結=自動同期の停止、直接書き換えは編集経路の権利」** という整理

### 2. sortDirty フラグ

`usePhotosState` に追加:

```js
const [sortDirty, setSortDirty] = useState(false);
```

通常モードのソートはバックエンド適用済みで、編集後も `allPhotosForCurrentFetch` の **順序は変わらない**。ただし sort=★ で ★ が変わるとソート順がズレる。

- `setStarWithUpdate` 内で「`sortOfPhotos` が STAR 系ならば `setSortDirty(true)`」
- `closePhotoDisplay` 内で「`sortDirty` ならば `allPhotosForCurrentFetch` をローカル再ソート → `setSortDirty(false)`」

ローカル再ソート関数は **`src/utils/PhotoSort.js` (新規)** に切り出す。`getPhotoSortComparator(sortValue): (a, b) => number` を export し、既存の `useFilteredPhotos.js:108-132` の import mode 専用 `getImportSortComparator` もここに統合する。Save as Copy の挿入位置計算でも同じ comparator を再利用 (二分探索)。

バックエンドの sort logic (DB クエリ) との仕様一致は、本ファイル冒頭にコメントで基準を明記しテストで担保する。

`filterDirty` フラグは **不要** (`useFilteredPhotos` がリアクティブに常に最新計算済み、close 時の同期 effect で自動反映される)。

### 3. 編集ヘルパー

Phase 1 完了後、編集ヘルパーは `allPhotosForCurrentFetch` を更新すれば `useFilteredPhotos` が再計算する。ただし PhotoDisplay 中は同期 effect が凍結されるので、**`photosListMiniAllPhotos` (= 前後 navigation 配列, thumb strip 表示) も同時に直接更新** する必要がある (現状の `setStarWithUpdate` と同じパターン)。

操作タイプによって配列長と navigation index の扱いが異なる:

| 操作 | ヘルパー | 配列長 | navigation index | 操作 |
|---|---|---|---|---|
| ★ 変更 | `setStarWithUpdate(newStar)` (+sort=STAR時 `setSortDirty(true)`) | 不変 | 不変 | 両配列を `map` で patch |
| コメント | `updatePhotoComment(path, hasComment)` | 不変 | 不変 | 両配列を `map` で patch |
| タグ追加/削除 | `updatePhotoTags(path, tagsArray)` (新規) | 不変 | 不変 | 両配列を `map` で patch |
| アルバム add/remove | `updatePhotoAlbums(path, albumIds)` (新規) | 不変 | 不変 | 両配列を `map` で patch |
| cssStyle 適用 | `updatePhotoCssStyle(path, css)` (新規) | 不変 | 不変 | 両配列を `map` で patch |
| Trash/Delete (単一) | `handlePhotoRemovalNavigation(index, path)` (既存) | **-1** | **再計算が必要** | 両配列を `splice` + index 調整 (既存実装) |
| Trash/Delete (一括) | `handlePhotoRemovalNavigationBulk(paths[])` (新規 or 既存 `deletePhotos` 拡張) | **-N** | **再計算が必要** | 両配列を `filter` + index 調整 |
| Save as Copy | `addPhotoToList(newPhotoData, sortCriterion)` (新規) | **+1** | **挿入位置次第で +1** (`i ≤ currentPhotoIndex` なら +1) | 現在の sort 基準で正しい位置 `i` を計算し両配列に `splice` 挿入。`currentPhoto` entity は元写真のまま |

#### 3.1 削除の挙動

##### 3.1.1 単一削除 (`handlePhotoRemovalNavigation`) — 既存

`src/hooks/usePhotoOperations.js:80-132` で既に実装済:
- `setPhotosListMiniAllPhotos` を `splice(index, 1)` で更新
- `setAllPhotosForCurrentFetch` も対応 photo を filter
- navigation index 再計算:
  - 削除されたのが末尾 → 直前へ
  - それ以外 → 同じ index に留まる (= 次の photo に自動遷移)
  - 配列が空 → `closePhotoDisplay()`

##### 3.1.2 一括削除 (`handlePhotoRemovalNavigationBulk`) — 新規

既存の `useTrashOperations.deletePhotos` (`src/hooks/useTrashOperations.js:54-`) は `allPhotosForCurrentFetch` のみ更新し `photosListMiniAllPhotos` 更新と navigation 調整を行わない。PhotoDisplay 中に Selection tab 等から bulk delete が発火する経路に対応するため、navigation 調整を含む helper を新設 (or 既存 `deletePhotos` を拡張):

1. 両配列を `filter(p => !paths.includes(p.originalPath))` で更新 (`allPhotosForCurrentFetch`, `photosListMiniAllPhotos`)
2. View Cache の現在の viewKey も同 filter
3. **navigation index 調整**:
   - **current photo が `paths` に含まれる**: `paths` 中の最小 index を `minRemovedIndex` として、単一削除と同等のロジックで次の残った photo へ移動 (末尾なら直前、それ以外なら同 index)
   - **含まれない**: `currentPhotoIndex` より前にある削除数を引く
     ```
     newCurrentIndex = currentPhotoIndex - count(p ∈ paths : p.index < currentPhotoIndex)
     ```
   - **全削除 (空配列)**: `closePhotoDisplay()`
4. `setCurrentPhoto(newPhotoEntity)` / `setCurrentPhotoIndex(newIndex)` / `setPhotosListMiniCurrentIndex(newIndex)`

既存の `deletePhotos` のロールバック処理 (失敗時 backup から復元) は両配列 + navigation index についても行う必要がある。

#### 3.1.3 bulk delete の効率改善

spec の式 `newCurrentIndex = currentPhotoIndex - count(p ∈ paths : p.index < currentPhotoIndex)` を素朴に実装すると O(N×M) になるため、`Set` 化して O(N+M) で実装:

```js
const pathSet = new Set(paths);
const indicesToRemove = [];
let removedBeforeCount = 0;
for (let i = 0; i < photosListMiniAllPhotos.length; i++) {
    if (pathSet.has(photosListMiniAllPhotos[i].originalPath)) {
        indicesToRemove.push(i);
        if (i < currentPhotoIndex) removedBeforeCount++;
    }
}
const newCurrentIndex = currentPhotoIndex - removedBeforeCount;
```

ロールバックも考慮: 既存 `useTrashOperations.deletePhotos` の `photosBackup` に加え、`miniPhotosBackup`、`navigationIndexBackup` (currentPhotoIndex/photosListMiniCurrentIndex) を保持し失敗時に復元。

#### 3.2 Save as Copy (`addPhotoToList`) の挙動 (新規)

##### バックエンド返り値の拡張 (必須)

現状 `save_styled_copy_from_frontend` (`src-tauri/src/commands/style_commands.rs`) は `newPhotoPath: String` のみ返す。フロントで `Photo.fromJSON()` を完全構築するため、**JSON object 形式に変更**:

```rust
// 戻り値を JSON object に変更
Ok(json!({
    "newPhotoPath": new_rel_path_str,
    "createdAt": creation_timestamp,  // 新規作成時刻 (ISO8601)
    "hasThumbnail": false,             // async 生成中
    "metaData": null,                  // 新規 JPEG なので EXIF なし
    "star": original_meta.star.star(), // 元写真からコピー済
    "comment": original_meta.comment.comment(), // 元写真からコピー済
    "tags": [],                        // 新写真は空
    "burst_group_id": null,
    "burst_count": null
}).to_string())
```

##### フロント処理

- バックエンドから返った JSON object を使い `Photo.fromJSON({...}).toJSON()` で構築
- 現在の sort 基準 (`sortOfPhotos`) に対する **comparator** で挿入位置 `i` を決定 (二分探索)
- 両配列 (`allPhotosForCurrentFetch`, `photosListMiniAllPhotos`) に index `i` で `splice` 挿入
- View Cache の現在の viewKey にも同 index で挿入
- **navigation index 調整**: `i <= currentPhotoIndex` ならば `setCurrentPhotoIndex(prev => prev + 1)` / `setPhotosListMiniCurrentIndex(prev => prev + 1)`
- `currentPhoto` entity 自体は元写真のまま (Photo の実体は不変)

##### sortDirty との相互作用

`sortDirty` 状態 (= ★変更で並びがズレている) で Save as Copy を呼ぶと、二分探索が壊れた配列に対して実行される問題がある。

**対策**: Save as Copy ヘルパー内で `sortDirty` チェック → true ならば **先に `applyLocalSort()` を実行** → `setSortDirty(false)` → その後挿入位置計算。これで挿入位置が常に正しい。

```js
const addPhotoToList = (newPhotoData, sortCriterion) => {
    if (sortDirty) {
        applyLocalSort();
        setSortDirty(false);
    }
    const i = binarySearch(allPhotosForCurrentFetch, newPhotoData, comparator);
    // ...両配列 + cache + navigation index 更新
};
```

##### 責務分割 (テスト容易性)

`addPhotoToList` を内部的に分割:
- `calculateInsertPosition(photo, sortCriterion): number` — pure function
- `insertPhotoAt(index, newPhotoJSON): void` — 両配列 + cache 更新
- `updateNavigationIndexAfterInsert(index): void` — navigation 調整

これにより sort 順での position が常に正しくなり、close 後も再ソート不要。

#### 3.3 View Cache 同期

各ヘルパーは `allPhotosForCurrentFetch` と `photosListMiniAllPhotos` に加え、Phase 1 で導入する **View Cache の現在の viewKey エントリ** も同じ更新を行う (cache が stale にならないよう)。

### 4. closePhotoDisplay 改訂

`src/hooks/usePhotoDisplay.js`:

```js
const closePhotoDisplay = useCallback(() => {
    setShowSideMenu(false);
    setCurrentPhoto(null);

    if (currentPhotoLoadingController) {
        currentPhotoLoadingController.abort();
        setCurrentPhotoLoadingController(null);
    }

    if (sortDirty) {
        // Local re-sort of allPhotosForCurrentFetch by current sort criterion
        applyLocalSort();
        setSortDirty(false);
    }

    // displayedPhotoCount は PhotoDisplay 開く前の値を保持するため、明示リセットしない
    // (配列長変化分は編集ヘルパー内で調整済 — 削除 -N、Save as Copy +1)
    // refreshPhotos() は呼ばない
}, [...]);
```

`useFilteredPhotosSync` の凍結が解除され、`filteredPhotos` の最新値が `photosListMiniAllPhotos` に反映される。

### 5. Save as Copy の特別扱い

PhotoDisplay 中の thumb strip (PhotosListMini) で新写真を見せたい場合があるため、`addPhotoToList` は **`allPhotosForCurrentFetch` に加えて `photosListMiniAllPhotos` にも明示的に追加** する。close 時の同期で再正規化される。

挿入位置:
- バックエンド `save_styled_copy_from_frontend` (`src-tauri/src/commands/style_commands.rs:79-`) は元写真と同じ親ディレクトリに新ファイルを作る (= **同じ日付グループ**)
- 元写真の **直後** に挿入する (sort 順での厳密な位置づけは close 時の sortDirty 経路で正規化)

新写真のメタデータ:
- バックエンドは `newPhotoPath` のみ返す
- フロント側で `Photo.fromJSON({ originalPath: newPhotoPath, name: ..., star: srcPhoto.star, comment: srcPhoto.comment, tags: [], cssStyle: cssStyle, ... }).toJSON()` を構築
- バックエンドは star/comment を元写真から複製済 (style_commands.rs:144-154)
- タグは元写真から複製されない (バックエンド仕様確認済) → 空配列で OK

### 5.5 PhotoTags の `onPhotosRefresh` 既存バグへの対応

`PhotoTags.jsx` は `onPhotosRefresh` プロップを受け取るが現状呼んでいない (タグ変更が grid に反映されない既存バグ)。本 Phase で対応する:

- `PhotoTags` に新プロップ `onTagsChanged(path, tagsArray)` を追加
- `addTagToPhoto` / `removeTagFromPhoto` 完了 callback で `onTagsChanged(currentPhotoPath, updatedTags)` を呼ぶ
- 親側で `onTagsChanged = updatePhotoTags` を渡す
- `onPhotosRefresh` プロップは削除 (本 Phase で完全置き換え)

### 6. タグ新規作成時のキャッシュ同期

`PhotoTags` 内で **新規タグ作成** が発生する場合 (`TagSelector.jsx:146`)、`unifiedCollectionService` のタグキャッシュも更新が必要 (これは既存の問題でもあるが、本 Phase で同時修正)。

**決定: `unifiedCollectionService.clearCache()` を呼ぶだけ** で済ませる。30秒 TTL のキャッシュなので次回 `getTags()` 時にバックエンドから再 fetch される。新規タグ作成は頻度の低い操作なので、個別追加メソッドを増やして他経路 (削除/rename) との整合性管理を複雑化させるより、シンプルに全クリアする方が安全。

実装: `PhotoTags` の新規タグ作成完了 callback で `unifiedCollectionService.clearCache()` を呼ぶ。

### 7. AlbumTab 関連の対応

- アルバム add/remove: `updatePhotoAlbums(path, albumIds)` で両配列内の該当 photo の `albumId` / `inAlbum` を更新
- アルバム削除 (`handleAlbumDelete`): **ローカル除去 + cache クリア** に変更 (backend 再 fetch をやめる)
  ```js
  const handleAlbumDelete = useCallback((deletedAlbumId) => {
      if (deletedAlbumId === currentAlbumId) {
          toggleAlbumListMode();
      }
      updateAlbumsList(prev => prev.filter(a => a.id !== deletedAlbumId));
      setFilteredAlbums(prev => prev.filter(a => a.id !== deletedAlbumId));
      unifiedCollectionService.clearCache();
  }, [...]);
  ```
  `currentAlbumId === deletedAlbumId` の時は `toggleAlbumListMode()` で album list view に切替 → `useAutoClosePhotoDisplayEffect` で PhotoDisplay も自動 close される。

### 8. PhotoEditor "Apply style" (上書き)

- `updatePhotoCssStyle(path, css)` で `cssStyle` フィールドを更新
- バックエンドは `save_css_style` で即座に DB に persist (cssStyle の変更は永続化される)
- サムネイル再生成は別途バックエンドが async で実行
- slide-mount テーマ等で grid に cssStyle が反映される場合は、in-memory の cssStyle 値を使ってレンダリングされる
- **サムネイル更新通知**: バックエンドのサムネイル生成完了時にイベントを emit してフロントで再読込みするか、grid 表示は in-memory の cssStyle ベースで継続するか、いずれか。実装計画フェーズでバックエンドのサムネイル生成パイプラインを確認の上決定する

## 検証

- PhotoDisplay 開いて編集せず close → 瞬時に grid に戻る (loading 画面が出ない)
- 編集した写真の状態が grid に正しく反映される (★/コメント/タグ/album/cssStyle)
- ★ filter active で ★ を 0 にして close → grid から除外される (loading 画面なしで)
- タグ filter active でタグを外して close → grid から除外される
- sort=★ で ★ 変更 → close 時にローカル再ソートが走り、新しい順位で表示される
- 連続編集 (★→タグ→★) → close で全変更が反映
- PhotoDisplay 中の前後 navigation が安定している (突然 photo が消えない)
- Save as Copy → close 後に新写真が grid に表示
- Save as Copy 後、PhotoDisplay 中の thumb strip にも新写真が表示される
- Trash 操作 → PhotoDisplay 中に next photo に遷移、close 時に grid からも除外
- 全 view mode (album/tag/search/person/unknown_faces) で同じ挙動
- 検索モードで編集 → close で検索結果 grid に反映 (Phase 1 統一の恩恵)

## 影響範囲

- `src/hooks/usePhotoDisplay.js` (refreshPhotos 削除 + sortDirty 処理)
- `src/hooks/usePhotoDataSync.js` (`currentPhoto` gate)
- `src/hooks/usePhotosState.js` (`sortDirty` state 追加)
- `src/hooks/usePhotoListHelpers.js` (新ヘルパー4つ追加 + sortDirty 連動)
- `src/App/PhotosList/PhotoOption/PhotoTags.jsx` (`updatePhotoTags` 呼ぶ + キャッシュ同期)
- `src/App/PhotosList/PhotoOption/PhotoEditor.jsx` & `photoExportUtils.js` (`onPhotosRefresh` → 新ヘルパー)
- `src/App/PhotosList/AlbumTab.jsx` (`updatePhotoAlbums` 呼ぶ)
- `src/App/PhotosList.jsx` (新ヘルパーを props で配布)
- `src/services/UnifiedCollectionService.js` (タグキャッシュ追加メソッド、必要なら)
- `src/utils/PhotoSort.js` (新規 — sort comparator 共通 util)
- `src-tauri/src/commands/style_commands.rs` (Save as Copy の返り値を JSON object 化)
- Phase 1 で導入する `usePhotosCache` (View Cache) — 編集ヘルパーから patch 呼び出し
- Selection tab 経路: `src/App/PhotosList/DirectoryMenu/SelectionTab.jsx` 等で発火する bulk 操作の整合 (一括タグ付け / 一括アルバム追加なども `updatePhotoTags` / `updatePhotoAlbums` の配列版を将来拡張する余地あり、本 Phase では bulk delete のみ)

## リスク

- **`setStarWithUpdate` の signature 不統一**: 既存は `currentPhoto?.originalPath` を closure 参照、新ヘルパー (`updatePhotoTags` など) は `path` 引数。**統一案**: `setStarWithUpdate(path, newStar)` に変更し全呼び出し側を更新 (実装計画フェーズで対応)
- **PhotoEditor の `Apply style` サムネイル更新通知**: バックエンドの async サムネイル生成完了を frontend が拾えないと、grid のサムネイルが古いまま。バックエンドのサムネイル pipeline を確認 (実装計画フェーズで)
- **テスト戦略**: 凍結 / 解凍の挙動はインテグレーション/e2e テストでないと検証困難。Playwright e2e で主要経路 (★ 変更 → close → grid 反映) と edge case (bulk delete + navigation) を網羅
- **Selection tab 経路の bulk タグ/アルバム追加**: 現状は `onPhotosRefresh` 経由で reload。本 Phase では bulk delete のみ対応。一括タグ付け/一括アルバム追加は将来 `updatePhotoTagsBulk` / `updatePhotoAlbumsBulk` で対応する余地

> 確認済リスク (削除): 凍結中の整合性問題は、編集系ヘルパーも両配列を直接更新する仕様 (上記 3 節) で解消。配列長変化は削除と Save as Copy のみ、それぞれの操作タイプで navigation 調整を含めて整理済み。

## 開放問題

なし (本 spec 内ですべて確定済)。
