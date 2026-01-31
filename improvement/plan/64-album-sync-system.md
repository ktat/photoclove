# Album Google Photos Sync System

## Overview
Implement a comprehensive Google Photos synchronization system for albums, including global sync settings, per-album configuration, sync status monitoring, and bulk operations. This extends the basic per-album sync settings from improvement #72.

## Problem
While improvement #72 includes basic per-album sync settings, PhotoClove needs a complete sync system that provides:
- Global sync configuration and defaults
- Hierarchical settings (global + per-album overrides)
- Sync status monitoring and progress tracking
- Bulk sync operations for multiple albums
- Sync history and error handling

## Implementation Plan

### 1. Global Sync Configuration (Preferences)
Add comprehensive Google Photos sync settings to Preferences panel:

```jsx
// In Preferences.jsx - Google Photos section
<div className="google-photos-sync-section">
  <h3>Google Photos Album Sync</h3>
  
  {/* Global Enable/Disable */}
  <label>
    <input 
      type="checkbox" 
      checked={globalSyncSettings.enabled}
      onChange={(e) => updateGlobalSync({ enabled: e.target.checked })}
    />
    Enable album synchronization with Google Photos
  </label>

  {globalSyncSettings.enabled && (
    <div className="sync-global-settings">
      {/* Default Sync Frequency */}
      <div className="setting-group">
        <label>Default sync frequency for new albums:</label>
        <select 
          value={globalSyncSettings.defaultFrequency}
          onChange={(e) => updateGlobalSync({ defaultFrequency: e.target.value })}
        >
          <option value="manual">Manual only</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Auto-sync New Albums */}
      <label>
        <input 
          type="checkbox"
          checked={globalSyncSettings.autoSyncNewAlbums}
          onChange={(e) => updateGlobalSync({ autoSyncNewAlbums: e.target.checked })}
        />
        Automatically enable sync for newly created albums
      </label>

      {/* Maintain Album Structure */}
      <label>
        <input 
          type="checkbox"
          checked={globalSyncSettings.maintainStructure}
          onChange={(e) => updateGlobalSync({ maintainStructure: e.target.checked })}
        />
        Maintain album structure in Google Photos (default)
      </label>

      {/* Sync Quality Settings */}
      <div className="setting-group">
        <label>Upload quality:</label>
        <select 
          value={globalSyncSettings.uploadQuality}
          onChange={(e) => updateGlobalSync({ uploadQuality: e.target.value })}
        >
          <option value="original">Original quality</option>
          <option value="high">High quality (compressed)</option>
        </select>
      </div>

      {/* Sync Behavior */}
      <div className="setting-group">
        <label>When photos are added to album:</label>
        <select 
          value={globalSyncSettings.addBehavior}
          onChange={(e) => updateGlobalSync({ addBehavior: e.target.value })}
        >
          <option value="immediate">Sync immediately</option>
          <option value="scheduled">Wait for next scheduled sync</option>
          <option value="manual">Manual sync only</option>
        </select>
      </div>

      {/* Deletion Behavior */}
      <div className="setting-group">
        <label>When photos are removed from album:</label>
        <select 
          value={globalSyncSettings.removeBehavior}
          onChange={(e) => updateGlobalSync({ removeBehavior: e.target.value })}
        >
          <option value="remove">Remove from Google Photos album</option>
          <option value="keep">Keep in Google Photos album</option>
          <option value="ask">Ask each time</option>
        </select>
      </div>
    </div>
  )}
</div>
```

### 2. Enhanced Per-Album Sync Settings (Improvement #72 Extension)
Extend the Album tab with comprehensive sync configuration:

