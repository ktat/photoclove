# Improvement #93: Comprehensive Test Coverage

## Current Status
- JavaScript tests: **2 test files** (ViewMode.test.js, basic.test.js)
- Rust tests: **1 test file**
- Test coverage: **Very low** (estimated <10%)
- No integration tests
- No E2E tests
- Critical paths untested

## Problem
Lack of test coverage leads to:
- Regression bugs going unnoticed
- Fear of refactoring (might break something)
- Difficulty onboarding new developers
- Hard to verify fixes
- No confidence in large changes
- Manual testing required for every change

## Goal
Achieve comprehensive test coverage across frontend, backend, and integration.

## Implementation Plan

### Phase 1: Frontend Unit Tests

#### 1.1 Domain Layer Tests
Create tests for domain objects:

**`src/domain/Photo.test.js`**
- Constructor validation
- Getter methods
- Path handling
- EXIF data parsing
- Metadata operations

**`src/domain/PhotoCollection.test.js`**
- Collection creation
- Mode-specific behavior
- Photo filtering
- Sorting
- Metadata access

**`src/domain/ViewMode.test.js`** (expand existing)
- All view mode types
- Mode detection methods
- Fetch configuration
- Tab availability
- Action availability

**`src/domain/ImportState.test.js`**
- State transitions
- Validation
- Progress tracking
- Error handling

#### 1.2 Utility Tests
Create tests for utility functions:

**`src/utils/PhotoProcessingUtils.test.js`**
- `convertPhotosToEntities()`
- `applyFrontendFilters()`
- `convertJSONToPhotoEntities()`
- Filter combinations
- Edge cases (null, undefined, empty arrays)

**`src/utils/UIStateUtils.test.js`**
- `hasActiveFilters()`
- `getFilterSummary()`
- `getSortConfig()`
- `getCurrentSortConfig()`

#### 1.3 Hook Tests
Create tests for custom hooks:

**`src/hooks/usePhotoSelection.test.js`**
- Toggle selection
- Select all
- Clear selection
- Import vs library mode separation
- Selection dictionary consistency

**`src/hooks/usePhotosState.test.js`**
- State initialization
- State updates
- Derived state

**`src/hooks/useViewModeSync.test.js`**
- View mode synchronization
- Import state synchronization
- State persistence

**`src/hooks/useInfiniteScroll.test.js`**
- Load more triggering
- Loading state
- Offset calculation
- Edge cases (end of list)

#### 1.4 Service Tests
Create tests for services:

**`src/services/LoggerService.test.js`**
- Log level filtering
- Structured logging format
- Correlation IDs
- Log storage
- Log retrieval

**`src/services/PhotoCacheService.test.js`**
- Cache set/get
- LRU eviction
- Size limits
- Cache invalidation

**`src/services/UnifiedCollectionService.test.js`**
- Collection type detection
- Collection creation
- Metadata handling

### Phase 2: Component Tests

#### 2.1 Core Component Tests
Test rendering and user interactions:

**`src/App/PhotosList/PhotoGrid.test.jsx`**
- Photo tile rendering
- Selection handling
- Context menu
- Keyboard shortcuts
- Import mode thumbnails
- Error states

**`src/App/PhotosList/PhotosToolbar.test.jsx`**
- Action button rendering
- Button state (enabled/disabled)
- Action callbacks
- Selection count display

**`src/App/PhotosList/StatusBar.test.jsx`**
- Photo count display
- Filter summary
- Loading indicators

**`src/components/AdvancedFilters.test.jsx`**
- Filter options rendering
- Filter application
- Filter clearing
- Multi-filter combinations

**`src/components/SearchTools.test.jsx`**
- Search input
- Search execution
- Search results display
- Clear search

#### 2.2 Modal Component Tests

**`src/App/PhotosList/PhotosListMini.test.jsx`**
- Modal open/close
- Photo navigation
- Keyboard shortcuts
- Metadata display
- Actions (star, comment, delete)

**`src/components/AlbumCreationModal.test.jsx`**
- Form validation
- Album creation
- Error handling

### Phase 3: Backend Unit Tests (Rust)

#### 3.1 Entity Tests
Create tests for Rust entities:

**`src-tauri/src/entity/photo.rs`**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_photo_creation() {
        let photo = Photo::new("test.jpg");
        assert_eq!(photo.path, "test.jpg");
    }

    #[test]
    fn test_photo_validation() {
        // Test path validation
        // Test required fields
    }
}
```

**`src-tauri/src/entity/photo_collection.rs`**
- Collection type validation
- Photo addition/removal
- Ordering

#### 3.2 Repository Tests
Create tests for database operations:

**`src-tauri/src/repository/meta_db/sqlite.rs`** (after refactoring)
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_test_db() -> (TempDir, SQLite) {
        let temp_dir = TempDir::new().unwrap();
        let db = SQLite::new(temp_dir.path().to_str().unwrap());
        (temp_dir, db)
    }

    #[test]
    fn test_create_photo_metadata() {
        let (_temp, db) = setup_test_db();
        // Test photo insertion
    }

    #[test]
    fn test_get_photo_metadata() {
        let (_temp, db) = setup_test_db();
        // Test photo retrieval
    }

    #[test]
    fn test_search_photos() {
        let (_temp, db) = setup_test_db();
        // Test search functionality
    }
}
```

