# Phase 1 完了 / Phase 2 開始時点の引き継ぎ

**Last updated:** 2026-05-04
**Branch:** main (Phase 1 commits merged in-line)

## 完了したこと: Phase 1 — Photos State Unification

### Spec & Plan
- Spec: `docs/superpowers/specs/2026-05-03-photos-state-unification-design.md`
- Plan: `docs/superpowers/plans/2026-05-04-phase1-photos-state-unification.md`

### 実装結果

`6ab262d6..ffba8a3f` (約30+ commits, ~700行変更)

**アーキテクチャの変更:**
- `albumPhotos` / `tagPhotos` / `trashPhotos` 廃止 → `allPhotosForCurrentFetch` 一本化
- `useFilteredPhotos` の source 分岐削除 (常に allPhotosForCurrentFetch を読む)
- `useViewModeSync` の skip ロジック削除 (全 view mode 統一処理)
- `usePhotoSyncEffect` (旧 albumPhotos/tagPhotos 同期 effect) 削除
- `useTrashPhotos` の `setTrashPhotos` 廃止 — `handlePhotoRemovalNavigation` 経由に統一

**新規 hook / util:**
- `src/hooks/usePhotosCache.js` — LRU map (ref-based, useMemo で stable reference)
- `src/hooks/useSearchModeSync.js` — search mode の commit / overlay / 状態クリア管理
- `src/utils/ViewKey.js` — viewKey 計算 (search 用は canonical JSON、その他は mode+ID)
- `src/App/Preferences/tabs/PerformanceTab.jsx` — view cache 設定 UI

**Backend:**
- `Config.view_cache_max_keys` / `view_cache_max_total_photos` 追加 (`#[serde(default)]` で後方互換)
- 副次修正: `src-tauri/src/commands/photo_handlers/burst.rs` の `map_burst_photo_row` で `File::new_if_exists` → `File::from_relative` (バーストモードが常に空を返すバグ修正)

**重要な設計決定:**
- **View Cache**: `useViewModeSync` で view 切替時にキャッシュ lookup → hit なら同期復元、miss なら fetch
- **`onLoadSuccess` callback**: load 完了時に同期的に cache 保存 (race を防ぐため一般 effect 廃止)
- **`useLayoutEffect` (paint 前) + `useEffect` (post-paint)** に分離: paint 前は最小限 (state setup)、重い処理 (load) は post-paint
- **`isFetched` flag**: empty-state UI のちらつき排除 ("Trash is Empty" や "No Photos" は load 完了後のみ表示、search mode は無条件)
- **`refreshGenRef` (世代カウンタ)**: 重複ロード時の loading state race を防止
- **キャッシュ保存タイミング**: `loadViaUnifiedAPI` 内で setAllPhotos の直後に同期的に `onLoadSuccess(viewMode, photos)` 呼び出し → viewMode はクロージャ固定値なので race-safe

**検証済み挙動:**
- 全 view mode (home/album/tag/search/trash/person/unknown_faces/import/recent/burst) の grid 表示
- View 切替で cache hit 時の瞬時復元 (loading 画面なし)
- album/tag/search モードでの filter (★/comment) — 元々バグだったのが Phase 1 で正しく動くように
- Date → Trash → Date 等の連続切替でも stale photos が見えない
- 検索フォーム入力時の "Searching..." overlay
- search mode を離れたら検索フォームがクリア
- バーストトグル (backend 修正後)

---

## 次にやること: Phase 2 — Instant Photo Display Close

### Spec
`docs/superpowers/specs/2026-05-03-instant-photo-display-close-design.md`

### ゴール

PhotoDisplay (個別写真ビュー) から PhotosList に戻る時の "Loading your photos..." を排除し、in-memory list 操作で完結させる。

### 主な作業項目 (spec 抜粋)

