# Improvement #91: Add Performance Monitoring and Optimization

## Current Status
- No centralized performance monitoring
- Potential performance issues:
  - Large photo lists causing slow rendering
  - Import mode thumbnail loading (current WIP issue)
  - Database queries without optimization
  - Memory leaks in component unmount
  - Inefficient re-renders

## Problem
Without performance monitoring:
- Hard to identify bottlenecks
- Unknown memory usage patterns
- No visibility into render performance
- Cannot track optimization improvements
- User experience degradation goes unnoticed

## Goal
Add comprehensive performance monitoring and implement targeted optimizations.

## Implementation Plan

### Step 1: Add React Performance Tools

#### 1.1 React DevTools Profiler Integration
- Add `<Profiler>` components around key sections
- Identify expensive renders
- Track component render times

#### 1.2 Custom Performance Hooks
Create `src/hooks/usePerformanceMonitor.js`:
```javascript
export function usePerformanceMonitor(componentName) {
    useEffect(() => {
        const startTime = performance.now();
        return () => {
            const duration = performance.now() - startTime;
            logger.debug('Performance', 'component_mount', {
                component: componentName,
                duration
            });
        };
    }, []);

    const measureRender = useCallback((renderName) => {
        performance.mark(`${componentName}-${renderName}-start`);
        return () => {
            performance.mark(`${componentName}-${renderName}-end`);
            performance.measure(
                `${componentName}-${renderName}`,
                `${componentName}-${renderName}-start`,
                `${componentName}-${renderName}-end`
            );
        };
    }, [componentName]);

    return { measureRender };
}
```

### Step 2: Add Backend Performance Monitoring

#### 2.1 Create Rust Performance Middleware
Add to `src-tauri/src/domain_service/performance_service.rs`:
```rust
pub struct PerformanceMonitor {
    metrics: Arc<Mutex<HashMap<String, Vec<Duration>>>>,
}

impl PerformanceMonitor {
    pub fn measure<F, R>(&self, name: &str, f: F) -> R
    where
        F: FnOnce() -> R,
    {
        let start = Instant::now();
        let result = f();
        let duration = start.elapsed();

        log::debug!(target: "performance", "operation; name={}; duration_ms={}",
            name, duration.as_millis());

        let mut metrics = self.metrics.lock().unwrap();
        metrics.entry(name.to_string())
            .or_insert_with(Vec::new)
            .push(duration);

        result
    }

    pub fn get_stats(&self, name: &str) -> Option<PerformanceStats> {
        // Calculate avg, min, max, p95, p99
    }
}
```

#### 2.2 Add Performance Tauri Commands
```rust
#[tauri::command]
fn get_performance_stats(state: State<AppState>) -> HashMap<String, PerformanceStats> {
    state.performance_monitor.get_all_stats()
}

#[tauri::command]
fn clear_performance_stats(state: State<AppState>) {
    state.performance_monitor.clear()
}
```

### Step 3: Optimize Database Queries

#### 3.1 Add Query Profiling
Wrap all database queries with timing:
```rust
fn execute_query<F, R>(name: &str, f: F) -> R
where
    F: FnOnce() -> R,
{
    let start = Instant::now();
    let result = f();
    let duration = start.elapsed();

    if duration.as_millis() > 100 {
        log::warn!(target: "db_performance", "slow_query; name={}; duration_ms={}",
            name, duration.as_millis());
    }

    result
}
```

#### 3.2 Add Missing Indexes
Analyze slow queries and add indexes:
- `photo_metadata(photo_date)` - for date-based queries
- `photo_metadata(star)` - for star filtering
- `photo_metadata(delete_flg, photo_date)` - composite for common queries
- `album_photos(added_at)` - for recent additions
- Full-text search index on comments (if SQLite supports)

#### 3.3 Optimize Pagination
- Add LIMIT and OFFSET to large queries
- Implement cursor-based pagination for better performance
- Cache query counts

### Step 4: Optimize React Rendering

#### 4.1 Add Memoization
Identify expensive computations and wrap with `useMemo`:
```javascript
// In PhotosList.jsx
const filteredPhotos = useMemo(() => {
    return applyFrontendFilters(photos, {
        starFilter,
        hasCommentFilter,
        hasTagFilter,
        extensionFilter
    });
}, [photos, starFilter, hasCommentFilter, hasTagFilter, extensionFilter]);
```

