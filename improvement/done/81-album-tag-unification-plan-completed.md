# Album and Tag Unification Plan

## Executive Summary

This document outlines a plan to unify Albums and Tags into a single, flexible "PhotoCollection" entity while preserving the distinct behaviors and use cases of each.

## Current State Analysis

### Similarities
- Both organize photos into groups
- Both have names and creation timestamps
- Both use many-to-many relationships with photos
- Both support selection and bulk operations
- Both have list views with search functionality

### Key Differences
| Feature | Albums | Tags |
|---------|--------|------|
| Purpose | Curated collections | Classification/categorization |
| Naming | Allows duplicates | Enforces uniqueness |
| Metadata | Rich (description, cover) | Minimal (color) |
| Ordering | Manual photo ordering | No ordering |
| Updates | Full CRUD | Create/Delete only |
| Visual | Cover photos | Color coding |

## Proposed Unified Design: PhotoCollection

### 1. Database Schema

```sql
-- Unified collections table
CREATE TABLE photo_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('album', 'tag')), -- Discriminator
    name TEXT NOT NULL,
    color TEXT, -- Used for tags
    description TEXT, -- Used for albums
    cover_photo_path TEXT, -- Used for albums
    settings JSON, -- Extensible settings
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, type) -- Name uniqueness per type
);

-- Unified junction table
CREATE TABLE photo_collection_items (
    collection_id INTEGER,
    photo_path TEXT,
    order_index INTEGER DEFAULT 0, -- Used for albums
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSON, -- Extensible per-item data
    PRIMARY KEY (collection_id, photo_path),
    FOREIGN KEY (collection_id) REFERENCES photo_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_path) REFERENCES photo_metadata(path) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_collections_type ON photo_collections(type);
CREATE INDEX idx_collections_name ON photo_collections(name);
CREATE INDEX idx_collection_items_order ON photo_collection_items(collection_id, order_index);
```

### 2. Domain Model

```rust
// Rust backend
#[derive(Debug, Clone)]
pub enum CollectionType {
    Album,
    Tag,
}

pub struct PhotoCollection {
    pub id: i64,
    pub collection_type: CollectionType,
    pub name: String,
    pub color: Option<String>,
    pub description: Option<String>,
    pub cover_photo_path: Option<String>,
    pub settings: HashMap<String, Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl PhotoCollection {
    pub fn is_album(&self) -> bool {
        matches!(self.collection_type, CollectionType::Album)
    }
    
    pub fn is_tag(&self) -> bool {
        matches!(self.collection_type, CollectionType::Tag)
    }
    
    pub fn supports_ordering(&self) -> bool {
        self.is_album()
    }
    
    pub fn supports_description(&self) -> bool {
        self.is_album()
    }
}
```

```javascript
// Frontend domain model
export class PhotoCollection {
    constructor(data) {
        this.id = data.id;
        this.type = data.type; // 'album' | 'tag'
        this.name = data.name;
        this.color = data.color;
        this.description = data.description;
        this.coverPhotoPath = data.coverPhotoPath;
        this.photoCount = data.photoCount;
        this.settings = data.settings || {};
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }
    
    isAlbum() {
        return this.type === 'album';
    }
    
    isTag() {
        return this.type === 'tag';
    }
    
    getDisplayIcon() {
        return this.isAlbum() ? '📚' : '🏷️';
    }
    
    supportsOrdering() {
        return this.isAlbum();
    }
    
    getVisualIdentifier() {
        if (this.isAlbum() && this.coverPhotoPath) {
            return { type: 'image', value: this.coverPhotoPath };
        }
        if (this.isTag() && this.color) {
            return { type: 'color', value: this.color };
        }
        return { type: 'icon', value: this.getDisplayIcon() };
    }
}
```

### 3. API Design

