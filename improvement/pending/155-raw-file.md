# RAW File Display Performance Optimization

## Overview
Enable PhotoClove to display RAW image files (CR2, NEF, ARW, DNG, etc.) with sufficient performance for practical use. Currently, the app uses the `image` crate (v0.24) and `image_compressor` for thumbnail generation, which may not efficiently handle RAW formats without additional processing.

## User Impact
- **Who benefits**: Professional photographers and enthusiasts who work primarily with RAW files
- **Workflow improvement**: Enables PhotoClove to be the primary photo management tool for RAW workflows without requiring pre-conversion
- **Pain points solved**:
  - Eliminates need to maintain separate JPEG exports for browsing
  - Allows immediate viewing of RAW files after import
  - Reduces storage requirements (no duplicate JPEG/RAW files)

## Influence on Existing Features

### Compatibility
**Breaking Changes**: None - this is additive functionality
- Existing JPEG/PNG/video workflows remain unchanged
- RAW support is optional enhancement

**Interacting Features**:
- **PhotosList** (`src/App/PhotosList.jsx`) - Grid view must display RAW thumbnails
- **PhotosListMini** (`src/App/PhotosList/PhotosListMini.jsx`) - Full-screen viewer must show RAW previews
- **Importer** (`src/App/Importer.jsx`) - Import flow must handle RAW files
- **Thumbnail Generation** (`src-tauri/src/domain_service/job_queue/handlers/thumbnail.rs`) - Core processing pipeline
- **PhotoService** (`src-tauri/src/domain_service/photo_service.rs`) - Thumbnail creation logic

**Migration**: No database schema changes needed - RAW files are just another image format

### Related Features
- Thumbnail caching system (`src/utils/thumbnailUtils.js`)
- EXIF thumbnail extraction (`use_exif_thumbnail` config option in Preferences)
- Photo loading strategies (`src/domain/SinglePhotoDisplay.js`, `src/services/PhotoCacheService.js`)
- Job queue system for background processing

## Implementation Approach

### Performance Considerations

#### 1. **RAW Decoding Strategy**
RAW files are significantly larger (20-50MB) and slower to decode than JPEGs. Key optimization strategies:

**A. EXIF Embedded Thumbnails (Quick Win)**
- Most RAW files contain embedded JPEG previews in EXIF data
- Sizes: typically 160px thumbnail + 1920px preview
- **Pros**: Instant extraction (milliseconds), no decoding needed
- **Cons**: Lower quality than full decode, may not reflect latest edits
- **Implementation**: Extend existing `use_exif_thumbnail` feature

**B. Fast RAW Decoding Library**
- Current `image` crate has limited RAW support
- Options:
  1. **libraw** (via `rawloader` or FFI) - Industry standard, very fast
  2. **dcraw** (command-line) - Mature but slower (fork process overhead)
  3. **imagepipe** - Pure Rust, moderate speed
- **Recommended**: libraw for best performance/quality balance

**C. Progressive Loading**
- Display EXIF thumbnail immediately (instant feedback)
- Queue full RAW decode in background
- Replace with high-quality preview when ready
- Cache decoded preview for instant subsequent loads

#### 2. **Caching Architecture**

**Multi-Tier Cache**:
```
L1: Memory cache (PhotoCacheService)
    ↓ miss
L2: Disk thumbnail cache (~/.photoclove/thumbnail/)
    - EXIF thumbnail: {uuid}_exif.jpg
    - Small preview: {uuid}_small.webp (400px)
    - Medium preview: {uuid}_medium.webp (1920px)
    - Original RAW: Do not cache (too large)
    ↓ miss
L3: On-demand RAW decode
```

**Cache Invalidation**:
- Thumbnails persist indefinitely (RAW files are immutable)
- Clear cache on file deletion
- Optional: regenerate cache when RAW processing settings change

#### 3. **Thumbnail Generation Pipeline**

**Current Flow** (photo_service.rs:28-120):
```
FolderCompressor → compress JPEG/PNG → save to thumbnail_store
```

**Enhanced Flow for RAW**:
```
1. Detect RAW file extension (.cr2, .nef, .arw, .dng, etc.)
2. Extract EXIF thumbnail → save as {uuid}_exif.jpg
3. IF use_exif_thumbnail = true:
     - Use EXIF thumbnail for grid view (done)
   ELSE:
     - Queue RAW decode job
     - Decode to 1920px JPEG
     - Compress to WebP
     - Save as {uuid}_medium.webp
4. Generate small thumbnail (400px) for grid
```

**Parallel Processing**:
- RAW decoding is CPU-intensive
- Use existing `thumbnail_parallel` config (currently respects thread count)
- Consider separate queue for RAW vs JPEG (RAW jobs are much slower)

#### 4. **Memory Management**

**Risk**: RAW decoding creates large intermediate buffers
- Single 24MP RAW → ~72MB RGB buffer (3 bytes × 24M pixels)
- Multiple parallel decodes → 300-500MB RAM easily

**Mitigation**:
- Limit concurrent RAW decodes (e.g., max 2-4 depending on RAM)
- Stream processing where possible (libraw supports this)
- Immediately drop buffers after thumbnail generation
- Monitor memory usage via job queue

