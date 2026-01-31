# UI Design for Import Integration

## UI Architecture

### Import Mode Layout:
```
[PhotosList with Import Mode]
[DirectoryMenu Tabs (Right Side)]
├── Directory Tab (NEW) ← ディレクトリナビゲーション + 日付フィルター
└── Selection Tab ← インポート操作

Note: Maintenance Tab は Import Mode 時は非表示
```

## Directory Tab Design

### Components:
```javascript
<div id="tab-directory" className={props.tabClass['directory'] ? "tab-active" : "tab"}>
  {/* Import paths list */}
  <ul className="list-of-import-path">
    <li><strong>Import Photos From</strong>:</li>
    {importPaths.map((p, i) => (
      <li key={i}><a href="#" onClick={() => onDirectoryChange(p)}>{p}</a></li>
    ))}
  </ul>
  
  {/* Current directory */}
  <p>{currentImportPath}:</p>
  
  {/* Date filter - integrated with directory selection */}
  <div style={{ marginBottom: '10px' }}>
    <label>Created Date: after </label>
    <input 
      type="date" 
      value={importFilter} 
      onChange={(e) => setImportFilter(e.target.value)} 
    />
  </div>
  
  {/* Directory navigation */}
  <ul>
    {/* Parent directory */}
    <li><a href="#" onClick={() => onDirectoryChange(currentImportPath + "/..")}>../</a></li>
    
    {/* Subdirectories */}
    {directories.map((dir, i) => (
      <li key={i}>
        📁 <a href="#" onClick={() => onDirectoryChange(dir.path)}>{dir.name}</a>
      </li>
    ))}
  </ul>
</div>
```

## Selection Tab Design

### Import Operations:
```javascript
{isImportMode && props.photoSelection.length > 0 && (
  <div className="operation">
    <select onChange={(e) => doImportOperation(e)}>
      <option value="select">Select an Operation</option>
      <option value="importSelected">Import Selected Photos</option>
      <option value="selectAllInDirectory">Select All in This Directory</option>
      <option value="unselectAll">Unselect All</option>
    </select>
  </div>
)}

// Import Progress Display
{importProgress && (
  <div className="import-progress">
    <div>Progress: {importProgress.progress}%</div>
    <div>Current: {importProgress.current_file}</div>
  </div>
)}
```

## PhotoCollection Tab Control

### Available tabs for import mode:
```javascript
getAvailableTabs() {
  // ...existing cases...
  case 'import':
    return [
      { id: 'directory', label: 'Directory', icon: '📁' },
      { id: 'selection', label: 'Selection', icon: '☑️' }
    ];
}
```

## Benefits

### UX Consistency ✨
- 他の画面と同じサムネイル表示
- **既存のタブシステム活用** - ユーザーが慣れ親しんだUI
- 統一されたキーボードショートカット  
- 一貫したselection体験
- **画面分割なし** - PhotosListがフル幅で表示可能