```typescript
// Unified API interface
interface PhotoCollectionAPI {
    // Create operations
    createCollection(type: 'album' | 'tag', data: CreateCollectionData): Promise<PhotoCollection>;
    
    // Read operations
    getAllCollections(type?: 'album' | 'tag'): Promise<PhotoCollection[]>;
    getCollection(id: number): Promise<PhotoCollection>;
    getCollectionPhotos(id: number, options?: { ordered?: boolean }): Promise<Photo[]>;
    
    // Update operations
    updateCollection(id: number, updates: UpdateCollectionData): Promise<PhotoCollection>;
    reorderPhotos(collectionId: number, photoOrder: string[]): Promise<void>;
    
    // Delete operations
    deleteCollection(id: number): Promise<void>;
    
    // Photo management
    addPhotoToCollection(collectionId: number, photoPath: string): Promise<void>;
    removePhotoFromCollection(collectionId: number, photoPath: string): Promise<void>;
    
    // Search and filter
    searchCollections(query: string, type?: 'album' | 'tag'): Promise<PhotoCollection[]>;
    getPhotoCollections(photoPath: string, type?: 'album' | 'tag'): Promise<PhotoCollection[]>;
}
```

### 4. Migration Strategy

#### Phase 1: Backend Preparation (Non-breaking)
1. Create new unified tables alongside existing ones
2. Implement data sync triggers to keep both in sync
3. Add new unified API endpoints alongside existing ones
4. Implement backwards-compatible response transformers

#### Phase 2: Frontend Adaptation
1. Create PhotoCollection domain model
2. Update ViewMode to use unified collection concept
3. Implement adapter layer for existing components
4. Update state management to use unified collections

#### Phase 3: Gradual Migration
1. Update components one by one to use new API
2. Start with read operations (list views)
3. Then update write operations (create, update, delete)
4. Finally update complex features (ordering, bulk operations)

#### Phase 4: Cleanup
1. Remove old API endpoints
2. Drop old database tables
3. Remove adapter layers
4. Update documentation

### 5. UI/UX Considerations

#### Unified List View
- Single "Collections" view with type filter
- Visual indicators for collection type (icon/color)
- Type-specific actions in context menus
- Smart defaults based on collection type

#### Creation Flow
```javascript
// Unified creation modal
function CreateCollectionModal({ onCreateCollection }) {
    const [type, setType] = useState('album');
    const [formData, setFormData] = useState({});
    
    return (
        <Modal>
            <TypeSelector value={type} onChange={setType} />
            {type === 'album' ? (
                <AlbumFields data={formData} onChange={setFormData} />
            ) : (
                <TagFields data={formData} onChange={setFormData} />
            )}
            <CreateButton onClick={() => onCreateCollection(type, formData)} />
        </Modal>
    );
}
```

### 6. Benefits

1. **Code Reuse**: Single set of components for both types
2. **Consistency**: Unified behavior and appearance
3. **Extensibility**: Easy to add new collection types
4. **Maintainability**: Single codebase to maintain
5. **Flexibility**: Type-specific behaviors preserved

### 7. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Phased migration with backwards compatibility |
| User confusion | Clear visual indicators and tooltips |
| Performance impact | Proper indexing and query optimization |
| Data migration errors | Comprehensive testing and rollback plan |

### 8. Implementation Timeline

- **Week 1-2**: Backend schema and API design
- **Week 3-4**: Migration scripts and sync mechanisms
- **Week 5-6**: Frontend domain model and adapters
- **Week 7-8**: Component updates and testing
- **Week 9-10**: User testing and refinements
- **Week 11-12**: Final migration and cleanup

### 9. Success Criteria

- [ ] All existing functionality preserved
- [ ] Code reduction of at least 30%
- [ ] No performance degradation
- [ ] Positive user feedback
- [ ] Clean, maintainable codebase

## Conclusion

This unification will significantly simplify the codebase while preserving the distinct behaviors that make albums and tags useful for different purposes. The phased approach ensures minimal disruption while delivering long-term benefits.