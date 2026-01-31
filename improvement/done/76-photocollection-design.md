# PhotoCollection Implementation Design

## Current PhotosList.jsx Analysis

### Main Data Fetching Function:
```javascript
async function loadAllPhotosBasedOnFetchConfig(fetchConfig) {
  // Switch based on fetchConfig.fetch_method:
  // - "date": get_photos_unified with search_type: "date"
  // - "search": search results or fallback to date
  // - "tag": fallback to date (not implemented)
  // - "favorites": get_photos_unified with search_type: "favorites"  
  // - "recent": get_photos_unified with search_type: "recent"
}
```

### Current API Pattern:
```javascript
result = await invoke("get_photos_unified", {
  request: {
    type: "search",
    search_type: "date|favorites|recent",
    query: fetchConfig.value,
    sort_value: parseInt(sortOfPhotos),
    page: 1,
    limit: Math.min(9999, config?.max_photos_per_fetch || 1000),
    offset: 0,
    star: -1,
    has_comment: false,
    extension: "all"
  }
});
```

## PhotoCollection.fetchPhotos() Design

### Approach: Extract and Centralize
```javascript
// PhotoCollection.js
async fetchPhotos(page = 1, pageSize = 20, filters = {}) {
  switch (this.mode) {
    case 'date':
      return await this._fetchDatePhotos(page, pageSize, filters);
    case 'recent':
      return await this._fetchRecentPhotos(page, pageSize, filters);
    case 'favorites':
      return await this._fetchFavoritesPhotos(page, pageSize, filters);
    case 'search':
      return await this._fetchSearchPhotos(page, pageSize, filters);
    case 'album':
      return await this._fetchAlbumPhotos(page, pageSize, filters);
    case 'tag':
      return await this._fetchTagPhotos(page, pageSize, filters);
    case 'trash':
      return await this._fetchTrashPhotos(page, pageSize, filters);
    case 'import':
      return await this._fetchImportPhotos(page, pageSize, filters);
    default:
      throw new Error(`Unknown mode: ${this.mode}`);
  }
}

async _fetchDatePhotos(page, pageSize, filters) {
  const result = await invoke("get_photos_unified", {
    request: {
      type: "search",
      search_type: "date",
      query: this.metadata.date,
      sort_value: this.metadata.sortValue || 0,
      page: page,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      star: filters.star || -1,
      has_comment: filters.hasComment || false,
      extension: filters.extension || "all"
    }
  });
  
  const data = JSON.parse(result);
  
  return this.withPhotos(data.photos)
             .withMetadata({
               hasNext: data.has_next,
               hasPrev: page > 1,
               currentPage: page,
               totalCount: data.total_count
             });
}
```

### Benefits of This Design:

1. **Consistency**: All modes use the same fetchPhotos() interface
2. **Testability**: Each _fetch*Photos method can be unit tested
3. **Maintainability**: API changes only need updates in PhotoCollection
4. **Type Safety**: Centralized data structure validation
5. **Caching**: Can add caching layer in PhotoCollection later

## Migration Strategy

### Step 1: Add fetchPhotos to PhotoCollection
- Implement _fetchDatePhotos, _fetchRecentPhotos, etc.
- Keep existing PhotosList.jsx unchanged
- Test PhotoCollection methods in isolation

### Step 2: Update PhotosList.jsx
- Replace loadAllPhotosBasedOnFetchConfig with photoCollection.fetchPhotos()
- Remove direct invoke() calls
- Simplify state management

### Step 3: Add Import Mode
- Implement _fetchImportPhotos using show_importer API
- Add import-specific factory methods

## Next Actions
1. Implement PhotoCollection.fetchPhotos() for existing modes
2. Add unit tests for PhotoCollection
3. Update PhotosList.jsx to use PhotoCollection
4. Verify all existing functionality works