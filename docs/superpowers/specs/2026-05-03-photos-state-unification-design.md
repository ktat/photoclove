# Photos State Unification (Phase 1)

**Date:** 2026-05-03
**Status:** Design (approved scope, awaiting implementation plan)
**Depends on:** —
**Enables:** [2026-05-03-instant-photo-display-close-design.md](./2026-05-03-instant-photo-display-close-design.md)

## 背景と動機

バックエンドは既に `get_photos_unified` (Tauri command) で全 view mode の photos を統一して返している (`src/hooks/usePhotoDataLoader.js:53`)。しかしフロントエンド側の保存先 state は歴史的経緯でモードごとにバラバラで残っている:

| Load 関数 | search_type | 保存先 state |
|---|---|---|
| `loadAlbumPhotos` | `'album_photos'` | `albumPhotos` (PhotoContext) |
| `loadTagPhotos` | `'tag'` | `tagPhotos` (usePhotosState) |
| `loadPersonPhotos` | `'person'` | **`allPhotosForCurrentFetch`** ← 統一済 |
| `loadUnknownFacesPhotos` | `'unknown_faces'` | **`allPhotosForCurrentFetch`** ← 統一済 |
| `loadTrashPhotos` | (`'trash'` 系) | `trashPhotos` |
| 検索 (`useSearchAndFilters`) | (検索系) | `searchResults` |
| 通常 (date list) | (通常系) | `allPhotosForCurrentFetch` |

person/unknown_faces は既に `allPhotosForCurrentFetch` に集約されているのに、album/tag/trash/search だけ別 state に残っている。`useFilteredPhotos` (`src/hooks/useFilteredPhotos.js:39-43`) はこの分岐を吸収する分岐ロジックを持つ。

この分散が問題を生む:
- 編集ヘルパー (`setStarWithUpdate`, `updatePhotoComment` 等) は `allPhotosForCurrentFetch` のみ更新するため、album/tag/search モードでは編集が grid に反映されない
- 各 view mode で状態管理ロジックが重複
- 後続機能 (Phase 2: PhotoDisplay 瞬時 close) の設計が複雑化する (multi-list 同時更新が必要になる)

## ゴール

フロントエンドの「現在表示中の photos リスト」を **`allPhotosForCurrentFetch` 一本に統一**し、view mode ごとの分岐を排除する。

## Non-goals

- バックエンド API の変更 (既に統一済)
- album/tag リスト自体 (`albumsList`, `tagsList`) の変更 — sidebar 表示等で別用途で必要
- album/tag 等のメタデータ (cover photo, photo count) の表示変更
- Phase 2 の編集系変更 (それは別 spec で扱う)

## 設計

### 1. Source 統一

`useFilteredPhotos` (`src/hooks/useFilteredPhotos.js:36-43`) の source 分岐を撤廃:

**変更前:**
```js
const sourcePhotos = viewModeObj.isSearchMode() && searchResults.length > 0 ? searchResults :
    (viewModeObj.isAlbumMode() ? albumPhotos :
        (viewModeObj.isTagMode() ? tagPhotos :
            (viewModeObj.isTrashMode() ? (photoCollection?.photos || []) :
                allPhotosForCurrentFetch)));
```

**変更後:**
```js
const sourcePhotos = allPhotosForCurrentFetch;
```

### 2. Load 関数の集約

`src/hooks/usePhotoDataLoader.js` 内:

- `loadAlbumPhotos` → `setAllPhotosForCurrentFetch(photosAsJSON)` に統一
- `loadTagPhotos` → `setAllPhotosForCurrentFetch(photosAsJSON)` に統一
- `loadTrashPhotos` → `setAllPhotosForCurrentFetch(photosAsJSON)` に変更。`setTrashPhotos` は廃止 (誰も読んでいない死に state)。`permanentlyDeletePhoto` / `restorePhoto` の `setTrashPhotos` 呼び出しも廃止し、既存の `handlePhotoRemovalNavigation` 経路で `allPhotosForCurrentFetch` を更新
- 検索結果 (useSearchAndFilters) → 検索完了時に `setAllPhotosForCurrentFetch(searchResults)` に書き出す

#### 2.1 検索結果の commit 経路 (詳細)

`useSearch.js` の API は変更せず、PhotosList.jsx 側で `searchResults` の変化を effect で検知して `allPhotosForCurrentFetch` に commit する:

```js
// PhotosList.jsx 内 (or useSearchAndFilters 内)
useEffect(() => {
    if (viewModeObj?.isSearchMode() && searchResults) {
        setAllPhotosForCurrentFetch(searchResults);
        // View Cache の "search:<hash>" にも保存
    }
}, [searchResults, viewModeObj]);
```

#### 2.2 検索クリア (`clearSearch`) 時の挙動

検索をクリアすると view mode が search から previous mode (home/album/tag 等) に戻る。`useViewModeSync` がそれを検知して、対応 viewKey が View Cache にあれば cache から復元、なければ load する。これは通常の view 切替経路と同じなので追加実装不要。

### 3. 残す state、廃止する state

