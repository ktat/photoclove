# カスタムフック完全ガイド

## 📚 カスタムフックとは？

カスタムフックは、Reactのステートフルなロジックを再利用可能な関数として抽出したものです。名前は必ず`use`で始まり、内部で他のフック（useState、useEffect等）を呼び出すことができます。

### 基本的な構造

```javascript
// ❌ 通常の関数（フックではない）- 初回のサイズしか取得できない
function getWindowSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

// ✅ カスタムフック - リアルタイムでサイズ変更を追跡
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}
```

## 🎯 カスタムフックのメリット

### 1. ロジックの再利用性

**Before（カスタムフックなし）:**
```javascript
// 通常の関数は使えるが、リアルタイム更新ができない
function getWindowSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

// ResponsiveNavbar.jsx
function ResponsiveNavbar() {
  // 初期値は getWindowSize() を使えるが...
  const [windowSize, setWindowSize] = useState(getWindowSize());

  // 結局、リサイズイベントのロジックを各コンポーネントで重複して書く必要がある
  useEffect(() => {
    const handleResize = () => {
      setWindowSize(getWindowSize()); // 関数は使えるが、ロジックの重複は避けられない
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowSize.width < 768;

  return (
    <nav>
      {isMobile ? <MobileMenu /> : <DesktopMenu />}
    </nav>
  );
}

// ResponsiveGrid.jsx - 同じロジックを重複して書く必要がある
function ResponsiveGrid() {
  const [windowSize, setWindowSize] = useState(getWindowSize());

  // 同じイベントリスナーのロジックを再度書かなければならない
  useEffect(() => {
    const handleResize = () => {
      setWindowSize(getWindowSize());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const columns = windowSize.width > 1200 ? 4 : windowSize.width > 768 ? 3 : 1;

  return (
    <div style={{ columns }}>
      {/* グリッドアイテム */}
    </div>
  );
}
```

**After（カスタムフック使用）:**
```javascript
// hooks/useWindowSize.js
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

// ResponsiveNavbar.jsx
function ResponsiveNavbar() {
  const { width } = useWindowSize();
  const isMobile = width < 768;

  return (
    <nav>
      {isMobile ? <MobileMenu /> : <DesktopMenu />}
    </nav>
  );
}

// ResponsiveGrid.jsx
function ResponsiveGrid() {
  const { width } = useWindowSize();
  const columns = width > 1200 ? 4 : width > 768 ? 3 : 1;

  return (
    <div style={{ columns }}>
      {/* グリッドアイテム */}
    </div>
  );
}
```

### 2. 関心の分離（Separation of Concerns）

**Before:**
```javascript
function ResponsiveDashboard() {
  // ウィンドウサイズ管理
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // レスポンシブロジック
  const isMobile = windowSize.width < 768;
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024;
  const isDesktop = windowSize.width >= 1024;
  
  // ダッシュボードデータ管理
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // UIロジックとビジネスロジックが混在している
  return (
    <div>
      {isMobile && <MobileDashboard />}
      {isTablet && <TabletDashboard />}
      {isDesktop && <DesktopDashboard />}
    </div>
  );
}
```

**After:**
```javascript
function ResponsiveDashboard() {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const { data, loading } = useDashboardData();
  
  return (
    <div>
      {isMobile && <MobileDashboard data={data} loading={loading} />}
      {isTablet && <TabletDashboard data={data} loading={loading} />}
      {isDesktop && <DesktopDashboard data={data} loading={loading} />}
    </div>
  );
}

// hooks/useResponsive.js - レスポンシブロジックのみに集中
function useResponsive() {
  const { width } = useWindowSize();
  
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024
  };
}
```

### 3. テストの容易性

カスタムフックは独立してテストできます：

```javascript
// useWindowSize.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import useWindowSize from './useWindowSize';

// モックしてテストの信頼性を向上
const mockWindow = {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: mockWindow.innerWidth
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: mockWindow.innerHeight
});

test('初期のwindowサイズを正しく取得する', () => {
  const { result } = renderHook(() => useWindowSize());
  
  expect(result.current.width).toBe(1024);
  expect(result.current.height).toBe(768);
});

test('resizeイベントリスナーが正しく設定される', () => {
  renderHook(() => useWindowSize());
  
  // addEventListener が呼ばれることを確認
  expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
});

test('useResponsiveフックも独立してテスト可能', () => {
  // useWindowSizeをモック
  jest.mock('./useWindowSize', () => ({
    __esModule: true,
    default: () => ({ width: 800, height: 600 })
  }));
  
  const { result } = renderHook(() => useResponsive());
  
  expect(result.current.isMobile).toBe(false);
  expect(result.current.isTablet).toBe(true);
  expect(result.current.isDesktop).toBe(false);
});
```