#### 4.2 Add React.memo for Components
Memoize pure components:
```javascript
export default React.memo(PhotoGrid, (prevProps, nextProps) => {
    return prevProps.displayedPhotos === nextProps.displayedPhotos &&
           prevProps.iconSize === nextProps.iconSize &&
           prevProps.photoSelectionDict === nextProps.photoSelectionDict;
});
```

#### 4.3 Virtualize Large Lists
For photo grids with 1000+ items, use react-window or react-virtualized:
```javascript
import { FixedSizeGrid } from 'react-window';

function VirtualizedPhotoGrid({ photos, iconSize }) {
    return (
        <FixedSizeGrid
            columnCount={Math.floor(width / iconSize)}
            columnWidth={iconSize}
            height={height}
            rowCount={Math.ceil(photos.length / columnsPerRow)}
            rowHeight={iconSize}
            width={width}
        >
            {({ columnIndex, rowIndex, style }) => (
                <PhotoTile
                    photo={photos[rowIndex * columnsPerRow + columnIndex]}
                    style={style}
                />
            )}
        </FixedSizeGrid>
    );
}
```

### Step 5: Memory Optimization

#### 5.1 Implement Image Lazy Loading
Use IntersectionObserver for lazy image loading:
```javascript
function useLazyImage(src) {
    const [imageSrc, setImageSrc] = useState(placeholder);
    const imgRef = useRef();

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setImageSrc(src);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, [src]);

    return [imageSrc, imgRef];
}
```

#### 5.2 Implement Cache Size Limits
Add to `PhotoCacheService.js`:
```javascript
class PhotoCacheService {
    constructor() {
        this.cache = new Map();
        this.maxSize = 500; // Max cached items
        this.accessOrder = [];
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            // LRU eviction
            const oldestKey = this.accessOrder.shift();
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, value);
        this.accessOrder.push(key);
    }

    get(key) {
        if (this.cache.has(key)) {
            // Move to end (most recently used)
            const index = this.accessOrder.indexOf(key);
            this.accessOrder.splice(index, 1);
            this.accessOrder.push(key);

            return this.cache.get(key);
        }
        return null;
    }
}
```

#### 5.3 Clean Up Event Listeners
Audit all components for proper cleanup:
```javascript
useEffect(() => {
    const handler = (e) => { /* ... */ };
    window.addEventListener('resize', handler);

    return () => {
        window.removeEventListener('resize', handler);
    };
}, []);
```

### Step 6: Add Performance Dashboard

Create `src/App/PerformanceDashboard.jsx`:
- Display render times for key components
- Show database query stats
- Display memory usage
- Show cache hit rates
- Network request timings (for Google Photos)
- Button to clear metrics

### Step 7: Bundle Size Optimization

#### 7.1 Analyze Bundle
```bash
npm run build -- --stats
npx webpack-bundle-analyzer dist/stats.json
```

#### 7.2 Code Splitting
Split large libraries into separate chunks:
```javascript
// Lazy load heavy components
const PhotoEditor = lazy(() => import('./PhotosList/PhotoOption/PhotoEditor.jsx'));
const LogViewer = lazy(() => import('./LogViewer.jsx'));
```

#### 7.3 Tree Shaking
Ensure unused code is removed:
- Use ES6 imports (not require)
- Avoid default exports for large libraries
- Import specific functions: `import { invoke } from '@tauri-apps/api/core'`

## Expected Results
- Identify and fix performance bottlenecks
- Reduced render times (target: <16ms for 60fps)
- Reduced memory usage (target: <500MB for large libraries)
- Faster database queries (target: <50ms for most queries)
- Better user experience with large photo collections
- Data-driven optimization decisions

## Metrics to Track
- Component render times
- Database query duration
- Memory usage over time
- Cache hit rate
- Bundle size
- Time to interactive (TTI)
- First contentful paint (FCP)
- Largest contentful paint (LCP)

## Testing
- Load library with 10,000+ photos
- Monitor memory usage over 30 minutes
- Profile component renders
- Test scroll performance
- Test search performance
- Test import performance
- Check for memory leaks

## Related Files
- All React components (add monitoring)
- All Rust commands (add timing)
- `src/hooks/usePerformanceMonitor.js` (new)
- `src-tauri/src/domain_service/performance_service.rs` (new)
- `src/App/PerformanceDashboard.jsx` (new)
- `src/services/PhotoCacheService.js` (modify)

## Notes
- Performance monitoring should be optional (dev mode or toggle)
- Consider using web workers for heavy computations
- May want to add Service Worker for offline caching
- Consider implementing progressive image loading (blur-up)
- Benchmark improvements with real-world usage patterns