| State | 扱い | 理由 |
|---|---|---|
| `allPhotosForCurrentFetch` | **残す (主役)** | 全 mode の photos の単一ソース |
| `albumPhotos` (PhotoContext) | **完全廃止** | 統一後は誰も読まない死に state。`updateAlbumPhotos` setter, 同期 effect (`usePhotoSyncEffect` の album 経路) も削除 |
| `tagPhotos` | **完全廃止** | 統一後は誰も読まない死に state。`setTagPhotos`, 同期 effect の tag 経路も削除 |
| `searchResults` | **役割変更で残す** | `useSearch` の内部バッファとしては保持、grid 入力からは外す。検索完了時に `setAllPhotosForCurrentFetch(photos)` で commit + View Cache へ保存 |
| `photoCollection` (state) | **メタデータ用途で縮退** | photos 表示の入力源としては使わない。`has_next` 等 collection metadata の保持のみ。photos 自体は `allPhotosForCurrentFetch` へ |
| `trashPhotos` | **廃止** | 調査の結果、コンポーネントで誰も読んでいない死に state。trash mode でも `allPhotosForCurrentFetch` を使う |
| `albumsList` / `tagsList` / `facesList` | **残す** | sidebar / 各種 picker UI 用 |
| `photosListMiniAllPhotos` | 残す | grid / navigation 用の最終派生 state (Phase 2 で扱う) |

### 3.5 `useViewModeSync` の skip ロジック削除

現状の `src/hooks/useViewModeSync.js:56-59` で album/tag モードでは `loadPhotosWithCollection` を skip しているが、Phase 1 統一後は **削除する** (View Cache が存在するため、毎回 cache lookup → hit なら復元 / miss なら load の経路に統一)。

### 4. View Mode 切替時の挙動と View Cache

統一後は各 view mode 切替で対応する load 関数が `allPhotosForCurrentFetch` を上書きするだけになる。ただし現状 `useViewModeSync` (line 56-59) は album/tag モードで load をスキップしており、`albumPhotos` / `tagPhotos` が暗黙のキャッシュとして機能している (一度開いたアルバムに戻ると瞬時表示)。この UX を維持するため、**view-key ベースの photos cache** を導入する。

#### 4.1 View Cache の設計

`PhotoContext` (or 新 hook) に LRU cache を持つ:

```js
// Cache structure
photosCache: Map<viewKey, { photos: PhotoJSON[], updatedAt: number }>

// viewKey の生成例
"home"
"album:42"
"tag:7"
"person:3"
"unknown_faces"
"search:<hash>"   // hash = SHA256(JSON.stringify({query, type, filters, sort})) の先頭 8 文字
"trash"
"import:<importPath>"
```

#### 4.1.1 viewKey の hash 生成 (検索)

検索の viewKey 部分は `SHA256(JSON.stringify({query, type, filters, sortField, sortOrder}))` の先頭 8 文字を使う。filters はキーソートして JSON 化し、同条件の検索が同じ key を生成するようにする。Web Crypto API (`crypto.subtle.digest`) で計算可能。

挙動:
- view mode 切替時、対応 viewKey が cache にあれば `setAllPhotosForCurrentFetch(cache.get(viewKey).photos)` で復元
- cache miss なら従来通り backend から load → 完了時に cache に書き込む
- 編集系の in-memory 更新 (Phase 2) は **現在の viewKey の cache も同時に更新** する
- 完全リフレッシュ要求 (例: `reloadAlbums`, `unifiedCollectionService.clearCache()` 連動) では cache を無効化

#### 4.2 LRU 退避

以下2つの上限を持ち、超えたら **LRU 順 (`updatedAt` 古い順)** で退避:
- **`view_cache_max_keys`** — 同時に保持できる viewKey 数 (デフォルト: 10)
- **`view_cache_max_total_photos`** — 全 cache 合算 photos 数 (デフォルト: 50000)

書き込み時に: 新規エントリ追加 → 上限超過していれば最古エントリから削除を繰り返す。これにより巨大ライブラリで cache が膨張する問題を防ぐ。

**現在の viewKey 保護**: 現在表示中の view に対応する viewKey は LRU 退避対象から除外する (退避すると即座に再 load が必要になり無意味)。実装では `currentViewKey` を保持し、退避ループで `if (key === currentViewKey) continue;` で skip。

#### 4.2.1 設定経由で調整可能

両方の上限値は `appConfig` に新規フィールドとして追加し、`Preferences > Performance` タブから UI で調整可能にする:
- `view_cache_max_keys: number` (デフォルト 10、典型的な行き来 view 数 ~5 に余裕を持たせた値)
- `view_cache_max_total_photos: number` (デフォルト 50000、~2KB/photo × 50k = ~100MB JS heap 上限)

UI 配置先: `src/App/Preferences/tabs/PerformanceTab.jsx`

config 値の変化はリアルタイムに cache 上限に反映する (cache 縮小が必要なら超過分を LRU で退避)。

#### 4.3 cache 無効化トリガー

