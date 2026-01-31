# Technical Implementation Plan

## Phase 1: PhotoCollection Base Architecture

### Step 1: PhotoCollection.js Extension
```javascript
// Add fetchPhotos method for existing modes
async fetchPhotos(page = 1, pageSize = 20) {
  switch (this.mode) {
    case 'date':
      const result = await invoke('get_photos_unified', {
        request: {
          type: "search",
          search_type: "date",
          query: this.metadata.date,
          sort_value: this.metadata.sortValue,
          page: page,
          limit: pageSize,
          // ... other params
        }
      });
      
      const data = JSON.parse(result);
      return this.withPhotos(data.photos)
                 .withMetadata({
                   hasNext: data.has_next,
                   currentPage: page
                 });
                 
    case 'recent':
      // Similar implementation
    case 'album':
      // Similar implementation
    // ...
  }
}
```

### Step 2: PhotosList.jsx Refactoring
```javascript
// Before: Direct API calls with mode switches
const getPhotos = async () => {
  switch (config.mode) {
    case "date":
      result = await invoke("get_photos_unified", { ... });
      break;
    // ...
  }
};

// After: PhotoCollection-based
const getPhotos = async () => {
  const newCollection = await photoCollection.fetchPhotos(currentPage, pageSize);
  setPhotoCollection(newCollection);
  setPhotos(newCollection.photos);
};
```

## Phase 2: Import Mode Integration

### Step 3: PhotoCollection Import Mode
```javascript
// Add import mode support
static createImportCollection(photos, currentImportPath, importPaths, importFilter = '') {
  return new PhotoCollection(photos, 'import', { 
    currentImportPath, 
    importPaths, 
    importFilter,
    importProgress: null,
    isImporting: false
  });
}

// Add to fetchPhotos method
case 'import':
  const result = await invoke('show_importer', {
    pathStr: this.metadata.currentImportPath,
    page,
    num: pageSize,
    dateStr: this.metadata.importFilter
  });
  
  const importerData = JSON.parse(result);
  
  return this.withPhotos(importerData.dirs_files.files.files)
             .withMetadata({
               hasNextFile: importerData.dirs_files.has_next_file,
               hasPrevFile: importerData.dirs_files.has_prev_file,
               page: importerData.page,
               directories: importerData.dirs_files.dirs.dirs,
               importPaths: importerData.paths
             });
```

### Step 4: DirectoryMenu Extension
```javascript
// Add Directory tab rendering
const isImportMode = viewMode === VIEW_MODES.IMPORT;

// Conditional tab visibility
const availableTabs = photoCollection?.getAvailableTabs() || defaultTabs;

// Directory tab component (extracted from Importer.jsx)
const DirectoryTab = ({ photoCollection, onDirectoryChange, onFilterChange }) => {
  const { currentImportPath, importPaths, importFilter, directories } = 
    photoCollection.getImportMetadata();
    
  return (
    <div id="tab-directory">
      {/* Directory navigation UI */}
    </div>
  );
};
```

## Benefits

### Code Reuse
- 既存のサムネイル表示ロジック流用
- 統一されたselection UI
- フィルター機能の再利用

### Maintainability
- 単一のコンポーネントでの写真表示ロジック
- 既存のstate管理パターン活用
- テスト対象の統合

## Migration Strategy

### Data Structure Adaptation ✅ 
- **不要！** Importer APIの戻り値はPhotosList形式とほぼ同じ
- ページングロジックもそのまま利用可能

### State Management
- PhotoCollectionでimport状態をカプセル化
- UIContextは既存のviewMode管理のみ

### Directory Navigation UX ✅
- **解決済み！** タブシステム活用でレイアウト問題なし
- 既存のレスポンシブ対応をそのまま活用