1. **同期抑制**: `useFilteredPhotosSync` に `currentPhoto != null` gate を追加 (PhotoDisplay 中は filter再計算 stop)
2. **sortDirty フラグ**: `usePhotosState` に追加。Star ソート + ★変更時のみ close 時にローカル再ソート
3. **新編集ヘルパー**:
   - `updatePhotoTags(path, tags)` — PhotoTags の add/remove
   - `updatePhotoAlbums(path, albumIds)` — AlbumTab
   - `updatePhotoCssStyle(path, css)` — PhotoEditor "Apply style"
   - `addPhotoToList(newPhotoData, sortCriterion)` — Save as Copy (sort 位置 + nav index 調整)
   - `handlePhotoRemovalNavigationBulk(paths)` — 一括削除 (Selection tab 経由)
4. **`closePhotoDisplay` 改訂**: `refreshPhotos()` 削除、必要なら sortDirty で local re-sort のみ
5. **`PhotoTags` の `onPhotosRefresh` 既存バグ対応**: 新プロップ `onTagsChanged(path, tags)` 追加
6. **タグキャッシュ同期**: 新規タグ作成時に `unifiedCollectionService.clearCache()`
7. **AlbumTab の `handleAlbumDelete`**: ローカル除去 + cache クリア (backend 再 fetch 廃止)
8. **`PhotoEditor` "Apply style"**: `cssStyle` フィールドの in-memory 更新
9. **Save as Copy のバックエンド返り値拡張**: `newPhotoPath` のみ → `{newPhotoPath, createdAt, hasThumbnail, ...}` JSON
10. **`useAutoClosePhotoDisplayEffect`**: Phase 1 で「任意の viewMode 変更で close」に既に拡張済 ✓
11. **`src/utils/PhotoSort.js` 新規**: sort comparator の共通 util (Save as Copy の挿入位置計算 + close 時 local sort 用)

### Phase 2 で扱うべき in-memory state リスト

各編集経路で **以下 3 箇所** を atomically 更新する必要あり:
- `allPhotosForCurrentFetch` (filter/sort の入力)
- `photosListMiniAllPhotos` (PhotoDisplay 中の navigation 配列)
- `photosCache` の現在の viewKey (Phase 1 完了時点で `setStarWithUpdate` / `updatePhotoComment` は対応済 — `patchCacheCurrentView` helper)

### Phase 2 spec の確定済み開放問題

- ローカル再ソート関数の置き場所: `src/utils/PhotoSort.js`
- タグキャッシュ同期: `unifiedCollectionService.clearCache()` で全クリア (シンプル)
- アルバム削除: ローカル除去のみ (backend 再 fetch 廃止)

---

## 次セッションで最初にやること

1. このファイル全部読む
2. spec を読む: `docs/superpowers/specs/2026-05-03-instant-photo-display-close-design.md`
3. Phase 2 実装計画を作成: `docs/superpowers/plans/2026-05-04-phase2-instant-photo-display-close.md` (`superpowers:writing-plans` skill を使う)
4. ユーザに plan を見せて承認を得る
5. 実装開始

### コンテキスト

- 言語: ユーザは日本語でやりとり
- Auto mode: ユーザの方針として "self-pace, minimize interruptions" を希望
- Tooling: pnpm (npm/yarn ではない)、Tauri 2、React 18
- File size limit: 700行 (越えるとhookで blocked)
- ビルド確認: `pnpm build` (frontend), `cd src-tauri && cargo check` (backend)
- 表示テスト: `pnpm tauri dev` (ユーザ手動)
- Phase 2 中に発見したフロント以外のバグは Phase 2 完了後の別ファイルでまとめる方針 (Phase 1 の burst.rs 修正のように)

### Phase 1 で苦戦したポイント (Phase 2 で気をつける)

- **React 18 のレンダリングタイミング**: state setter の closure 安定性、useLayoutEffect vs useEffect、paint timing
- **重複 setState による race**: 世代カウンタ (`refreshGenRef` パターン) が有効
- **オブジェクト reference の安定性**: hook の返り値は `useMemo` で安定化しないと dep 比較で爆発
- **isFetched gate**: empty-state を render する条件は `isFetched || isSearchMode` (search は call-to-action のため例外)
- **closePhotoDisplay の refresh** は Phase 1 で search モードのみスキップにした (ViewMode の searchParams が stale なため)。Phase 2 で完全廃止