```jsx
// Enhanced AlbumTab sync section
<div className="sync-section">
  <h3>Google Photos Sync</h3>
  
  {/* Override Global Settings */}
  <label>
    <input
      type="checkbox"
      checked={albumSyncSettings.overrideGlobal}
      onChange={(e) => setAlbumSync({ overrideGlobal: e.target.checked })}
    />
    Override global sync settings for this album
  </label>

  {albumSyncSettings.overrideGlobal ? (
    <div className="album-sync-overrides">
      {/* Custom album sync settings */}
      <div className="setting-group">
        <label>Sync frequency:</label>
        <select 
          value={albumSyncSettings.frequency}
          onChange={(e) => setAlbumSync({ frequency: e.target.value })}
        >
          <option value="manual">Manual only</option>
          <option value="immediate">Immediate</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <label>
        <input
          type="checkbox"
          checked={albumSyncSettings.maintainStructure}
          onChange={(e) => setAlbumSync({ maintainStructure: e.target.checked })}
        />
        Maintain album structure in Google Photos
      </label>

      <div className="setting-group">
        <label>Upload quality:</label>
        <select 
          value={albumSyncSettings.uploadQuality}
          onChange={(e) => setAlbumSync({ uploadQuality: e.target.value })}
        >
          <option value="original">Original quality</option>
          <option value="high">High quality (compressed)</option>
        </select>
      </div>
    </div>
  ) : (
    <div className="global-settings-display">
      <p>Using global settings:</p>
      <ul>
        <li>Frequency: {globalSyncSettings.defaultFrequency}</li>
        <li>Upload quality: {globalSyncSettings.uploadQuality}</li>
        <li>Maintain structure: {globalSyncSettings.maintainStructure ? 'Yes' : 'No'}</li>
      </ul>
    </div>
  )}

  {/* Sync Status */}
  <div className="sync-status">
    <h4>Sync Status</h4>
    <div className="status-info">
      <div>Status: <span className={`status-${albumSyncStatus.status}`}>{albumSyncStatus.statusText}</span></div>
      <div>Last sync: {albumSyncStatus.lastSync || 'Never'}</div>
      <div>Next sync: {albumSyncStatus.nextSync || 'Not scheduled'}</div>
      {albumSyncStatus.error && (
        <div className="sync-error">Error: {albumSyncStatus.error}</div>
      )}
    </div>
  </div>

  {/* Manual Sync Actions */}
  <div className="sync-actions">
    <button 
      onClick={syncAlbumNow} 
      disabled={albumSyncStatus.status === 'syncing'}
      className="sync-now-button"
    >
      {albumSyncStatus.status === 'syncing' ? 'Syncing...' : '🔄 Sync Now'}
    </button>
    
    <button onClick={viewSyncHistory} className="sync-history-button">
      📋 View Sync History
    </button>
  </div>
</div>
```

### 3. Sync Status Monitoring
Create a comprehensive sync status system:

