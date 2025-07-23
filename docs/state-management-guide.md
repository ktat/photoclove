# PhotoClove State Management Guide

This document describes PhotoClove's state management architecture after the comprehensive refactoring.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Custom Hooks](#custom-hooks)
4. [Context Structure](#context-structure)
5. [View Mode State Machine](#view-mode-state-machine)
6. [Cache Management](#cache-management)
7. [Best Practices](#best-practices)
8. [Migration Guide](#migration-guide)

## Overview

PhotoClove's state management has been refactored to use a modular, hook-based architecture that provides:

- **Separation of Concerns**: State is organized into focused custom hooks
- **View Mode State Machine**: Centralized navigation with validated transitions
- **Unified Cache Management**: Comprehensive caching with automatic cleanup
- **Type Safety**: Clear interfaces and return types
- **Debugging Support**: Structured logging throughout

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     App.jsx                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Context Providers                    │   │
│  │  ┌─────────────┐  ┌──────────────┐             │   │
│  │  │ PhotoContext│  │  UIContext   │             │   │
│  │  │             │  │ (useViewMode)│             │   │
│  │  └─────────────┘  └──────────────┘             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              PhotosList.jsx                      │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │         usePhotosListState()             │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐│   │   │
│  │  │  │Display   │ │Filters   │ │Selection ││   │   │
│  │  │  │Hook      │ │Hook      │ │Hook      ││   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘│   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           PhotoCacheService                      │   │
│  │  (Singleton - Unified Cache Management)         │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Custom Hooks

### usePhotosListState

Main hook that combines all specialized hooks for PhotosList component.

**Location**: `src/hooks/usePhotosListState.js`

```javascript
const {
  // Display state
  photos, currentPhotoPath, photoLoading,
  
  // Filter state
  filters, applyFrontendFilters,
  
  // Selection state
  photoSelection, toggleSelection,
  
  // Cache functions
  getCachedTags, cacheTags,
  
  // Computed values
  filteredPhotos,
  
  // Actions
  loadPhotosWithConfig, resetAllState
} = usePhotosListState();
```

### usePhotosListDisplay

Manages photo display and navigation state.

**Location**: `src/hooks/usePhotosListDisplay.js`

**Manages**:
- Photo list and current photo
- Loading states
- Thumbnail and image caching
- Display configuration (icon size, sort order)

### usePhotosListFilters

Handles all filtering logic and state.

**Location**: `src/hooks/usePhotosListFilters.js`

**Features**:
- Star rating filter
- Comment filter
- File extension filter
- Filter summary generation
- Frontend filtering logic

### usePhotosListSelection

Manages photo selection operations.

**Location**: `src/hooks/usePhotosListSelection.js`

**Features**:
- Single and multi-selection
- Range selection
- Selection dictionary for O(1) lookups
- Bulk operations support

## Context Structure

### PhotoContext

**Location**: `src/context/PhotoContext.jsx`

Manages photo-related global state:
```javascript
{
  dateList: [],          // Date list from backend
  datePage: {},          // Pagination per date
  currentDate: "",       // Selected date
  dateNum: {},           // Photo count per date
  showPhotoDisplay: {},  // Display states
  recentPhotosMode: false, // Recent photos mode
  albumsList: [],        // Album list
  currentAlbum: null,    // Current album
  albumPhotos: []        // Photos in current album
}
```

### UIContext (Refactored)

**Location**: `src/context/UIContext.jsx`

Now uses the view mode state machine:
```javascript
{
  // View mode state machine
  currentMode: 'home',     // Current view mode
  modeData: {},           // Mode-specific data
  showImporter: false,    // Computed from mode
  showPhotosList: false,  // Computed from mode
  // ... other computed visibility states
  
  // Navigation functions
  transitionTo(mode, data),
  showDatePhotos(date),
  showRecentPhotos(),
  openAlbum(albumId),
  
  // Non-view state
  footerMessages: {},
  welcomeImage: "",
  useCount: 0
}
```

## View Mode State Machine

### useViewMode Hook

**Location**: `src/hooks/useViewMode.js`

Implements centralized view navigation with state machine pattern.

#### View Modes

```javascript
VIEW_MODES = {
  HOME: 'home',
  DATE: 'date',
  RECENT: 'recent',
  SEARCH: 'search',
  ADVANCED_SEARCH: 'advanced_search',
  ALBUM_LIST: 'album_list',
  ALBUM: 'album',
  IMPORT: 'import',
  PREFERENCES: 'preferences',
  JOB_QUEUE: 'job_queue',
  LOGIN: 'login'
}
```

#### Key Features

1. **Validated Transitions**: Only allowed transitions are permitted
2. **History Tracking**: Navigate back through view history
3. **Mode Data**: Pass context data with transitions
4. **Computed Visibility**: Screen visibility derived from current mode

#### Usage Example

```javascript
const viewMode = useViewMode(VIEW_MODES.HOME);

// Transition to date view
viewMode.showDatePhotos('2024-01-15');

// Check current mode
if (viewMode.isMode(VIEW_MODES.DATE)) {
  // In date view
}

// Go back
viewMode.goBack();
```

## Cache Management

### PhotoCacheService

**Location**: `src/services/PhotoCacheService.js`

Singleton service providing unified cache management.

#### Cache Types

1. **Thumbnail Cache**: Photo thumbnails with LRU eviction
2. **Photo Cache**: Full-size photo data
3. **Tag Cache**: Photo tags by path
4. **Metadata Cache**: Photo metadata
5. **Album Cache**: Album photo lists

#### Features

- **LRU Eviction**: Automatic memory management
- **TTL Support**: 30-minute expiration
- **Periodic Cleanup**: 5-minute intervals
- **Statistics**: Hit rates and performance metrics
- **Structured Logging**: Debug cache operations

#### Usage Example

```javascript
import { photoCacheService } from '../services/PhotoCacheService.js';

// Cache thumbnail
photoCacheService.setThumbnail(photoPath, thumbnailData);

// Get cached thumbnail
const cached = photoCacheService.getThumbnail(photoPath);

// Get cache statistics
const stats = photoCacheService.getStats();
console.log(`Thumbnail hit rate: ${stats.thumbnailHitRate}`);
```

## Best Practices

### 1. State Organization

- **Use appropriate hooks**: Don't access internal state directly
- **Leverage computed values**: Use `filteredPhotos` instead of filtering manually
- **Batch updates**: Update related state together

### 2. Navigation

- **Use view mode transitions**: Always use the state machine for navigation
- **Pass mode data**: Include context when transitioning
- **Check transitions**: Use `canTransitionTo()` to validate

### 3. Caching

- **Cache early**: Cache data as soon as it's fetched
- **Invalidate properly**: Clear cache when data changes
- **Monitor performance**: Check cache statistics regularly

### 4. Debugging

- **Use structured logging**: Follow the established pattern
- **Include correlation IDs**: Track operations across components
- **Check view mode history**: Debug navigation issues

## Migration Guide

### From Old State Management

#### Before (PhotosList.jsx)
```javascript
// ~40 individual useState calls
const [photos, setPhotos] = useState([]);
const [currentPhotoPath, setCurrentPhotoPath] = useState("");
const [starFilter, setStarFilter] = useState(0);
// ... many more
```

#### After (PhotosList.jsx)
```javascript
// Single hook with all state
const photosListState = usePhotosListState();
const { photos, currentPhotoPath, filters } = photosListState;
```

### From Old Navigation

#### Before (UIContext)
```javascript
// Repetitive toggle functions
const toggleImporter = (show) => {
  setShowImporter(show);
  setShowPhotosList(!show);
  setShowPreferences(false);
  // ... more manual updates
};
```

#### After (UIContext)
```javascript
// Simple state machine transition
viewMode.transitionTo(VIEW_MODES.IMPORT);
```

### Gradual Migration

The refactored system maintains backward compatibility:

1. **Start with new features**: Use new patterns for new code
2. **Migrate gradually**: Update existing code incrementally
3. **Use compatibility layer**: Old props still work during transition
4. **Remove old code**: Clean up after verification

## Common Patterns

### Loading Photos with Filters

```javascript
const { loadPhotosWithConfig, filters, applyFrontendFilters } = usePhotosListState();

// Load photos
await loadPhotosWithConfig(fetchConfig, appConfig);

// Filtered photos are automatically computed
const { filteredPhotos } = usePhotosListState();
```

### Navigation Flow

```javascript
const { showDatePhotos, showRecentPhotos, openAlbum } = useUI();

// Navigate to specific date
showDatePhotos('2024-01-15');

// Show recent photos
showRecentPhotos();

// Open album
openAlbum(albumId);
```

### Cache Usage

```javascript
const { getCachedTags, cacheTags } = usePhotosListState();

// Check cache first
let tags = getCachedTags(photoPath);
if (!tags) {
  // Fetch from backend
  tags = await fetchTags(photoPath);
  // Cache for next time
  cacheTags(photoPath, tags);
}
```

## Troubleshooting

### Navigation Issues

1. **Check current mode**: `console.log(viewMode.currentMode)`
2. **Verify transitions**: `console.log(viewMode.getAvailableTransitions())`
3. **Check history**: `console.log(viewMode.history)`

### State Not Updating

1. **Check hook usage**: Ensure using the correct hook
2. **Verify updates**: Check if state updates are batched
3. **Review logs**: Structured logging shows all state changes

### Cache Issues

1. **Check statistics**: `photoCacheService.getStats()`
2. **Verify TTL**: Items expire after 30 minutes
3. **Monitor size**: Check if hitting cache limits

## React Query Integration (Phase 3)

### Custom React Query Implementation

PhotoClove includes a custom React Query-like implementation that provides:

- **Automatic Caching**: Query results cached with configurable TTL
- **Background Refetching**: Automatic data refresh on window focus/reconnect
- **Retry Logic**: Exponential backoff for failed requests
- **Loading States**: Comprehensive loading/error state management
- **Mutation Support**: Optimistic updates with cache invalidation

#### Photo Queries

```javascript
import { usePhotosWithFilter, usePhotoTags, useAlbumPhotos } from '../hooks/usePhotosQuery.js';

// Fetch photos with automatic caching
const photosQuery = usePhotosWithFilter(fetchConfig, {
  staleTime: 60 * 1000, // 1 minute
  cacheTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: false
});

// Access loading states
const { isLoading, isError, error, isFetching, data } = photosQuery;
```

#### Photo Mutations

```javascript
import { useUpdatePhotoStar, useUpdatePhotoComment, useUpdatePhotoTags } from '../hooks/usePhotosQuery.js';

// Update photo star rating
const starMutation = useUpdatePhotoStar({
  onSuccess: () => {
    // Auto-invalidates photo queries
    console.log('Star rating updated');
  }
});

// Update photo comment
const commentMutation = useUpdatePhotoComment();

// Update photo tags
const tagsMutation = useUpdatePhotoTags();

// Usage
starMutation.mutate({ photoPath: '/path/to/photo.jpg', starValue: 4 });
```

## Future Enhancements

1. **State Persistence**: Save and restore application state
2. **Optimistic Updates**: Immediate UI updates with rollback
3. **State DevTools**: Enhanced debugging capabilities
4. **Query Devtools**: Visual query cache inspection

This guide reflects the current state management architecture after the comprehensive refactoring. The new system provides better organization, performance, and developer experience while maintaining backward compatibility.