### 4. コンポーネントの簡潔性

**Before（複雑なコンポーネント）:**
```javascript
function ResponsiveLayout() {
  // ウィンドウサイズ管理
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // デバイス判定ロジック
  const isMobile = windowSize.width < 768;
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024;
  const isDesktop = windowSize.width >= 1024;

  // レイアウト計算
  const sidebarWidth = isDesktop ? 250 : isMobile ? 0 : 200;
  const headerHeight = isMobile ? 60 : 80;
  const columns = isDesktop ? 3 : isTablet ? 2 : 1;

  // スタイル計算
  const layoutStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile 
      ? '1fr' 
      : `${sidebarWidth}px 1fr`,
    gridTemplateRows: `${headerHeight}px 1fr`,
    height: '100vh'
  };

  const contentStyle = {
    padding: isMobile ? '10px' : '20px',
    overflow: 'auto'
  };

  // 50行以上の複雑なロジックとJSX...
  return (
    <div style={layoutStyle}>
      <Header height={headerHeight} isMobile={isMobile} />
      {!isMobile && <Sidebar width={sidebarWidth} />}
      <main style={contentStyle}>
        <ContentGrid columns={columns} />
      </main>
    </div>
  );
}
```

**After（シンプルなコンポーネント）:**
```javascript
function ResponsiveLayout() {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const layoutStyle = useLayoutStyle({ isMobile, isTablet, isDesktop });
  
  return (
    <div style={layoutStyle.container}>
      <Header style={layoutStyle.header} isMobile={isMobile} />
      {!isMobile && <Sidebar style={layoutStyle.sidebar} />}
      <main style={layoutStyle.content}>
        <ContentGrid columns={layoutStyle.columns} />
      </main>
    </div>
  );
}

// hooks/useLayoutStyle.js - レイアウト計算ロジックを分離
function useLayoutStyle({ isMobile, isTablet, isDesktop }) {
  return useMemo(() => {
    const sidebarWidth = isDesktop ? 250 : isTablet ? 200 : 0;
    const headerHeight = isMobile ? 60 : 80;
    const columns = isDesktop ? 3 : isTablet ? 2 : 1;

    return {
      container: {
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `${sidebarWidth}px 1fr`,
        gridTemplateRows: `${headerHeight}px 1fr`,
        height: '100vh'
      },
      header: { height: headerHeight },
      sidebar: { width: sidebarWidth },
      content: { 
        padding: isMobile ? '10px' : '20px',
        overflow: 'auto' 
      },
      columns
    };
  }, [isMobile, isTablet, isDesktop]);
}
```

### 5. ロジックの一貫性

複数のコンポーネントで同じロジックを使用することで、動作の一貫性が保証されます：

```javascript
// useResponsive.js - レスポンシブロジックを一箇所に集約
function useResponsive() {
  const { width } = useWindowSize();
  
  // ブレークポイントが一箇所で管理される
  const breakpoints = {
    mobile: 768,
    tablet: 1024,
    desktop: 1200
  };
  
  return {
    isMobile: width < breakpoints.mobile,
    isTablet: width >= breakpoints.mobile && width < breakpoints.tablet,
    isDesktop: width >= breakpoints.tablet,
    isLargeDesktop: width >= breakpoints.desktop,
    width
  };
}

// どのコンポーネントでも同じブレークポイント判定を使用
function Navigation() {
  const { isMobile } = useResponsive();
  
  return isMobile ? <MobileNav /> : <DesktopNav />;
}

function Gallery() {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const columns = isMobile ? 1 : isTablet ? 2 : 3;
  
  return <PhotoGrid columns={columns} />;
}

function Sidebar() {
  const { isMobile } = useResponsive();
  
  // 全てのコンポーネントで同じ判定基準が使われる
  return isMobile ? null : <SidebarContent />;
}
```

**メリット：**
- ブレークポイントの変更が必要な場合、1箇所を修正するだけで全体に反映される
- 全コンポーネントで一貫した動作が保証される
- バグの原因となる判定基準の不一致を防げる

## 🚀 PhotoCloveでの具体的な活用例

### 現在の問題：PhotosList.jsxの複雑性

```javascript
// 現在：1つのコンポーネントに全てが詰め込まれている
function PhotosList() {
  // 写真表示関連（8個のstate）
  const [photos, setPhotos] = useState([]);
  const [allPhotosForCurrentFetch, setAllPhotosForCurrentFetch] = useState([]);
  const [currentPhotoPath, setCurrentPhotoPath] = useState("");
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [displayedPhotoCount, setDisplayedPhotoCount] = useState(50);
  const [iconSize, setIconSize] = useState(170);
  
  // フィルター関連（4個のstate）
  const [starFilter, setStarFilter] = useState(0);
  const [hasCommentFilter, setHasCommentFilter] = useState(false);
  const [extensionFilter, setExtensionFilter] = useState("all");
  const [filterOptions, setFilterOptions] = useState({});
  
  // ... 他にも30個以上のstate
  
  // 複雑なロジックが混在
  // ... 1000行以上のコード
}
```