- 写真のインポート / 削除 / 移動 (新規 photo の追加・既存 photo の消失でほぼ全 view が影響受けるため、**全クリア**)
- album/tag/person の作成・削除・rename (該当 view 系の cache をクリア、他 view も photoCount 等で影響なら全クリア)
- 設定変更で sort/filter のバックエンド適用が変わる場合

無効化と編集の使い分け:
- **編集 (in-memory 更新で済むもの)**: cache 内の該当 photo を patch (Phase 2 の編集ヘルパーが担う)
- **ライブラリ構造の変更**: cache 無効化

#### 4.3.1 cache 無効化の依存度マップ

| 操作 | クリア対象 |
|---|---|
| 写真のインポート / 削除 / 移動 | **全クリア** (date counts/photoCount に広範な影響) |
| album 作成 | albumsList のみ更新、cache はクリア不要 |
| album 削除 | 該当 `album:<id>` cache のみ削除、`home` cache の photoCount 表示用は保持 (photo 自体は library に残るため) |
| album 名/cover 変更 | cache クリア不要 (photos 自体は変わらない) |
| tag 作成/削除/rename | 該当 `tag:<id>` cache のみ削除 |
| sort/filter のバックエンド適用変更 | **全クリア** (photos の並び順が変わるため) |

### 5. 検証

- **album/tag/search モードで grid 表示が正常**
- **album/tag/search モードで filter (★/comment/tag/extension) と sort が正常**
- **album/tag/search モードで infinite scroll が正常**
- **view mode 切替で photos が正しく入れ替わる**
- **削除・編集系の既存挙動 (Phase 2 前) が変わらない** ← 既存 `setStarWithUpdate` 等が `allPhotosForCurrentFetch` のみ更新するので、Phase 1 完了後は **album/tag/search モードでも編集が grid に反映されるようになる** (これは Phase 1 のうれしい副作用)
- **sidebar の album cover photo / album list / tag list / face list が正常表示**
- **trash モードの表示と復元/削除操作**

## 影響範囲

- `src/hooks/usePhotoDataLoader.js` (load 関数群)
- `src/hooks/useFilteredPhotos.js` (source 分岐削除)
- `src/hooks/useSearchAndFilters.jsx` (検索結果を `allPhotosForCurrentFetch` に commit)
- `src/context/PhotoContext.jsx` (`albumPhotos` 関連の整理)
- `src/hooks/usePhotosState.js` (`tagPhotos` 関連の整理)
- `src/hooks/usePhotoListLoading.js` (load wrapper の更新)
- `src/App/PhotosList.jsx` (props の整理)
- `src/hooks/usePhotoSyncEffect` (`usePhotosListEffects.js` 内) — 必要に応じ簡素化
- `src/App/Preferences/tabs/PerformanceTab.jsx` (View Cache 設定の UI 追加)
- バックエンド: `Config` 構造体 (`src-tauri/src/config/`) に `view_cache_max_keys`, `view_cache_max_total_photos` フィールド追加。`#[serde(default = "default_view_cache_max_keys")]` 等で **古い config.json 読み込み時にデフォルト値が適用** されるようにする (バージョン互換)
- 新規 hook/context: View Cache 管理 (例: `src/context/PhotosCacheContext.jsx` or `src/hooks/usePhotosCache.js`)
- `src/services/UnifiedCollectionService.js` — 関連の cache 操作との連携

## リスク

- **view cache の整合性**: 編集や外部からのライブラリ構造変更が起きた時に cache を正しく更新/無効化できるか。Phase 2 の編集ヘルパーで cache patch を忘れると stale な photo が再表示される。
- **View Cache の State vs Ref 選択**: `useState(new Map())` で持つと cache patch ごとに setState → 連鎖再 render。`useRef` だと DevTools 追跡不能。**推奨: 専用 hook (`usePhotosCache`) 内で `useRef` + 強制 re-render trigger** で実装。cache 自体は ref、UI 更新したい時のみ trigger setState。
- **`useTrashOperations.permanentlyDeletePhoto` / `restorePhoto` の `setTrashPhotos` 呼び出し**: `trashPhotos` state を Phase 1 で削除すると compile error。**Phase 1 内で同時に `setTrashPhotos` 呼び出しも削除し、`setAllPhotosForCurrentFetch(prev => prev.filter(...))` 同等処理に置き換える** (Phase 2 を待たずに Phase 1 で完結)。
- **Config 構造体の serde 互換**: `view_cache_max_keys`/`view_cache_max_total_photos` は `#[serde(default = "...")]` で**古い config.json から読み込む際にデフォルト値が当たる**ように実装。app save 時に新フィールドが JSON に追記される。

> 確認済リスク (削除):
> - album sidebar の cover 表示は `albumsList[i].coverPhoto` (full Photo entity, `usePhotoDataLoader.js:81`) で独立に持たれており、`albumPhotos` を grid 入力から外しても影響しないことを確認。
> - 検索結果の挙動は「`useSearch.searchResults` を内部バッファとして残し、grid 入力からは外す。検索完了時に `setAllPhotosForCurrentFetch` へ commit + View Cache へ保存」に決定 (上記 state 表参照)。

## 開放問題

なし (本 spec 内ですべて確定済)。
