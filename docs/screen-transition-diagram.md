# PhotoClove Screen Transition Diagram

```mermaid
graph TD
    %% Main Screens
    Welcome[Welcome Screen]
    Home[Home Screen]
    LeftMenu[Left Column Menu<br/>🏠🔍📥📚]
    DateView[Date View<br/>📅 Photos by Date]
    SearchView[Search View<br/>🔍 Search Results]
    AlbumView[Album View<br/>📚 Photos in Album]
    AlbumsList[Albums List<br/>📁 All Albums]
    Importer[Importer<br/>📥 Import Photos]
    DatePhotoViewer[Date Photo Viewer<br/>🖼️ From Date View]
    SearchPhotoViewer[Search Photo Viewer<br/>🖼️ From Search]
    AlbumPhotoViewer[Album Photo Viewer<br/>🖼️ From Album]
    
    %% Core Navigation Flow
    Welcome --> Home
    LeftMenu -->|🏠 Home| Home
    LeftMenu -->|🔍 Search| SearchView
    LeftMenu -->|📥 Import| Importer
    LeftMenu -->|📚 Albums| AlbumsList
    Home -->|Search bar| SearchView
    Home -->|Click date in DateList| DateView
    AlbumsList -->|Click album| AlbumView
    DateView -->|Click photo| DatePhotoViewer
    SearchView -->|Click photo| SearchPhotoViewer
    AlbumView -->|Click photo| AlbumPhotoViewer
    DatePhotoViewer -->|Close| DateView
    SearchPhotoViewer -->|Close| SearchView
    AlbumPhotoViewer -->|Close| AlbumView
    
    %% Styling
    classDef mainScreen fill:#374151,stroke:#6b7280,color:#e5e7eb
    classDef viewer fill:#1f2937,stroke:#3b82f6,color:#93c5fd
    classDef sameComponent fill:#4b5563,stroke:#8b5cf6,color:#c4b5fd
    classDef navigation fill:#059669,stroke:#10b981,color:#ecfdf5
    
    class Welcome,Home,Importer mainScreen
    class DatePhotoViewer,SearchPhotoViewer,AlbumPhotoViewer viewer
    class DateView,SearchView,AlbumView,AlbumsList sameComponent
    class LeftMenu navigation
```

## Navigation Elements

### Left Column Menu (Always Available)
The green **Left Column Menu** node represents the persistent navigation icons:
- 🏠 **Home** - Return to home screen
- 🔍 **Search** - Open search mode (advanced search)
- 📥 **Import** - Import photos
- 📚 **Albums** - View albums

### Additional Fixed Navigation
- **Top Menus** - File, Help (?) - Available everywhere
- **ESC key** - Returns to previous screen

## Screen Descriptions

### Core Screens
- **Welcome**: First-time setup (2 uses only)
- **Home**: Shows search bar and welcome image (DateList is in left sidebar)
- **Date View** 📅: Photos from selected date (uses PhotosList component)
- **Search View** 🔍: Search results page (uses PhotosList component)
- **Album View** 📚: Photos in selected album (uses PhotosList component)
- **Albums List** 📁: Grid of all albums (uses PhotosList component)
- **Importer** 📥: Directory scanning and photo import interface
- **Date Photo Viewer** 🖼️: Full-screen photo view from date selection
- **Search Photo Viewer** 🖼️: Full-screen photo view from search results
- **Album Photo Viewer** 🖼️: Full-screen photo view from album

### Component Notes
- **Date View**, **Search View**, **Album View**, and **Albums List** all use the same `PhotosList.jsx` component
- **Date Photo Viewer**, **Search Photo Viewer**, and **Album Photo Viewer** all use the same `PhotosListMini.jsx` component
- They appear as different pages to the user but share the same codebase
- Each photo viewer closes back to its specific originating view (the list view remains underneath)

### Navigation Notes
- **Left Column Menu** provides main navigation icons (always accessible)
- **Home screen** has dual search paths: search bar for quick search, search icon for advanced search
- **DateList** (in left sidebar) allows direct date selection to DateView  
- Clicking a photo opens Photo Viewer overlay
- Photo Viewer closes back to the underlying list view  
- Import stays open after importing photos (user manually navigates to other views)