```jsx
// SyncStatusMonitor.jsx
const SyncStatusMonitor = ({ albumId, onStatusUpdate }) => {
  const [syncStatus, setSyncStatus] = useState({
    status: 'idle', // 'idle', 'syncing', 'completed', 'error', 'paused'
    progress: 0,
    totalPhotos: 0,
    syncedPhotos: 0,
    failedPhotos: 0,
    currentOperation: '',
    startTime: null,
    estimatedCompletion: null,
    errors: []
  });

  const [syncHistory, setSyncHistory] = useState([]);

  // Real-time sync monitoring
  useEffect(() => {
    let unlisten;
    
    const setupSyncListener = async () => {
      unlisten = await listen(`album_sync_${albumId}`, (event) => {
        const { type, data } = event.payload;
        
        switch (type) {
          case 'sync_started':
            setSyncStatus(prev => ({
              ...prev,
              status: 'syncing',
              startTime: new Date(),
              totalPhotos: data.totalPhotos,
              currentOperation: 'Preparing sync...'
            }));
            break;
            
          case 'sync_progress':
            setSyncStatus(prev => ({
              ...prev,
              progress: data.progress,
              syncedPhotos: data.completed,
              currentOperation: data.operation,
              estimatedCompletion: data.estimatedCompletion
            }));
            break;
            
          case 'sync_completed':
            setSyncStatus(prev => ({
              ...prev,
              status: 'completed',
              progress: 100,
              currentOperation: 'Sync completed'
            }));
            addToSyncHistory('completed', data);
            break;
            
          case 'sync_error':
            setSyncStatus(prev => ({
              ...prev,
              status: 'error',
              errors: [...prev.errors, data.error]
            }));
            break;
        }
      });
    };
    
    setupSyncListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, [albumId]);

  return (
    <div className="sync-status-monitor">
      {syncStatus.status === 'syncing' && (
        <div className="sync-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${syncStatus.progress}%` }}
            />
          </div>
          <div className="progress-text">
            {syncStatus.currentOperation} ({syncStatus.syncedPhotos}/{syncStatus.totalPhotos})
          </div>
          {syncStatus.estimatedCompletion && (
            <div className="eta">
              Estimated completion: {syncStatus.estimatedCompletion}
            </div>
          )}
        </div>
      )}
      
      {syncStatus.errors.length > 0 && (
        <div className="sync-errors">
          <h4>Sync Errors:</h4>
          {syncStatus.errors.map((error, index) => (
            <div key={index} className="error-item">{error}</div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### 4. Bulk Sync Operations
Add bulk sync functionality to album list view:

```jsx
// In AlbumList or PhotosList album mode
<div className="bulk-sync-operations">
  <div className="bulk-actions">
    <button onClick={selectAllAlbums}>Select All</button>
    <button onClick={clearSelection}>Clear Selection</button>
    <span>{selectedAlbums.length} albums selected</span>
  </div>
  
  {selectedAlbums.length > 0 && (
    <div className="bulk-sync-actions">
      <button onClick={syncSelectedAlbums} className="bulk-sync-button">
        🔄 Sync Selected Albums ({selectedAlbums.length})
      </button>
      <button onClick={configureBulkSync} className="bulk-config-button">
        ⚙️ Configure Bulk Sync
      </button>
    </div>
  )}
  
  {/* Bulk sync progress */}
  {bulkSyncStatus.active && (
    <div className="bulk-sync-progress">
      <h4>Bulk Sync Progress</h4>
      <div className="album-sync-list">
        {bulkSyncStatus.albums.map(album => (
          <div key={album.id} className={`album-sync-item status-${album.status}`}>
            <span className="album-name">{album.name}</span>
            <span className="sync-status">{album.statusText}</span>
            {album.progress > 0 && (
              <div className="mini-progress-bar">
                <div 
                  className="mini-progress-fill" 
                  style={{ width: `${album.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )}
</div>
```

### 5. Sync History and Logging
Comprehensive sync history tracking:

```jsx
// SyncHistory.jsx
const SyncHistory = ({ albumId }) => {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'success', 'error'

  const loadSyncHistory = async () => {
    try {
      const historyData = await invoke('get_album_sync_history', { albumId });
      setHistory(historyData);
    } catch (error) {
      logger.error('SyncHistory', 'load_failed', 'Failed to load sync history', { albumId, error: error.message });
    }
  };

  return (
    <div className="sync-history">
      <div className="history-controls">
        <h3>Sync History</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All syncs</option>
          <option value="success">Successful only</option>
          <option value="error">Errors only</option>
        </select>
      </div>
      
      <div className="history-list">
        {history
          .filter(entry => filter === 'all' || entry.status === filter)
          .map(entry => (
            <div key={entry.id} className={`history-entry status-${entry.status}`}>
              <div className="entry-header">
                <span className="timestamp">{new Date(entry.timestamp).toLocaleString()}</span>
                <span className={`status-badge status-${entry.status}`}>{entry.status}</span>
              </div>
              <div className="entry-details">
                <div>Photos: {entry.photosProcessed} processed, {entry.photosUploaded} uploaded</div>
                <div>Duration: {entry.duration}</div>
                {entry.error && (
                  <div className="error-message">Error: {entry.error}</div>
                )}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
};
```

## Files to Create
- `src/components/SyncStatusMonitor.jsx` - Real-time sync progress monitoring
- `src/components/SyncHistory.jsx` - Sync history viewer
- `src/components/BulkSyncOperations.jsx` - Bulk sync controls
- `src/hooks/useGooglePhotosSync.js` - Sync state management hook

## Files to Modify
- `src/App/Preferences.jsx` - Add global sync configuration
- `src/App/PhotosList/AlbumTab.jsx` - Enhanced per-album sync settings (from #72)
- `src/App/AlbumList.jsx` - Add bulk sync operations (from #71)
- `src-tauri/src/lib.rs` - Add sync-related commands

## Backend Integration

### New Tauri Commands
```rust
// Global sync configuration
#[tauri::command]
async fn get_global_sync_settings() -> Result<GlobalSyncSettings, PhotoCloveError>

#[tauri::command]
async fn update_global_sync_settings(settings: GlobalSyncSettings) -> Result<(), PhotoCloveError>

// Album sync operations
#[tauri::command]
async fn sync_album_to_google_photos(album_id: i32, options: SyncOptions) -> Result<SyncResult, PhotoCloveError>

#[tauri::command]
async fn get_album_sync_status(album_id: i32) -> Result<AlbumSyncStatus, PhotoCloveError>

#[tauri::command]
async fn get_album_sync_history(album_id: i32) -> Result<Vec<SyncHistoryEntry>, PhotoCloveError>

// Bulk operations
#[tauri::command]
async fn bulk_sync_albums(album_ids: Vec<i32>, options: SyncOptions) -> Result<BulkSyncResult, PhotoCloveError>

#[tauri::command]
async fn get_bulk_sync_status(sync_id: String) -> Result<BulkSyncStatus, PhotoCloveError>

// Sync scheduling
#[tauri::command]
async fn schedule_album_sync(album_id: i32, frequency: String) -> Result<(), PhotoCloveError>

#[tauri::command]
async fn pause_album_sync(album_id: i32) -> Result<(), PhotoCloveError>

#[tauri::command]
async fn resume_album_sync(album_id: i32) -> Result<(), PhotoCloveError>
```

## Database Schema Extensions
```sql
-- Global sync settings
CREATE TABLE google_photos_sync_config (
    id INTEGER PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    default_frequency TEXT DEFAULT 'manual',
    auto_sync_new_albums BOOLEAN DEFAULT FALSE,
    maintain_structure BOOLEAN DEFAULT TRUE,
    upload_quality TEXT DEFAULT 'high',
    add_behavior TEXT DEFAULT 'scheduled',
    remove_behavior TEXT DEFAULT 'ask'
);

-- Per-album sync settings
CREATE TABLE album_sync_settings (
    album_id INTEGER PRIMARY KEY,
    override_global BOOLEAN DEFAULT FALSE,
    frequency TEXT,
    maintain_structure BOOLEAN,
    upload_quality TEXT,
    last_sync TIMESTAMP,
    next_sync TIMESTAMP,
    sync_enabled BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (album_id) REFERENCES albums(id)
);

-- Sync history
CREATE TABLE album_sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status TEXT, -- 'success', 'error', 'cancelled'
    photos_processed INTEGER DEFAULT 0,
    photos_uploaded INTEGER DEFAULT 0,
    photos_failed INTEGER DEFAULT 0,
    error_message TEXT,
    FOREIGN KEY (album_id) REFERENCES albums(id)
);
```

## User Workflows

### Configure Global Sync
1. User opens Preferences → Google Photos section
2. Enables album sync and configures defaults
3. Sets sync frequency, quality, and behavior preferences
4. Settings apply to new albums automatically

### Configure Per-Album Sync
1. User viewing album opens Album tab
2. Chooses to override global settings
3. Customizes sync frequency and options for this album
4. Saves settings and optionally syncs immediately

### Monitor Sync Progress
1. User initiates album sync
2. Real-time progress display shows current operation
3. Can view detailed sync history
4. Receives notifications on completion or errors

### Bulk Sync Operations
1. User in album list selects multiple albums
2. Clicks "Sync Selected Albums"
3. Can configure bulk sync options
4. Monitors progress for all selected albums

## Success Criteria
- Global sync settings persist and apply correctly
- Per-album overrides work hierarchically
- Real-time sync progress updates reliably
- Bulk operations handle multiple albums efficiently
- Sync history provides useful debugging information
- Error handling and recovery work properly

## Integration with Improvements
- **#71**: Album list shows sync status indicators
- **#72**: Album tab includes enhanced sync configuration
- **#73**: Selection operations can trigger sync
- **#74**: Tutorials explain sync features
- **#75**: Sync operations respect context-aware safety

## Future Enhancements
- Smart sync scheduling based on usage patterns
- Conflict resolution for modified photos
- Selective sync (sync only certain photos in album)
- Integration with other cloud services
- Sync bandwidth throttling and scheduling

keep context