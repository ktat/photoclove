# PhotoClove CSS Classes Reference

This document provides a comprehensive reference of CSS classes used throughout PhotoClove.

See also:
- [Component Hierarchy](component-structure.md#component-hierarchy)
- [HTML Structure - Main Screens](html-structure/main-screens.md)
- [HTML Structure - Photo Editor](html-structure/photo-editor.md)
- [HTML Structure - Sidebar Panels](html-structure/sidebar-panels.md)
- [HTML Structure - Import & Preferences](html-structure/import-preferences.md)

## Layout Classes

**Main Application Structure**

- `.container` - Main application wrapper
- `.inner-container` - Content wrapper inside main container
- `.leftMenu` - Left sidebar for navigation and dates
- `.centerDisplay` - Main content area (normal size)
- `.centerDisplayMax` - Main content area (maximized, no sidebars)
- `.rightMenu` - Right sidebar (open state)
- `.rightMenu-close` - Right sidebar (closed state)

## Component-Specific Classes

### Welcome & Home

- `.welcome` - Welcome screen styles
- `.welcome-splash` - Welcome screen splash container
- `.splash-container` - Generic splash image container
- `.splash` - Splash image element
- `.photo-clove` - PhotoClove logo/emoji
- `.introduce` - Introduction text
- `.tutorial` - Tutorial steps list
- `.useCount-{N}` - Tutorial step visibility based on use count
- `.home-search-container` - Home page search box container
- `.home-search-bar` - Home page search bar
- `.home-search-input` - Home page search input field
- `.home-search-button` - Home page search button
- `.home-advanced-search-button` - Home page advanced search button

### Photo Grid & Display

- `.photo-display` - Full-screen photo viewer
- `.photo-container` - Photo image container
- `.main-photo` - Main photo image element
- `.photo-list-header` - Photo grid header controls
- `.photo-page-info` - Photo count and page information
- `.photo-operation` - Sort/filter controls in header
- `.photo-list-menu` - Photo item menu (checkbox, info, external app)
- `.checkbox-photo` - Photo checkbox label
- `.run-app` - External app launcher button (🚀)
- `.pict-{size}` - Photo item with specific size
- `.dummy-grid-item` - Dummy grid items for layout

### Infinite Scroll

- `.infinite-scroll-footer` - Infinite scroll status container
- `.infinite-scroll-loading` - Loading indicator for infinite scroll
- `.infinite-scroll-prompt` - Load more prompt
- `.infinite-scroll-complete` - All photos loaded message
- `.infinite-scroll-limit` - Configuration limit warning
- `.loading-indicator` - Generic loading indicator
- `.scroll-prompt` - Scroll prompt message
- `.complete-message` - Completion message
- `.limit-warning` - Limit warning message

### Import System

- `.importDisplay` - Import interface container
- `.list-of-import-path` - Import source paths list
- `.import-progress` - Import progress information
- `.importer-photos` - Import photo grid
- `.import-photo` - Individual import photo item
- `.importer-directories-list` - Directory navigation list
- `.importer-files-list` - File selection area

### Preferences

- `.preferences` - Preferences screen container
- `.preferences-input` - Settings form layout
- `.row0` - Row for section headers
- `.row1` - Row for field labels
- `.row4` - Row for input fields
- `.row0-center` - Centered row for buttons
- `.row1-container` - Container for row1 elements
- `.row1-right` - Right-aligned row1 content

### Job Queue

- `.job-queue-container` - Job queue interface container
- `.job-units-section` - Job units table section
- `.job-units-table` - Job units table
- `.jobs-section` - Individual jobs table section
- `.jobs-table` - Individual jobs table
- `.cleanup-section` - Cleanup controls section
- `.auto-refresh-section` - Auto-refresh toggle section
- `.progress-bar` - Progress bar container
- `.progress-fill` - Progress bar fill element
- `.progress-text` - Progress text (e.g., "5/10")
- `.file-path` - File path display
- `.error-message` - Error text styling

### Sidebar & Tabs

- `.directory-vertical-tabs` - Vertical tab navigation
- `.directory-vertical-tab-button` - Individual tab button
- `.directory-vertical-text` - Tab button text
- `.directory-close-tab` - Close tab button
- `.tab-active` - Active tab panel
- `.tab` - Inactive tab panel
- `.tab-content` - Generic tab panel content

### Search & Filters

- `.search-tools` - Search tools container
- `.search-bar` - Search input container
- `.search-input` - Search text input
- `.search-button` - Search submit button
- `.clear-button` - Clear search button
- `.advanced-toggle` - Advanced filters toggle button
- `.search-filters-toggle` - Search filters toggle section
- `.toggle-advanced-filters` - Toggle advanced filters button
- `.advanced-filters` - Advanced search filters container
- `.filters-header` - Filters section header
- `.clear-filters-button` - Clear all filters button
- `.filter-section` - Individual filter section
- `.range-inputs` - Range input controls (ISO, aperture, etc.)
- `.extension-filters` - File extension filter checkboxes

### Saved Searches

- `.saved-searches` - Saved searches container
- `.saved-searches-header` - Saved searches header
- `.header-actions` - Header action buttons
- `.save-button` - Save search button
- `.export-button` - Export searches button
- `.import-button` - Import searches button
- `.searches-list` - List of saved searches
- `.search-item` - Individual search item
- `.search-info` - Search information section
- `.search-name` - Search name
- `.search-details` - Search details (query, type)
- `.search-query` - Search query text
- `.search-type` - Search type (in all, in album, etc.)
- `.search-actions` - Search item action buttons

### Photo Editor & Info

- `.photo-editor-panel` - Photo editor container
- `.editor-section` - Editor control section
- `.control-group` - Group of editor controls
- `.editor-actions` - Editor action buttons
- `.photo-info-section` - Photo information display
- `.info-item` - Individual info item (label + value)
- `.rating-section` - Star rating section
- `.star-rating` - Star rating container
- `.star` - Individual star element
- `.comment-section` - Comment input section
- `.actions-section` - Photo action buttons section

### Crop Overlay

- `.crop-overlay` - Crop overlay container
- `.crop-border` - Crop border element
- `.crop-corner` - Crop corner handles
  - `.top-left`, `.top-right`, `.bottom-left`, `.bottom-right` - Corner positions

### Log Viewer

- `.log-viewer-overlay` - LogViewer modal overlay
- `.log-viewer` - LogViewer main container
- `.log-viewer-header` - LogViewer header with actions
- `.log-viewer-actions` - LogViewer action buttons
- `.log-viewer-stats` - LogViewer statistics display
- `.log-viewer-filters` - LogViewer filter controls
- `.log-viewer-content` - LogViewer log entries container
- `.log-header` - LogViewer column headers
- `.log-header-time`, `.log-header-level`, `.log-header-component`, etc. - Individual column headers
- `.log-entries` - LogViewer log entries wrapper
- `.log-entry` - Individual log entry row
- `.log-{level}` - Log entry with specific level (e.g., `.log-DEBUG`, `.log-ERROR`)
- `.log-timestamp`, `.log-level`, `.log-component`, etc. - Log entry fields

### Footer

- `.footer` - Footer container
- `.footer-messages` - Footer status messages
- `.message-item` - Individual message item
- `.random-messages` - Random motivational messages container
- `.random-message` - Individual random message

## State Classes

**Element States**

- `.selected` - Selected state (e.g., selected photo in import)
- `.notSelected` - Not selected state
- `.active` - Active state (e.g., active tab, active button)
- `.status-{status}` - Job status indicators (e.g., `.status-pending`, `.status-completed`, `.status-failed`)

## Functional Classes

**Utility Classes**

- `.scroll-box` - Scrollable container
- `.checkbox` - Custom checkbox styling
- `.checkbox-normal` - Normal checkbox (not custom styled)
- `.checkbox-photo` - Photo checkbox style
- `.hover` - Hover state styling
- `.back-to-home` - Back to HOME button (search mode)
- `.search-mode-only` - Only visible in search mode
- `.debug` - Debug information container (usually hidden)

## Component Integration

### Commonly Used Combinations

**Photo Grid Item**:
```html
<div class="row pict-150">
  <div class="photo-list-menu">
    <input type="checkbox" id="photo-checkbox-0" />
    <label class="checkbox-photo checkbox hover" for="photo-checkbox-0"></label>
    <a href="#" class="run-app">🚀</a>
  </div>
</div>
```

**Tab Panel**:
```html
<div id="tab-filter" class="tab-active">
  <div class="filter-section">
    <!-- Filter content -->
  </div>
</div>
```

**Progress Bar**:
```html
<div class="progress-bar">
  <div class="progress-fill" style="width: 75%"></div>
</div>
<span class="progress-text">75/100</span>
```

**Log Entry**:
```html
<div class="log-entry log-INFO">
  <span class="log-timestamp">12:34:56</span>
  <span class="log-level">INFO</span>
  <span class="log-component">PhotosList</span>
  <span class="log-message">Photos loaded</span>
</div>
```

## Notes

- Many classes are dynamically applied based on component state
- Class names follow kebab-case convention
- Some classes use BEM-like naming (e.g., `.directory-vertical-tab-button`)
- State classes often use data attributes alongside CSS classes for JavaScript access
