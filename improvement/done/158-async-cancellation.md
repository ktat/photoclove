# 非同期操作のキャンセル機能（Async Operation Cancellation）

## Overview

PhotoLoadingなどの非同期操作中にユーザーが別の操作を行った場合、前の操作がキャンセルされず、古い結果が表示される問題を解決する。Request IDパターンを導入し、新しい操作が開始されたら古い操作の結果を無視する仕組みを実装する。

## User Impact

- **対象ユーザー**: 全てのPhotoCloveユーザー
- **改善されるワークフロー**:
  - 素早いナビゲーション操作が可能になる
  - 意図しない古い結果の表示がなくなる
  - より直感的なUI体験を提供
- **解決される問題点**:
  - 日付選択中に別の日付を選んでも、最初の日付の結果が表示される
  - アルバム→日付、日付→ゴミ箱などのモード切り替えで古い結果が表示される
  - ユーザーが待機中に操作を変更できない

## 報告されている問題パターン

### 1. 日付の選択
1. ある日付(A)を選んで、PhotoLoadingになる
2. PhotoLoading中に、別の日付(B)を選ぶ
3. **現状**: Aの結果が表示される
4. **期待**: Aがキャンセルされ、Bの結果が表示されるべき

### 2. アルバム => 日付
1. あるアルバムを選んで(A)、PhotoLoadingになる
2. PhotoLoading中に、ある日付(B)を選ぶ
3. **現状**: Aの結果が表示される
4. **期待**: Aがキャンセルされ、Bの結果が表示されるべき

### 3. 日付 -> ゴミ箱
1. ある日付を選んで(A)、PhotoLoadingになる
2. PhotoLoading中に、ゴミ箱をクリック(B)
3. **現状**: Aが表示されたあとに、Bが表示される
4. **期待**: Aがキャンセルされ、Aの結果は表示されずに、Bの結果が表示されるべき

### 4. ゴミ箱 -> 日付
1. ゴミ箱を選んで(A)、PhotoLoadingになる
2. PhotoLoading中に、ある日付をクリック(B)
3. **現状**: Aの結果が表示される
4. **期待**: Aがキャンセルされ、Bの結果が表示されるべき

## 関連する別タスク（参考）

### 他のモードから選択された日付へ戻れない
1. 日付(A)を選択
2. 日付以外のモードに移動（アルバム、タグ、ゴミ箱、検索等）
3. もとの日付を選んで戻ることができない

**→ これはUI設計の問題であり、別タスクとして分離すべき**

## Influence on Existing Features

### Compatibility
- 既存の機能は破壊されない
- フェッチ処理の内部実装のみ変更
- ユーザー向けの動作は改善される（古い結果が表示されなくなる）

### Related Features
- `PhotosList` - メインの写真表示コンポーネント
- `usePhotoLoader` - 写真読み込みフック
- `usePhotoDataLoader` - 写真データ読み込みフック
- `useViewMode` / `UIContext` - ビューモード管理
- `PhotoLoading` - ローディング表示コンポーネント

---

## 決定した実装案

### 採用: Request ID パターン

**選定理由**:
- Tauri の `invoke` は AbortSignal をネイティブサポートしていない
- シンプルで確実な実装が可能
- 標準のReact/JavaScriptパターンのみ使用（外部依存なし）

### 設計方針

1. **フロントエンドのみで対応**: バックエンド処理はキャンセルせず続行を許容
2. **ローディング表示**: 新しいリクエスト開始時も継続表示（ちらつきなし）
3. **結果の破棄**: 古いリクエストの結果は単純に無視する

### 実装コード

#### 新規フック: `src/hooks/useAsyncCancellation.js`

```javascript
import { useRef, useCallback } from 'react';

/**
 * キャンセル可能な非同期操作を管理するフック
 *
 * Request IDパターンを使用して、古いリクエストの結果を無視する。
 * Tauri invokeはAbortSignalをサポートしていないため、
 * このパターンでフロントエンド側のキャンセルを実現する。
 */
export function useAsyncCancellation() {
  const requestIdRef = useRef(0);

  /**
   * 新しいリクエストを開始し、前のリクエストを無効化
   * @returns {number} 現在のリクエストID
   */
  const startNewRequest = useCallback(() => {
    return ++requestIdRef.current;
  }, []);

  /**
   * リクエストがまだ有効かどうかをチェック
   * @param {number} requestId - チェックするリクエストID
   * @returns {boolean} リクエストが最新かどうか
   */
  const isRequestValid = useCallback((requestId) => {
    return requestId === requestIdRef.current;
  }, []);

  /**
   * 全てのリクエストをキャンセル（新しいIDを発行するだけ）
   */
  const cancelAll = useCallback(() => {
    requestIdRef.current++;
  }, []);

  return {
    startNewRequest,
    isRequestValid,
    cancelAll,
  };
}
```