#### 5. **UI/UX Considerations**

**Loading States**:
- Grid view: Show placeholder → EXIF thumb → full thumbnail
- Full-screen: Show EXIF preview → full preview → original (on demand)
- Progress indicator for slow RAW decodes (>2 seconds)

**Config Options** (add to Preferences):
```javascript
raw_preview_quality: 'fast' | 'balanced' | 'quality'
  - fast: EXIF thumbnail only
  - balanced: EXIF + 1920px decode
  - quality: Full RAW decode to max resolution

raw_decode_on_view: boolean
  - false: Decode all during import (slow import, fast browsing)
  - true: Decode on-demand when viewed (fast import, slower browsing)
```

### Architecture

**Domain Entities Affected**:
- `Photo` (`src/domain/Photo.js`) - Add `isRaw`, `hasRawPreview` properties
- `PhotoCollection` (`src/domain/PhotoCollection.js`) - No changes needed
- `file::File` (Rust) - Add RAW format detection

**State Management**:
- Existing thumbnail caching state works as-is
- `PhotoCacheService` may need RAW-specific cache keys

**Backend Changes**:
- New Tauri command: `extract_raw_thumbnail(path: String) -> Result<Vec<u8>>`
- Enhanced `create_thumbnails()` to detect and process RAW
- New job queue type: `JOB_TYPE_RAW_DECODE`

### Source Code Changes

**Frontend**:
- `src/App/Preferences.jsx` - Add RAW settings section
  - `raw_preview_quality` dropdown
  - `raw_decode_on_view` checkbox
  - `raw_formats_supported` read-only list

- `src/utils/thumbnailUtils.js` - Add RAW-specific thumbnail resolution
  ```javascript
  export const getRawThumbnailSrc = (filePath, thumbnailStore, quality) => {
    const uuid = extractUUIDFromPath(filePath);
    const suffix = quality === 'fast' ? '_exif' : '_medium';
    return `${thumbnailStore}/${uuid}${suffix}.webp`;
  };
  ```

- `src/domain/Photo.js` - Add RAW detection
  ```javascript
  isRawFormat() {
    const ext = this.file.extension?.toLowerCase();
    return ['cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2'].includes(ext);
  }
  ```

**Backend**:
- `src-tauri/Cargo.toml` - Add dependencies
  ```toml
  rawloader = "0.37"  # or libraw-rs with FFI
  kamadak-exif = "0.5"  # for EXIF thumbnail extraction
  ```

- `src-tauri/src/domain_service/photo_service.rs` - Enhance thumbnail creation
  ```rust
  pub async fn create_thumbnails(...) {
    // ... existing code ...

    // Add RAW file detection
    if is_raw_format(&extension) {
      if config.use_exif_thumbnail {
        extract_exif_thumbnail(&entry.path(), &thumbnail_path)?;
      } else {
        decode_raw_to_thumbnail(&entry.path(), &thumbnail_path, config.raw_preview_quality)?;
      }
    }
  }

  fn is_raw_format(ext: &str) -> bool {
    matches!(ext, "cr2" | "nef" | "arw" | "dng" | "raf" | "orf" | "rw2")
  }

  fn extract_exif_thumbnail(raw_path: &Path, dest: &Path) -> Result<(), Box<dyn Error>> {
    // Use kamadak-exif to extract embedded JPEG
  }

  fn decode_raw_to_thumbnail(raw_path: &Path, dest: &Path, quality: &str) -> Result<(), Box<dyn Error>> {
    // Use rawloader to decode
    // Resize to target resolution
    // Encode as WebP
  }
  ```

- `src-tauri/src/entity/config.rs` - Add RAW config fields
  ```rust
  pub struct Config {
    // ... existing fields ...
    pub raw_preview_quality: String,  // "fast" | "balanced" | "quality"
    pub raw_decode_on_view: bool,
  }
  ```

- `src-tauri/src/commands/database_commands.rs` - Add RAW thumbnail extraction command
  ```rust
  #[tauri::command]
  pub async fn extract_raw_thumbnail(path: String) -> Result<Vec<u8>, String> {
    // Fast EXIF extraction for immediate display
  }
  ```

**Database**:
No schema changes needed - RAW files are stored in `photo_metadata` like any other image.

## Dependencies & Risks

### External Dependencies
**Rust Crates**:
- `rawloader = "0.37"` (or `libraw-rs` with system dependency) - ~2MB
- `kamadak-exif = "0.5"` - ~200KB
- Alternative: `imagepipe = "0.6"` (pure Rust, no system deps)

**System Dependencies** (if using libraw):
- libraw-dev (Linux)
- LibRaw (macOS via Homebrew)
- Bundled DLL (Windows)
- **Risk**: Deployment complexity increases

**Recommendation**: Use `rawloader` for pure Rust solution (no system deps)

### Performance
**Load Time Impact**:
- EXIF extraction: +10-50ms per RAW file (negligible)
- Full RAW decode: +500ms-3s per file (significant)
- Thumbnail generation during import: +50-200% time for RAW-heavy imports

