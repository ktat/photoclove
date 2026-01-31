# PhotoClove State管理リファクタリング計画

## 📋 概要

PhotoCloveのstate管理は現在非常に複雑になっており、以下の問題が発生しています：

1. PhotosList.jsxに約40個のローカルstateが存在
2. 複数のContextとローカルstateの責任範囲が不明確
3. state間の依存関係が複雑で、バグが発生しやすい
4. 同じ目的のstateが複数箇所に分散

この改善計画では、段階的にstate管理を簡素化し、保守性を向上させます。

## 🎯 目標

1. **開発効率の向上**: state関連のバグを減らし、新機能追加を容易にする
2. **コードの可読性向上**: state管理の流れを明確にする
3. **テスタビリティの向上**: state管理ロジックを独立してテスト可能にする
4. **パフォーマンスの最適化**: 不要な再レンダリングを削減

## 📊 現状の問題点

### 1. State管理の分散

```javascript
// PhotosList.jsx内のローカルstate（一部）
const [photos, setPhotos] = useState([]);
const [currentPhotoPath, setCurrentPhotoPath] = useState("");
const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
const [photoLoading, setPhotoLoading] = useState(false);
const [starFilter, setStarFilter] = useState(0);
const [hasCommentFilter, setHasCommentFilter] = useState(false);
// ... 約40個のstate
```

### 2. ビューモード管理の複雑さ

```javascript
// 現在: 複数のstateから導出
const isSearchMode = props.searchMode || false;
const isAdvancedSearchMode = props.isAdvancedSearchMode || false;
const isAlbumListMode = viewMode === 'album_list';
const isAlbumMode = viewMode === 'album' && currentAlbumId;
```

### 3. 画面遷移時の多重setState

```javascript
// 現在: 多数のsetStateが必要
const toggleSearchPage = (t, initialQuery = "", isAdvanced = false) => {
    setShowImporter(false);
    setShowPhotosList(false);
    setShowLogin(false);
    setShowPreferences(false);
    setShowJobQueue(false);
    setShowSearchPage(true);
    setSearchInitialQuery(initialQuery);
    setIsAdvancedSearchMode(isAdvanced);
};
```

## 🚀 改善計画

### Phase 1: カスタムフックへの移行（優先度: 高）

#### 1.1 usePhotosList フックの作成

**目的**: PhotosList.jsxのローカルstateをカスタムフックに移動

```javascript
// src/hooks/usePhotosList.js
export const usePhotosList = () => {
  // 写真表示関連のstate
  const photoDisplay = usePhotoDisplay();
  
  // フィルター関連のstate
  const filters = usePhotoFilters();
  
  // 選択機能関連のstate
  const selection = usePhotoSelection();
  
  // キャッシュ関連のstate
  const cache = usePhotoCache();
  
  return {
    ...photoDisplay,
    ...filters,
    ...selection,
    ...cache,
  };
};
```

#### 1.2 専門化されたフックの作成

```javascript
// usePhotoDisplay.js - 写真表示専用
export const usePhotoDisplay = () => {
  const [photos, setPhotos] = useState([]);
  const [currentPhotoPath, setCurrentPhotoPath] = useState("");
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoLoading, setPhotoLoading] = useState(false);
  
  const loadPhotos = useCallback(async (config) => {
    // ロジックを集約
  }, []);
  
  return {
    photos,
    currentPhotoPath,
    currentPhotoIndex,
    photoLoading,
    loadPhotos,
  };
};

// usePhotoFilters.js - フィルター専用
export const usePhotoFilters = () => {
  const [filters, setFilters] = useState({
    star: 0,
    hasComment: false,
    extension: 'all',
  });
  
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const resetFilters = useCallback(() => {
    setFilters({ star: 0, hasComment: false, extension: 'all' });
  }, []);
  
  return { filters, updateFilter, resetFilters };
};
```

### Phase 2: ビューモード管理の統一（優先度: 高）

#### 2.1 ViewMode State Machineの導入

```javascript
// src/hooks/useViewMode.js
const VIEW_MODES = {
  HOME: 'home',
  DATE: 'date',
  SEARCH: 'search',
  ADVANCED_SEARCH: 'advanced_search',
  ALBUM_LIST: 'album_list',
  ALBUM: 'album',
  RECENT: 'recent',
  IMPORT: 'import',
  PREFERENCES: 'preferences',
};

const TRANSITIONS = {
  [VIEW_MODES.HOME]: {
    SEARCH: VIEW_MODES.SEARCH,
    ADVANCED_SEARCH: VIEW_MODES.ADVANCED_SEARCH,
    IMPORT: VIEW_MODES.IMPORT,
    // ...
  },
  // 各モードからの遷移を定義
};

export const useViewMode = () => {
  const [currentMode, setCurrentMode] = useState(VIEW_MODES.HOME);
  const [modeData, setModeData] = useState({});
  
  const transitionTo = useCallback((newMode, data = {}) => {
    const allowedTransitions = TRANSITIONS[currentMode];
    if (!allowedTransitions[newMode]) {
      console.warn(`Invalid transition from ${currentMode} to ${newMode}`);
      return;
    }
    
    setCurrentMode(newMode);
    setModeData(data);
  }, [currentMode]);
  
  return {
    currentMode,
    modeData,
    transitionTo,
    isMode: (mode) => currentMode === mode,
  };
};
```