#### 使用例: `usePhotoLoader.js` への適用

```javascript
import { useAsyncCancellation } from './useAsyncCancellation';

// フック内で初期化
const { startNewRequest, isRequestValid } = useAsyncCancellation();

const loadAllPhotosBasedOnViewMode = async (viewMode, config, silent = false) => {
  // 新しいリクエストIDを発行（前のリクエストを無効化）
  const requestId = startNewRequest();

  try {
    if (!silent) {
      setPhotoLoading(true);
    }

    const result = await invoke("get_photos_unified", { request: params });

    // 最新のリクエストでなければ結果を無視
    if (!isRequestValid(requestId)) {
      logger.debug('PhotoLoader', 'request_cancelled', 'Ignoring stale response', { requestId });
      return;
    }

    // 結果を処理
    processPhotos(result);
  } catch (error) {
    // キャンセルされたリクエストのエラーは無視
    if (!isRequestValid(requestId)) {
      return;
    }
    handleError(error);
  } finally {
    // 最新のリクエストの場合のみローディングを解除
    if (isRequestValid(requestId)) {
      setPhotoLoading(false);
    }
  }
};
```

### Source Code Changes

| ファイル | 変更内容 |
|---------|---------|
| `src/hooks/useAsyncCancellation.js` | **新規作成**: キャンセル可能な非同期操作用のカスタムフック |
| `src/hooks/usePhotoLoader.js` | Request IDパターンの導入、`loadAllPhotosBasedOnViewMode`と`loadPhotosWithCollection`の修正 |
| `src/hooks/usePhotoDataLoader.js` | `loadAlbumPhotos`, `loadTagPhotos`, `loadTrashPhotos`にキャンセル機能を追加 |

### 実装手順

#### Phase 1: 基盤の構築
1. `useAsyncCancellation` フックの作成
2. 既存のテストが通ることを確認

#### Phase 2: usePhotoLoader への適用
1. `loadAllPhotosBasedOnViewMode` にキャンセル機能を追加
2. `loadPhotosWithCollection` にキャンセル機能を追加
3. 日付選択の問題が解決されることを確認

#### Phase 3: usePhotoDataLoader への適用
1. `loadAlbumPhotos` にキャンセル機能を追加
2. `loadTagPhotos` にキャンセル機能を追加
3. `loadTrashPhotos` にキャンセル機能を追加
4. アルバム→日付、ゴミ箱→日付の問題が解決されることを確認

#### Phase 4: 動作確認
1. 全パターンのテスト
2. エッジケースの確認

---

## Dependencies & Risks

### External Dependencies
- なし（標準のReact/JavaScriptパターンのみ使用）

### Performance
- オーバーヘッドは最小限（refの更新のみ）
- キャンセルにより不要な処理が減り、むしろパフォーマンス向上の可能性

### Security
- セキュリティリスクなし

### Risks
- **低**: 既存のフェッチロジックとの統合で予期しない動作
- **対策**: 段階的な実装とテスト

## Testing Strategy

### Manual Testing Steps

1. **日付選択テスト**
   - 大量の写真がある日付Aを選択
   - ローディング中に別の日付Bを選択
   - **期待結果**: Bの写真のみが表示される

2. **アルバム→日付テスト**
   - 大量の写真があるアルバムを選択
   - ローディング中に日付を選択
   - **期待結果**: 日付の写真のみが表示される

3. **日付→ゴミ箱テスト**
   - 日付を選択
   - ローディング中にゴミ箱を選択
   - **期待結果**: ゴミ箱の内容のみが表示される（途中で日付の写真が一瞬表示されない）

4. **ゴミ箱→日付テスト**
   - ゴミ箱を選択
   - ローディング中に日付を選択
   - **期待結果**: 日付の写真のみが表示される

5. **高速連続操作テスト**
   - 複数の日付を素早く連続でクリック
   - **期待結果**: 最後にクリックした日付の写真のみが表示される

### Edge Cases
- ネットワーク遅延が大きい場合
- 同じ日付/アルバムを連続で選択した場合
- ローディング完了直前にキャンセルした場合

## References

- `docs/terms.md` - PhotosList, PhotoLoading等の用語定義
- `src/hooks/usePhotoLoader.js` - 現在の写真読み込み実装
- `src/hooks/usePhotoDataLoader.js` - 写真データ読み込み実装
- `src/context/UIContext.jsx` - ビューモード管理
- `src/hooks/useViewMode.js` - ビューモードステートマシン
