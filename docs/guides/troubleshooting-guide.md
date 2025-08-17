# PhotoClove Troubleshooting Guide

This document provides comprehensive troubleshooting guidance for common issues in PhotoClove.

## Error Debugging Guides

### Import Not Working
**Check these areas**:
- **Job Queue**: [Job Queue Management](feature-sequences.md#job-queue-management)
- **File Permissions**: [File System Operations](architecture.md#file-system)
- **Configuration**: [Configuration Management](feature-quick-reference.md#-configuration-management)
- **Logs**: Background processing in `src-tauri/src/domain_service/job_queue_service.rs`

### Photos Not Displaying
**Check these areas**:
- **Database**: [Database Operations](feature-quick-reference.md#-database-operations)
- **Thumbnails**: [Performance Optimizations](architecture.md#4-performance-optimizations)
- **File Paths**: [Filesystem Organization](architecture.md#filesystem-organization)
- **Sequences**: [Photo Viewing Feature](feature-sequences.md#photo-viewing-feature)

### Troubleshooting Display Issues
1. **Check component visibility conditions** in parent components (App.jsx)
2. **Verify state management** Context values and prop passing, especially UIContext initial states
3. **Review useEffect dependencies** for data loading triggers
4. **Common startup issues**: Ensure UIContext showPhotosList starts as false to prevent "No Photo Found!" at startup
5. **Follow bug investigation guide** in `CLAUDE.md` for systematic debugging
6. **Use LogViewer** (Ctrl+Shift+L) to inspect frontend state and backend responses

### Performance Issues
**Optimization areas**:
- **Lazy Loading**: [Performance Optimization Strategies](feature-sequences.md#performance-optimization-strategies)
- **Background Processing**: [Background Job Processing](feature-quick-reference.md#-background-job-processing)
- **Caching**: [Lazy Loading and Caching](feature-sequences.md#1-lazy-loading-and-caching)
- **Database Indexing**: [SQLite Database Schema](architecture.md#sqlite-database-schema)

### UI Layout Issues
**Check these areas**:
- **Component Structure**: [HTML Element IDs and Structure](component-structure.md#html-element-ids-and-structure)
- **CSS Classes**: [CSS Classes and Styling](component-structure.md#css-classes-and-styling)
- **Layout Components**: [Layout Classes](component-structure.md#layout-classes)

## Recent Bug Fixes

### Import Functionality Integration 
**Fixed 2025-07-26**: Complete integration of import functionality using PhotosList/PhotosListMini with ImportState entity, eliminated separate Importer.jsx component

### ViewMode Display Condition Methods
**Fixed 2025-07-26**: Added comprehensive display condition methods to ViewMode class for DirectoryMenu, centralizing UI logic and improving maintainability

### DirectoryMenu ViewMode Refactoring
**Fixed 2025-07-26**: Replaced all const mode checks with ViewMode object methods, improved code consistency and reduced prop drilling

### ViewMode DDD Architecture Implementation
**Fixed 2025-07-26**: Complete refactoring to Domain-Driven Design with ViewMode value object, eliminated 60+ boolean variables, fixed photo navigation bugs

### Single Photo Mode Transition
**Fixed 2025-07-26**: Photo click from list to full-screen view broken due to display key inconsistencies, resolved with unified ViewMode methods

### Tag Navigation Issues
**Fixed 2025-07-26**: Tag icon not working from Album mode, tag list clicks not changing pages, resolved with ViewMode synchronization

### Photo Display Key Mismatches
**Fixed 2025-07-26**: Multiple display key calculation inconsistencies causing photo view failures, standardized with ViewMode.getDataAttribute()

### Filter System Enhancement
**Fixed 2025-07-26**: Improved filter UI/UX with "Has Tag" filter, enhanced filter popover, active filter summaries

### First-Click Photo Loading Bug
**Fixed 2025-07-20**: Null reference error in PhotosList.jsx logging code prevented photo state updates on first date/Recent Photos click after startup. Fixed with optional chaining in logging code

### Startup State Issue
**Fixed**: Changed UIContext showPhotosList initial state from true to false, prevents "No Photo Found!" at startup, properly shows Welcome/Home screen

### Date List Performance
**Fixed**: Implemented date_summary table optimization with smart rebuild logic for ~10x faster date loading

### Thumbnail List Not Updating After Deletion
**Fixed**: DEL key deletion now properly removes photos from thumbnail list in all viewing modes

### Date Dependencies in Multi-Mode Views
**Fixed**: Recent Photos and Search modes now work independently of currentDate, with proper pagination and thumbnail generation

### Photo Display State Management
**Fixed**: Implemented DDD architecture with Photo entity to handle display paths correctly across normal and trash modes

### Trash Photos Disappearing on Scroll
**Fixed**: Properly handle trash photo paths in infinite scroll mode to prevent photos from disappearing

### Permanent Delete with Thumbnails
**Fixed**: Implemented complete permanent delete that removes both original files and cached thumbnails from all locations