#### 2.2 UIContextの簡素化

```javascript
// 改善後のUIContext
const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const viewMode = useViewMode();
  const navigation = useNavigation();
  
  // 画面表示stateを統合
  const screenVisibility = useMemo(() => ({
    showImporter: viewMode.isMode(VIEW_MODES.IMPORT),
    showSearchPage: viewMode.isMode(VIEW_MODES.SEARCH) || viewMode.isMode(VIEW_MODES.ADVANCED_SEARCH),
    showPreferences: viewMode.isMode(VIEW_MODES.PREFERENCES),
    // ...
  }), [viewMode.currentMode]);
  
  return (
    <UIContext.Provider value={{
      ...viewMode,
      ...navigation,
      ...screenVisibility,
    }}>
      {children}
    </UIContext.Provider>
  );
};
```

### Phase 3: データフェッチの改善（優先度: 中）

#### 3.1 React Query (TanStack Query)の導入

```javascript
// src/hooks/usePhotosQuery.js
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

export const usePhotosQuery = (fetchConfig) => {
  return useQuery({
    queryKey: ['photos', fetchConfig],
    queryFn: () => fetchPhotos(fetchConfig),
    staleTime: 5 * 60 * 1000, // 5分
    cacheTime: 10 * 60 * 1000, // 10分
  });
};

export const useInfinitePhotosQuery = (fetchConfig) => {
  return useInfiniteQuery({
    queryKey: ['photos', 'infinite', fetchConfig],
    queryFn: ({ pageParam = 0 }) => fetchPhotosPage(fetchConfig, pageParam),
    getNextPageParam: (lastPage, pages) => lastPage.nextPage,
  });
};
```

### Phase 4: キャッシュ管理の統一（優先度: 中）

#### 4.1 専用キャッシュサービスの作成

```javascript
// src/services/PhotoCacheService.js
class PhotoCacheService {
  constructor() {
    this.thumbnailCache = new Map();
    this.photoCache = new Map();
    this.tagCache = new Map();
  }
  
  getThumbnail(path) {
    return this.thumbnailCache.get(path);
  }
  
  setThumbnail(path, data) {
    this.thumbnailCache.set(path, data);
    this.cleanupIfNeeded();
  }
  
  cleanupIfNeeded() {
    if (this.thumbnailCache.size > 1000) {
      // LRU的なクリーンアップ
    }
  }
  
  clear() {
    this.thumbnailCache.clear();
    this.photoCache.clear();
    this.tagCache.clear();
  }
}

export const photoCacheService = new PhotoCacheService();
```

## 📝 実装計画

### Step 1: 準備（1週間）
- [ ] 既存コードのテストを追加
- [ ] state依存関係のドキュメント化
- [ ] リファクタリング対象の優先順位決定

### Step 2: Phase 1実装（2週間）
- [ ] usePhotoDisplay フックの作成とテスト
- [ ] usePhotoFilters フックの作成とテスト
- [ ] usePhotoSelection フックの作成とテスト
- [ ] PhotosList.jsxの段階的移行

### Step 3: Phase 2実装（2週間）
- [ ] useViewMode フックの作成
- [ ] UIContextのリファクタリング
- [ ] 画面遷移ロジックの統合テスト

### Step 4: Phase 3-4実装（3週間）
- [ ] React Queryの導入検討と実装
- [ ] キャッシュサービスの実装
- [ ] パフォーマンステスト

## 📈 成功指標

1. **コード量の削減**: PhotosList.jsxのコード行数を50%削減
2. **バグの減少**: state関連のバグレポートを80%削減
3. **開発速度の向上**: 新機能追加時間を30%短縮
4. **パフォーマンス**: 不要な再レンダリングを50%削減

## ⚠️ リスクと対策

### リスク1: 大規模なリファクタリングによる既存機能の破壊
**対策**: 
- 段階的な移行
- 包括的なテストの追加
- フィーチャーフラグの使用

### リスク2: 学習コストの増加
**対策**:
- ドキュメントの充実
- コードレビューの徹底
- ペアプログラミングの活用

### リスク3: パフォーマンスの劣化
**対策**:
- React DevToolsでのプロファイリング
- メモ化の適切な使用
- バンドルサイズの監視

## 🔄 段階的移行戦略

1. **新機能から適用**: 新しく追加する機能から新しいパターンを適用
2. **クリティカルパスを避ける**: 最初は影響の少ない部分から移行
3. **並行運用期間**: 新旧のコードを一時的に共存させる
4. **段階的な削除**: 古いコードは動作確認後に削除

## 📚 参考資料

- [React State Management Best Practices](https://react.dev/learn/managing-state)
- [Custom Hooks Pattern](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [State Machines in React](https://stately.ai/blog/state-machines-in-react)
- [React Query Documentation](https://tanstack.com/query/latest)

## 次のステップ

1. このプランのレビューと承認
2. Phase 1の詳細設計書の作成
3. テスト戦略の策定
4. 実装開始

---

*この計画は生きたドキュメントとして、実装の進捗に応じて更新されます。*