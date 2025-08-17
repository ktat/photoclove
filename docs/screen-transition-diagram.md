# PhotoClove Screen Transition Diagram

## DDD Architecture Overview

PhotoClove now uses Domain-Driven Design with the following key components:

### Entities
- **PhotoCollection**: Collection of photos with mode-specific behavior (album, date, search, trash, recent, tag, import)
- **SinglePhotoDisplay**: Single photo display state with navigation and mode-specific actions
- **ImportState**: Import functionality state management entity

### Value Objects
- **Photo**: Individual photo entity with display/thumbnail path methods and state
- **ViewMode**: Immutable value object that encapsulates view mode state and behavior

```mermaid
graph TD
    %% Main Screens
    Welcome[Welcome Screen]
    Home[Home Screen]
    LeftMenu[Left Column Menu<br/>🏠🔍📥📚🗑️🏷️]
    DateView[Date Collection<br/>📅 Photos by Date]
    SearchView[Search Collection<br/>🔍 Search Results]
    AlbumView[Album Collection<br/>📚 Photos in Album]
    AlbumsList[Albums List<br/>📁 All Albums]
    RecentView[Recent Collection<br/>⏰ Recent Photos]
    TrashView[Trash Collection<br/>🗑️ Deleted Photos]
    TagView[Tag Collection<br/>🏷️ Tagged Photos]
    TagsList[Tags List<br/>🏷️ All Tags]
    ImportView[Import Collection<br/>📥 Import Photos]
    
    %% Single Photo Display (unified)
    SinglePhoto[Single Photo Display<br/>🖼️ Mode-aware viewer]
    
    %% Domain Entities
    PhotoCollection[PhotoCollection Entity<br/>• Mode-specific behavior<br/>• Tabs, shortcuts, tutorials<br/>• Dropdown items]
    SinglePhotoDisplay[SinglePhotoDisplay Entity<br/>• Navigation logic<br/>• Mode-specific actions<br/>• Info panel data]
    
    %% Core Navigation Flow
    Welcome --> Home
    LeftMenu -->|🏠 Home| Home
    LeftMenu -->|🔍 Search| SearchView
    LeftMenu -->|📥 Import| ImportView
    LeftMenu -->|📚 Albums| AlbumsList
    LeftMenu -->|🗑️ Trash| TrashView
    LeftMenu -->|🏷️ Tags| TagsList
    LeftMenu -->|⏰ Recent| RecentView
    
    Home -->|Search bar| SearchView
    Home -->|Click date in DateList| DateView
    AlbumsList -->|Click album| AlbumView
    TagsList -->|Click tag| TagView
    
    %% Photo Collection to Single Photo Display
    DateView -->|Click photo| SinglePhoto
    SearchView -->|Click photo| SinglePhoto
    AlbumView -->|Click photo| SinglePhoto
    RecentView -->|Click photo| SinglePhoto
    TrashView -->|Click photo| SinglePhoto
    TagView -->|Click photo| SinglePhoto
    ImportView -->|Click photo| SinglePhoto
    
    %% Return to Collections
    SinglePhoto -->|Close/ESC| DateView
    SinglePhoto -->|Close/ESC| SearchView
    SinglePhoto -->|Close/ESC| AlbumView
    SinglePhoto -->|Close/ESC| RecentView
    SinglePhoto -->|Close/ESC| TrashView
    SinglePhoto -->|Close/ESC| TagView
    SinglePhoto -->|Close/ESC| ImportView
    
    %% Domain Layer
    PhotoCollection -.->|Creates| DateView
    PhotoCollection -.->|Creates| SearchView
    PhotoCollection -.->|Creates| AlbumView
    PhotoCollection -.->|Creates| RecentView
    PhotoCollection -.->|Creates| TrashView
    PhotoCollection -.->|Creates| TagView
    PhotoCollection -.->|Creates| ImportView
    
    SinglePhotoDisplay -.->|Creates| SinglePhoto
    
    %% Styling
    classDef mainScreen fill:#374151,stroke:#6b7280,color:#e5e7eb
    classDef collection fill:#4b5563,stroke:#8b5cf6,color:#c4b5fd
    classDef singlePhoto fill:#1f2937,stroke:#3b82f6,color:#93c5fd
    classDef navigation fill:#059669,stroke:#10b981,color:#ecfdf5
    classDef domain fill:#dc2626,stroke:#ef4444,color:#fef2f2
    
    class Welcome,Home,AlbumsList,TagsList mainScreen
    class DateView,SearchView,AlbumView,RecentView,TrashView,TagView,ImportView collection
    class SinglePhoto singlePhoto
    class LeftMenu navigation
    class PhotoCollection,SinglePhotoDisplay domain
```

## Navigation Elements