#### 3.3 Service Tests
Create tests for domain services:

**`src-tauri/src/domain_service/photo_service.rs`**
- Photo import
- Thumbnail generation
- EXIF extraction

**`src-tauri/src/domain_service/job_queue_service.rs`**
- Job enqueue
- Job execution
- Job completion
- Error handling

### Phase 4: Integration Tests

#### 4.1 Frontend Integration Tests
Test component interactions:

**`src/test/integration/PhotoLibrary.test.jsx`**
- Load library → Display photos
- Select photos → Perform actions
- Search → Filter results
- Navigate dates → Load photos

**`src/test/integration/AlbumManagement.test.jsx`**
- Create album → Add photos → View album
- Delete album → Verify photos remain
- Update album → Verify changes

**`src/test/integration/ImportWorkflow.test.jsx`**
- Select folder → Scan photos → Import → Verify in library

#### 4.2 Backend Integration Tests
Test Rust command integration:

**`src-tauri/src/tests/integration/photo_commands_test.rs`**
```rust
#[test]
fn test_photo_lifecycle() {
    // Create test environment
    // Import photo
    // Get photo metadata
    // Update metadata (star, comment)
    // Delete photo
    // Verify cleanup
}
```

**`src-tauri/src/tests/integration/search_test.rs`**
- Complex search queries
- Filter combinations
- Performance with large datasets

### Phase 5: End-to-End Tests

#### 5.1 Setup E2E Framework
Use Tauri's testing tools or Playwright:

**`e2e/setup.js`**
- Launch app
- Create test library
- Seed test data
- Cleanup

#### 5.2 Critical Path E2E Tests

**`e2e/import-workflow.spec.js`**
```javascript
test('Import photos from folder', async () => {
    // Click import button
    // Select folder
    // Wait for scan
    // Select photos
    // Click import
    // Verify in library
});
```

**`e2e/album-management.spec.js`**
```javascript
test('Create and manage album', async () => {
    // Create album
    // Add photos
    // View album
    // Update album
    // Delete album
});
```

**`e2e/search-workflow.spec.js`**
```javascript
test('Search and filter photos', async () => {
    // Enter search query
    // Apply filters
    // Verify results
    // Clear search
});
```

### Phase 6: Test Infrastructure

#### 6.1 Test Utilities
Create test helpers:

**`src/test/utils/testHelpers.js`**
```javascript
export function createMockPhoto(overrides = {}) {
    return new Photo({
        originalPath: '/test/photo.jpg',
        photoDate: '2025-01-01',
        star: 0,
        ...overrides
    });
}

export function createMockViewMode(mode = VIEW_MODES.DATE, data = {}) {
    return new ViewMode(mode, data);
}

export function mockTauriInvoke(responses = {}) {
    window.__TAURI__ = {
        invoke: jest.fn((cmd, args) => {
            return Promise.resolve(responses[cmd] || []);
        })
    };
}
```

**`src-tauri/src/tests/helpers/mod.rs`**
```rust
pub fn create_test_photo() -> Photo {
    Photo {
        path: "test.jpg".to_string(),
        photo_date: "2025-01-01".to_string(),
        // ...
    }
}

pub fn setup_test_db() -> (TempDir, MetaDB) {
    // Create temporary database for testing
}
```

#### 6.2 CI/CD Integration
Add to `.github/workflows/test.yml`:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions-rs/toolchain@v1
      - run: cargo test
      - run: cargo test --doc

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm ci
      - run: npm run tauri build
      - run: npm run test:e2e
```

## Expected Results
- Test coverage: >80% for critical paths
- Automated regression detection
- Confidence in refactoring
- Clear specifications (tests as documentation)
- Faster development (catch bugs early)
- Easier onboarding (tests show how things work)

## Coverage Goals
- Domain layer: 90%+
- Utilities: 90%+
- Services: 80%+
- Components: 70%+
- Hooks: 80%+
- Backend entities: 80%+
- Backend repositories: 80%+
- Integration tests: Cover all major workflows
- E2E tests: Cover 5-10 critical user journeys

## Testing Tools
- Jest (JavaScript unit tests)
- React Testing Library (component tests)
- Rust built-in testing (`cargo test`)
- Tauri testing utilities
- Playwright or Cypress (E2E)
- Coverage tools (Istanbul, Tarpaulin)

## Notes
- Start with high-value, high-risk areas
- Write tests before refactoring
- Keep tests fast (mock external dependencies)
- Test behavior, not implementation
- Use snapshots sparingly (hard to maintain)
- Document test setup and patterns
