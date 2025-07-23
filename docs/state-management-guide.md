# PhotoClove State管理ガイド

このドキュメントは、PhotoCloveのstate管理の現状と、開発時の注意点をまとめたものです。

## 📋 目次

1. [概要](#概要)
2. [Context構造](#context構造)
3. [State管理のパターン](#state管理のパターン)
4. [よくある問題と対処法](#よくある問題と対処法)
5. [開発時の注意点](#開発時の注意点)

## 概要

PhotoCloveは複数のReact Contextを使用してグローバルstateを管理しています。しかし、各コンポーネント（特にPhotosList.jsx）には多数のローカルstateも存在し、これらの相互作用が複雑になっています。

### 主な課題

1. **State管理の分散**: グローバル（Context）とローカル（コンポーネント）のstateが混在
2. **依存関係の複雑さ**: 複数のstateが相互に依存し、更新順序が重要
3. **非同期処理**: 写真のロード、検索などの非同期処理とstate更新のタイミング

## Context構造

### 1. PhotoContext

**場所**: `src/context/PhotoContext.jsx`

**責任範囲**: 写真表示に関するメインのstate管理

```javascript
// 管理するstate
{
  dateList: [],        // 日付リスト
  datePage: {},        // 日付ごとのページ番号
  currentDate: "",     // 現在選択中の日付
  dateNum: {},         // 日付ごとの写真数
  showPhotoDisplay: {}, // 写真表示状態
  hideLoading: false,  // ローディング非表示フラグ
  recentPhotosMode: false, // 最近の写真モード
  albumsList: [],      // アルバムリスト
  currentAlbum: null,  // 現在のアルバム
  albumPhotos: []      // アルバム内の写真
}
```

### 2. UIContext

**場所**: `src/context/UIContext.jsx`

**責任範囲**: UI表示状態とナビゲーション管理

```javascript
// 管理するstate
{
  showImporter: false,     // インポーター表示
  showPhotosList: true,    // 写真リスト表示
  showPreferences: false,  // 設定画面表示
  showJobQueue: false,     // ジョブキュー表示
  showLogin: false,        // ログイン画面表示
  showSearchPage: false,   // 検索ページ表示
  searchInitialQuery: "",  // 検索初期クエリ
  isAdvancedSearchMode: false, // 高度な検索モード
  viewMode: 'date',        // ビューモード
  currentAlbumId: null     // 現在のアルバムID
}
```

### 3. ErrorContext

**場所**: `src/context/ErrorContext.jsx`

**責任範囲**: エラー管理とユーザーフレンドリーなエラー表示

### 4. ImportContext

**場所**: `src/context/ImportContext.jsx`

**責任範囲**: 写真インポート機能のstate管理

## State管理のパターン

### 1. ビューモードの決定

現在のビューモードは複数のstateの組み合わせで決定されます：

```javascript
// PhotosList.jsx内での判定
const isSearchMode = props.searchMode || false;
const isAdvancedSearchMode = props.isAdvancedSearchMode || false;
const isAlbumListMode = viewMode === 'album_list';
const isAlbumMode = viewMode === 'album' && currentAlbumId;
```

**問題点**: 複数のstateから導出されるため、整合性の保証が難しい

### 2. 画面遷移パターン

UIContextの`toggle*`関数で画面遷移を管理：

```javascript
// 検索ページへの遷移例
const toggleSearchPage = useCallback((t, initialQuery = "", isAdvanced = false) => {
    if (t) {
      setShowImporter(false);
      setShowPhotosList(false);
      setShowLogin(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowSearchPage(true);
      setSearchInitialQuery(initialQuery);
      setIsAdvancedSearchMode(isAdvanced);
    }
    // ...
}, []);
```

**問題点**: 多数のsetState呼び出しが必要で、バグの原因になりやすい

### 3. fetchConfigパターン

写真の取得方法を決定する重要なパターン：

```javascript
const fetchConfig = useMemo(() => {
    if (props.fetchConfig) return props.fetchConfig;
    if (isAdvancedSearchMode || isSearchMode) return null;
    
    return {
        fetch_method: recentPhotosMode ? "recent" : "date",
        value: recentPhotosMode ? "recent" : currentDate,
        title: recentPhotosMode ? "Recent Photos (60 most recent)" : currentDate,
        max_photos_per_fetch: recentPhotosMode ? 60 : undefined
    };
}, [props.fetchConfig, isAdvancedSearchMode, isSearchMode, recentPhotosMode, currentDate]);
```

## よくある問題と対処法

### 1. 初期化順序の問題

**問題**: useEffectでまだ定義されていない関数を参照する

```javascript
// ❌ 間違い
useEffect(() => {
    handleSearch(); // handleSearchがまだ定義されていない
}, []);

const handleSearch = useCallback(() => {
    // ...
}, []);

// ✅ 正解
const handleSearch = useCallback(() => {
    // ...
}, []);

useEffect(() => {
    handleSearch(); // handleSearchが定義済み
}, [handleSearch]);
```

### 2. State更新のタイミング問題

**問題**: 複数のstate更新が正しい順序で実行されない

```javascript
// ❌ 問題のあるコード
setCurrentDate("2024-01-01");
setShowPhotoDisplay(true); // currentDateの更新がまだ反映されていない可能性

// ✅ 推奨される方法
// 1. useEffectで依存関係を明確にする
useEffect(() => {
    if (currentDate) {
        setShowPhotoDisplay(true);
    }
}, [currentDate]);

// 2. または、状態更新を統合する
const updateDateAndDisplay = useCallback((date) => {
    setCurrentDate(date);
    setShowPhotoDisplay(prev => ({ ...prev, [date]: true }));
}, []);
```

### 3. 非同期処理とstate更新

**問題**: 非同期処理完了前にコンポーネントがアンマウントされる

```javascript
// ✅ クリーンアップを適切に行う
useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
        const result = await fetchPhotos();
        if (isMounted) {
            setPhotos(result);
        }
    };
    
    loadData();
    
    return () => {
        isMounted = false;
    };
}, []);
```

## 開発時の注意点

### 1. State追加時のチェックリスト

新しいstateを追加する前に確認すること：

- [ ] 既存のContextで管理すべきか、ローカルstateで十分か
- [ ] 他のstateとの依存関係はあるか
- [ ] 非同期更新が必要か
- [ ] リセット処理は必要か

### 2. useEffectの使用ガイドライン

- **依存配列を正確に記述する**: ESLintのexhaustive-depsルールを有効にする
- **クリーンアップ関数を忘れない**: 特に非同期処理やイベントリスナー
- **無限ループに注意**: 依存配列に含まれる値を更新しない

### 3. Context更新時の影響範囲

Contextの値を更新すると、そのContextを使用している全てのコンポーネントが再レンダリングされます：

```javascript
// PhotoContextを使用しているコンポーネント
- PhotosList
- DateList
- AlbumView
- その他多数

// 更新時は影響範囲を考慮
updateCurrentDate("2024-01-01"); // 上記全てのコンポーネントが再レンダリング
```

### 4. デバッグのヒント

1. **React Developer Tools**を使用してstate変更を追跡
2. **console.log**でstate更新のタイミングを確認
3. **useEffect**の実行順序を把握

```javascript
// デバッグ用のログ
useEffect(() => {
    console.log('State updated:', { currentDate, showPhotoDisplay });
}, [currentDate, showPhotoDisplay]);
```

## 今後の改善に向けて

現在のstate管理は複雑になっているため、以下の改善を検討中です：

1. **State管理の統合**: 関連するstateを1つのオブジェクトにまとめる
2. **カスタムフックの活用**: 複雑なロジックをカスタムフックに切り出す
3. **State Machineの導入**: ビューモード管理をより明確にする
4. **キャッシュ管理の改善**: 専用のキャッシュ層を導入

詳しい改善計画は `improvement/plan/` ディレクトリを参照してください。