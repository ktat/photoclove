# Album Navigation and List View

## Overview
Implement the core album navigation foundation by adding Albums navigation icon and PhotosList album list mode. This creates the basic infrastructure for viewing and accessing albums.

## Problem
PhotoClove currently has album backend functionality (improvement #56) but no frontend way to browse or access albums. Users need a way to navigate to albums and see their album collection.

## Implementation Plan

### 1. Add Albums Navigation Icon
- Add 📚 Albums icon to main navigation bar (alongside Home, Search, Import)
- Position: `src/App.jsx` navigation icons section
- Clicking Albums icon switches PhotosList to "album list mode"

### 2. PhotosList Album List Mode
Extend PhotosList.jsx to support displaying albums as a photo grid:

```javascript
// PhotosList modes
const VIEW_MODES = {
  DATE: 'date',           // Current: photos from selected date
  SEARCH: 'search',       // Current: search results  
  ALBUM: 'album',         // New: photos from selected album
  ALBUM_LIST: 'album_list' // New: albums as photo grid
};
```

### 3. Album Cover Display
- Use album cover photo as "thumbnail" in grid
- Default cover: first photo in album
- Empty albums: placeholder icon
- Show album name and photo count overlay

### 4. Album Grid Layout
Reuse existing PhotosList grid with album-specific adaptations:
- Larger tile size for better album identification
- Album metadata overlay (name, count)
- Click behavior: switch to album view mode

### 5. Simple Album Filtering
Add name-based search above album grid:
```jsx
<input 
  placeholder="Search albums..." 
  onChange={(e) => filterAlbums(e.target.value)}
  className="album-search"
/>
```

## Files to Create
- None (extend existing PhotosList.jsx)

## Files to Modify
- `src/App.jsx` - Add Albums navigation icon and routing
- `src/App/PhotosList.jsx` - Add album list mode support
- `src/context/UIContext.jsx` - Add album navigation state
- `src/context/PhotoContext.jsx` - Add album state management

## Implementation Details

### App.jsx Navigation
```jsx
// Add to navigation icons
<a href="#" onClick={() => {
  toggleAlbumListMode();
}} title="Albums">📚</a>
```

### PhotosList Album List Mode
```javascript
// Album list loading
const getAlbums = async () => {
  try {
    const albums = await invoke("get_all_albums");
    return albums.map(album => ({
      id: album.id,
      name: album.name,
      description: album.description,
      photoCount: album.photo_count,
      coverPhoto: album.cover_photo_path || null,
      createdAt: album.created_at
    }));
  } catch (error) {
    handleTauriError(error, 'Load albums');
    return [];
  }
};

// Album grid rendering
const renderAlbumGrid = () => {
  return filteredAlbums.map(album => (
    <div 
      key={album.id}
      className="album-tile"
      onClick={() => openAlbum(album)}
    >
      <div className="album-cover">
        {album.coverPhoto ? (
          <img src={convertFileSrc(album.coverPhoto)} alt={album.name} />
        ) : (
          <div className="album-placeholder">📚</div>
        )}
      </div>
      <div className="album-info">
        <div className="album-name">{album.name}</div>
        <div className="album-count">{album.photoCount} photos</div>
      </div>
    </div>
  ));
};
```

### Context State Management
```javascript
// UIContext additions
const [viewMode, setViewMode] = useState('date');
const [currentAlbumId, setCurrentAlbumId] = useState(null);

const toggleAlbumListMode = () => {
  setViewMode('album_list');
  setCurrentAlbumId(null);
};

const openAlbum = (album) => {
  setViewMode('album');
  setCurrentAlbumId(album.id);
};
```

## User Workflow
1. User clicks 📚 Albums icon in navigation
2. PhotosList switches to album list mode
3. Shows all albums as grid with cover photos
4. User can search/filter albums by name
5. Click album cover → opens album in album view mode
6. Album view shows photos from that album

## Backend Integration
- Uses existing `get_all_albums` command from improvement #56
- No new backend commands needed
- Leverages existing photo loading for album covers

## Visual Design
- Album tiles: Larger than photo thumbnails (150x150px vs 100x100px)
- Cover photo: Fills tile with album info overlay
- Empty albums: 📚 icon placeholder with album name
- Hover effects: Scale slightly, show more album details

## Success Criteria
- Albums navigation icon visible and functional
- Album list displays correctly with covers and metadata
- Album filtering works smoothly
- Clicking album opens album view with photos
- Performance acceptable with 20+ albums

## Future Integration Points
- Album management (improvement #72)
- Album creation from Selection tab (improvement #73)
- Album cover photo selection (improvement #72)

## Testing Plan
1. Test Albums navigation icon functionality
2. Test album list display with various album states (empty, with photos)
3. Test album filtering with different search terms
4. Test album opening and view switching
5. Test performance with larger album collections

keep context