### Left Column Menu (Always Available)
The green **Left Column Menu** node represents the persistent navigation icons:
- 🏠 **Home** - Return to home screen
- 🔍 **Search** - Open search mode (advanced search)
- 📥 **Import** - Import photos
- 📚 **Albums** - View albums
- 🗑️ **Trash** - View deleted photos
- 🏷️ **Tags** - View tagged photos
- ⏰ **Recent** - View recent photos

### Additional Fixed Navigation
- **Top Menus** - File, Help (?) - Available everywhere
- **ESC key** - Returns to previous screen or closes single photo display

## DDD Architecture Components

### Domain Components

#### Entities
- **PhotoCollection Entity**: Collection of photos with mode-specific behavior
  - Mode types: `album`, `date`, `search`, `trash`, `recent`, `tag`, `import`
  - Methods: `getTitle()`, `getAvailableTabs()`, `getKeyboardShortcuts()`, `getDropdownItems()`, `getTutorialSteps()`
- **SinglePhotoDisplay Entity**: Single photo display state with navigation logic
  - Methods: `next()`, `previous()`, `getNavigationInfo()`, `getAvailableActions()`
- **ImportState Entity**: Import functionality state management
  - Methods: Import path management, progress tracking, event handling

#### Value Objects
- **Photo Value Object**: Individual photo with methods for `displayPath()`, `thumbnailPath()`, `isVideo()`, etc.
  - Immutable state with methods: `withStar()`, `withComment()`, `moveToTrash()`, `restoreFromTrash()`
- **ViewMode Value Object**: Encapsulates view mode state and behavior
  - Mode checking methods: `isAlbumMode()`, `isTrashMode()`, etc.

### Screen Types

#### Collection Views (All use PhotosList component)
All collection views are created from a **PhotoCollection** entity with mode-specific behavior:

- **Date Collection** 📅: Photos from selected date
  - Tabs: Home, Recent, Albums, Search, Trash
  - Shortcuts: Standard navigation + create album from date
  - Actions: Move to trash, add to album, star rating

- **Search Collection** 🔍: Search results with filters
  - Tabs: All available
  - Shortcuts: Standard navigation + Ctrl+F for search focus
  - Actions: All standard actions + save search

- **Album Collection** 📚: Photos in selected album
  - Tabs: Home, Albums, Search, Trash (limited set)
  - Shortcuts: Delete (remove from album), Ctrl+Delete (delete file)
  - Actions: Remove from album, delete file, reorder photos

- **Recent Collection** ⏰: Recently added photos
  - Tabs: All available
  - Shortcuts: Standard navigation
  - Actions: Standard photo actions

- **Trash Collection** 🗑️: Deleted photos with restore options
  - Tabs: Home, Recent, Albums, Search (no trash tab)
  - Shortcuts: Delete (permanent), R (restore)
  - Actions: Restore, delete permanently

- **Tag Collection** 🏷️: Photos with specific tag
  - Tabs: All available
  - Shortcuts: Standard navigation
  - Actions: Remove tag, standard photo actions

- **Import Collection** 📥: Photos from import directories
  - Tabs: Home, Recent, Albums, Search (standard set)
  - Shortcuts: Standard navigation + import-specific actions
  - Actions: Select photos for import, navigate directories, import selected photos

#### Single Photo Display (Unified viewer)
The **Single Photo Display** is a unified viewer that adapts its behavior based on the source collection:

- **Mode-aware Actions**: Available actions change based on source (album: remove from album, trash: restore/delete permanently)
- **Context-aware Navigation**: Navigation respects the source collection's photo order
- **Dynamic Shortcuts**: Keyboard shortcuts adapt to the current mode
- **Smart Info Panel**: Shows relevant information based on photo state and source

### Architecture Benefits

1. **Unified Interface**: Single PhotosList component handles all collection types
2. **Mode-specific Behavior**: Each mode provides its own tabs, shortcuts, and actions
3. **Clean State Management**: Collections encapsulate their own display logic
4. **Easy Extension**: New modes can be added by creating new PhotoCollection types
5. **Consistent UX**: All modes follow the same interaction patterns while providing mode-specific functionality

### Data Flow

1. **Backend Data** → **PhotoService** → **Photo Entities**
2. **Photo Entities** → **PhotoCollection.create*()** → **Collection with Mode**
3. **PhotoCollection** → **PhotosList Component** (simplified props)
4. **Photo Click** → **SinglePhotoDisplay.fromCollection()** → **Single Photo Mode**
5. **Navigation/Actions** → **Domain Methods** → **Updated Entities** → **React State**

### Legacy Compatibility

The new architecture maintains backward compatibility through:
- `Photo.toLegacyFormat()` method for existing components
- `PhotoService.toLegacyFormat()` for bulk conversion
- Gradual migration path without breaking existing functionality