**Memory**:
- Peak RAM: +200-400MB during parallel RAW decoding
- Thumbnail cache size: +50-100MB per 1000 RAW files (WebP compressed)

**Mitigation**:
- Use progressive loading (EXIF → full decode)
- Limit concurrent decodes
- Make full decode optional (`raw_decode_on_view`)

### Security
**Input Validation**:
- RAW parsers have had CVEs (buffer overflows in malformed files)
- Use well-maintained libraries (rawloader, libraw)
- Consider sandboxing RAW decode (separate process)

**File System**:
- RAW files can be very large (50-100MB)
- Validate file size before loading into memory
- Set max RAW file size limit (e.g., 200MB)

**SQL Injection**:
No additional risk - file paths handled same as JPEG

## Testing Strategy

### Manual Testing
1. **Import Test**: Import mix of RAW + JPEG files
   - Verify thumbnails generated for all formats
   - Check import speed (should be acceptable with EXIF mode)
   - Validate thumbnail quality

2. **Grid View Test**: Browse large RAW library
   - Thumbnails should load smoothly
   - No memory leaks over time
   - Cache hits should be instant

3. **Full-Screen Test**: View RAW photos in PhotosListMini
   - Initial EXIF preview should be instant
   - Full preview should load within 1-2 seconds
   - Navigation should remain smooth

4. **Performance Test**: 1000 RAW files
   - Import time (with/without EXIF mode)
   - Memory usage during import
   - Grid scroll performance
   - Cache size on disk

### Edge Cases
- **Corrupted RAW files**: Graceful fallback to placeholder
- **Missing EXIF thumbnails**: Trigger full decode automatically
- **Mixed format albums**: JPEG + RAW side-by-side
- **Very large RAW files** (>100MB): Reject or process differently
- **Disk full during thumbnail generation**: Handle gracefully

### Performance Benchmarks
**Target Metrics**:
- EXIF extraction: <100ms per file
- Grid thumbnail generation: <2s per RAW file
- Full preview generation: <3s per RAW file
- Memory usage: <500MB peak during import
- Grid scroll: 60fps with RAW thumbnails

**Test Hardware**:
- Mid-range laptop (16GB RAM, quad-core CPU)
- 500 RAW files (24MP, ~30MB each)

## Open Questions

1. **RAW Format Priority**: Which RAW formats to support first?
   - Canon (.cr2, .cr3) - most common
   - Nikon (.nef)
   - Sony (.arw)
   - Adobe DNG (universal)
   - Others: Fuji (.raf), Olympus (.orf), Panasonic (.rw2)

2. **Quality vs Speed Trade-off**: Default to EXIF thumbnails or full decode?
   - Recommendation: EXIF for grid, full decode for full-screen view

3. **Background Processing**: Should RAW decode happen during idle time?
   - Could pre-generate full previews when app is idle
   - Improves browsing experience later

4. **RAW Processing Parameters**: Should we allow basic RAW adjustments?
   - White balance
   - Exposure compensation
   - Out of scope for v1, but architecture should allow future enhancement

5. **Cache Management**: How to handle cache size growth?
   - Automatic cleanup of old previews?
   - User-configurable cache size limit?
   - "Optimize Cache" maintenance tool?

6. **External RAW Processors**: Integration with darktable/RawTherapee?
   - "Edit in External App" feature
   - Out of scope for this proposal

## Implementation Phases

### Phase 1: EXIF Thumbnail Support (Quick Win)
- Add EXIF thumbnail extraction
- Display in grid and full-screen
- ~2-3 days development
- Immediate value for users

### Phase 2: Full RAW Decode Pipeline
- Integrate rawloader
- Generate medium-quality WebP previews
- Background job queue integration
- ~5-7 days development

### Phase 3: Progressive Loading & Caching
- Multi-tier cache implementation
- Progressive load (EXIF → full)
- Memory optimization
- ~3-5 days development

### Phase 4: Performance Tuning
- Profile and optimize bottlenecks
- Parallel processing tuning
- Cache hit rate optimization
- ~2-3 days development

**Total Estimate**: 12-18 days for full implementation

## Success Criteria

- [ ] RAW files appear in PhotosList grid with thumbnails
- [ ] Grid scrolling performance matches JPEG performance
- [ ] Full-screen RAW preview loads within 2 seconds
- [ ] Import 100 RAW files in under 5 minutes (with EXIF mode)
- [ ] Memory usage stays under 500MB during import
- [ ] No crashes or errors with common RAW formats
- [ ] Cache size growth is manageable (<100MB per 1000 photos)
- [ ] User can toggle between EXIF and full decode modes

## References

- **Terms**: `docs/terms.md` - PhotoService, PhotosList, Thumbnail Generation
- **Architecture**: `docs/architecture.md` - Photo processing pipeline
- **Current Implementation**:
  - `src-tauri/src/domain_service/photo_service.rs:28-120` - Thumbnail creation
  - `src/utils/thumbnailUtils.js` - Frontend thumbnail utilities
- **Related Features**:
  - Thumbnail generation job queue
  - EXIF metadata extraction (already implemented for JPEG)
  - Photo import pipeline
  - Image caching system