### 解決策：カスタムフックへの分割

```javascript
// hooks/usePhotoDisplay.js
export function usePhotoDisplay(fetchConfig) {
  const [photos, setPhotos] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke('get_photos', { config: fetchConfig });
      setPhotos(result);
    } finally {
      setLoading(false);
    }
  }, [fetchConfig]);
  
  const navigatePhoto = useCallback((direction) => {
    setCurrentPhotoIndex(prev => {
      if (direction === 'next') {
        return Math.min(prev + 1, photos.length - 1);
      } else {
        return Math.max(prev - 1, 0);
      }
    });
  }, [photos.length]);
  
  return {
    photos,
    currentPhoto: photos[currentPhotoIndex],
    currentPhotoIndex,
    loading,
    loadPhotos,
    navigatePhoto
  };
}

// hooks/usePhotoFilters.js  
export function usePhotoFilters() {
  const [filters, setFilters] = useState({
    star: 0,
    hasComment: false,
    extension: 'all'
  });
  
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const resetFilters = useCallback(() => {
    setFilters({
      star: 0,
      hasComment: false,
      extension: 'all'
    });
  }, []);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.star > 0) count++;
    if (filters.hasComment) count++;
    if (filters.extension !== 'all') count++;
    return count;
  }, [filters]);
  
  return {
    filters,
    updateFilter,
    resetFilters,
    activeFilterCount
  };
}

// 新しいPhotosList.jsx - シンプルで理解しやすい
function PhotosList({ fetchConfig }) {
  const { photos, currentPhoto, loading, loadPhotos } = usePhotoDisplay(fetchConfig);
  const { filters, updateFilter, activeFilterCount } = usePhotoFilters();
  const { selectedPhotos, toggleSelection } = usePhotoSelection();
  
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);
  
  const filteredPhotos = useMemo(() => {
    return photos.filter(photo => {
      if (filters.star > 0 && photo.star < filters.star) return false;
      if (filters.hasComment && !photo.comment) return false;
      if (filters.extension !== 'all' && photo.extension !== filters.extension) return false;
      return true;
    });
  }, [photos, filters]);
  
  return (
    <div className="photos-list">
      <FilterBar 
        filters={filters} 
        onFilterChange={updateFilter}
        activeCount={activeFilterCount}
      />
      {loading ? (
        <PhotoLoading />
      ) : (
        <PhotoGrid 
          photos={filteredPhotos}
          selectedPhotos={selectedPhotos}
          onPhotoClick={toggleSelection}
        />
      )}
    </div>
  );
}
```

## 💡 ベストプラクティス

### 1. 命名規則
- 必ず`use`で始める
- 機能を明確に表す名前にする
- 例：`useUser`, `useAuth`, `useWindowSize`

### 2. 単一責任の原則
- 1つのカスタムフックは1つの責任を持つ
- 大きくなりすぎたら分割を検討

### 3. 依存関係の管理
```javascript
// ✅ Good: 依存関係を明確にする
function usePhotoLoader(photoId) {
  const [photo, setPhoto] = useState(null);
  
  useEffect(() => {
    loadPhoto(photoId).then(setPhoto);
  }, [photoId]); // photoIdが変わったら再読み込み
  
  return photo;
}

// ❌ Bad: 依存関係が不明確
function usePhotoLoader(photoId) {
  const [photo, setPhoto] = useState(null);
  
  useEffect(() => {
    loadPhoto(photoId).then(setPhoto);
  }, []); // photoIdの変更を検知しない！
  
  return photo;
}
```

### 4. エラーハンドリング
```javascript
function useAsyncData(asyncFunction) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await asyncFunction();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [asyncFunction]);
  
  return { data, loading, error };
}
```

## 🎉 まとめ

カスタムフックを使用することで：

1. **コードの再利用性**が向上し、DRY原則を守れる
2. **コンポーネントがシンプル**になり、可読性が向上
3. **テストが書きやすく**なり、品質が向上
4. **チーム開発**で一貫性のあるコードが書ける
5. **バグの減少**と**開発速度の向上**が期待できる

PhotoCloveのような複雑なアプリケーションでは、カスタムフックの活用は特に重要です。現在のPhotosList.jsxの1000行以上のコードを、複数の小さなカスタムフックに分割することで、保守性と拡張性が大幅に向上します。