# PhotoClove Component and HTML Structure

This document describes the React component hierarchy and HTML element structure with their IDs and CSS classes.

## Component Hierarchy

```
App (root)
├── Welcome (first-time users)
│   ├── WelcomeImage
│   └── Tutorial steps
├── Home (main dashboard)
│   ├── WelcomeImage
│   └── Home Search Box
├── PhotosList (main photo view & search results)
│   ├── PhotosListMini (full-screen viewer)
│   │   └── PhotoDisplay
│   ├── PhotoLoading
│   ├── DirectoryMenu (with search tools tab)
│   │   ├── SearchTools (search tab content)
│   │   │   ├── SearchBar
│   │   │   ├── AdvancedFilters
│   │   │   └── SavedSearches
│   │   ├── Filter Tab
│   │   ├── Maintenance Tab
│   │   └── Selection Tab
│   └── Back to HOME Button (in search mode)
├── PhotoOption (photo metadata panel)
│   ├── PhotoEditor (image editing)
│   └── PhotoInfo (metadata display)
├── Importer (photo import interface)
│   └── SelectedPhotoInfo
├── Preferences (settings)
│   └── FolderPicker (multiple instances)
├── JobQueue (background jobs)
├── DateList (calendar sidebar)
└── Footer
    └── RandomMessages
```

## HTML Element IDs and Structure

### Main Application Container

```html
<div class="container">
  <div class="inner-container">
    <!-- Left sidebar menu -->
    <div id="leftMenu" class="leftMenu">
      <!-- Import link and DateList component -->
    </div>
    
    <!-- Main content area -->
    <div class="centerDisplay" | class="centerDisplayMax">
      <!-- Dynamic content based on current view -->
    </div>
    
    <!-- Right sidebar -->
    <div class="rightMenu" | class="rightMenu-close">
      <!-- PhotoOption or DirectoryMenu -->
    </div>
  </div>
  
  <!-- Footer -->
  <Footer />
</div>
```

### Welcome Screen

```html
<div id="welcome-container">
  <h1>Wellcome to PhotoClove!</h1>
  
  <!-- Splash screen -->
  <div class="welcome-splash">
    <div class="splash-container">
      <img class="splash" src="..." />
    </div>
  </div>
  
  <!-- Welcome content -->
  <div id="welcome">
    <div class="welcome">
      <div class="photo-clove">🦀</div>
      <div class="introduce">PhotoClove is an application...</div>
      <ol class="tutorial">
        <li><span class="useCount-{N}">Configure preferences...</span></li>
        <li><span class="useCount-{N}">Import photos...</span></li>
      </ol>
    </div>
  </div>
</div>
```

### Home Screen

```html
<div id="home-container">
  <div>
    <pre style="..."><!-- ASCII art message --></pre>
    
    <!-- Search Box -->
    <div class="home-search-container">
      <div class="home-search-bar">
        <input type="text" placeholder="Search photos..." class="home-search-input" />
        <button class="home-search-button">Search</button>
        <button class="home-advanced-search-button">Advanced Search</button>
      </div>
    </div>
    
    <div class="splash-container">
      <img class="splash" src="..." width="100%" />
    </div>
  </div>
</div>
```

### Left Menu and Date List

```html
<div id="leftMenu" class="leftMenu">
  <a href="#" onClick="toggleImporter">➡import</a>
  
  <!-- Hidden search (not currently used) -->
  <div class="row" style="display: none">
    <input id="search-input" placeholder="Enter words for search" />
    <button type="button">Search</button>
  </div>
  
  <!-- DateList component -->
  <div class="date-list">
    <!-- Date items rendered dynamically -->
  </div>
</div>
```

### Photo Grid View

**Updated for Infinite Scroll Implementation**

```html
<div id="photoList" 
     class="centerDisplay" | "centerDisplayMax"
     data-date="{YYYY/MM/DD}" | "search_results"
     data-page="{N}">
  
  <!-- Back to HOME button (search mode only) -->
  <div style="float: left; margin-bottom: 10px" class="search-mode-only">
    <a href="#" class="back-to-home">Back to HOME</a>
  </div>
  
  <!-- Header with photo count and controls -->
  <div class="photo-list-header">
    <div class="photo-page-info">
      <!-- Search mode: Back to HOME + photo count -->
      <a href="#" class="back-to-home">Back to HOME</a>
      <span style="margin-left: 10px">Search: "query" (X photos)</span>
      <!-- Date mode: date + photo count -->
      <span>{date} (X photos)</span>
      <!-- Infinite scroll status -->
      <span style="margin-left: 10px; font-size: 12px; color: #666"> - Showing: X photos</span>
      <!-- Configuration limit warning -->
      <span style="margin-left: 10px; font-size: 11px; color: #f60; font-weight: bold"> (Limited by config)</span>
    </div>
    <!-- Navigation controls removed in infinite scroll -->
    <div class="photo-operation">
      <select name="icon_size">Icon size options</select>
      <select name="sort">Sort options</select>
      <!-- Num selector removed - not needed with infinite scroll -->
      <select name="extension_filter">File type filter</select>
    </div>
  </div>
  
  <!-- Infinite scroll photo grid -->
  <div class="scroll-box photos">
    <!-- No scroll indicators with infinite scroll -->
    
    <!-- Photo items -->
    <div class="row pict-{size}" style="flex: 0 0 {size}px">
      <div style="flexShrink: 0">
        <a href="#" onClick="displayPhoto">
          <img loading="eager" style="..." src="..." alt="..." />
          <!-- Video overlay for MP4/WebM -->
          <div style="...">▶</div>
        </a>
      </div>
      <div class="photo-list-menu">
        <input type="checkbox" id="photo-checkbox-{i}" />
        <label class="checkbox-photo checkbox hover" for="photo-checkbox-{i}"></label>
        <a href="#" onClick="showInfo">(ⓘ)</a>
        <a href="#" class="run-app" onClick="openExternal">🚀</a>
      </div>
    </div>
    
    <!-- Dummy grid items for scroll effect -->
    <div class="dummy-grid-item" style="height: {size}px"></div>
  </div>
  
  <!-- Infinite scroll footer -->
  <div class="infinite-scroll-footer">
    <!-- Loading state -->
    <div class="infinite-scroll-loading" style="display: {isLoadingMore ? 'block' : 'none'}">
      <div class="loading-indicator">Loading...</div>
    </div>
    
    <!-- Load more prompt -->
    <div class="infinite-scroll-prompt" style="display: {canLoadMore ? 'block' : 'none'}">
      <div class="scroll-prompt">Scroll to load more</div>
    </div>
    
    <!-- All photos loaded message -->
    <div class="infinite-scroll-complete" style="display: {allPhotosLoaded ? 'block' : 'none'}">
      <div class="complete-message">All photos displayed</div>
    </div>
    
    <!-- Configuration limit warning -->
    <div class="infinite-scroll-limit" style="display: {isLimitedByConfig ? 'block' : 'none'}">
      <div class="limit-warning">More photos available, but limited by configuration (limit: {configLimit})</div>
    </div>
  </div>
  
  <!-- Debug information (hidden by default) -->
  <div class="debug" style="display: none; ...">Debug messages</div>
</div>
```

### Full-Screen Photo Display

```html
<div id="photos-display-wrapper" style="display: block">
  <div class="photo-display">
    <!-- PhotosListMini component content -->
    <div id="photo" class="photo-container">
      <img id="main-photo" class="main-photo" />
      <!-- Crop overlay when in crop mode -->
      <div id="crop-overlay" class="crop-overlay" style="...">
        <div class="crop-border"></div>
        <div class="crop-corner top-left"></div>
        <div class="crop-corner top-right"></div>
        <div class="crop-corner bottom-left"></div>
        <div class="crop-corner bottom-right"></div>
      </div>
    </div>
    
    <!-- Navigation controls -->
    <div class="photo-navigation">
      <button onClick="previousPhoto">Previous</button>
      <button onClick="nextPhoto">Next</button>
      <button onClick="closeDisplay">Close</button>
    </div>
  </div>
</div>
```

### Photo Editor Panel

```html
<div class="photo-editor-panel">
  <!-- Transform controls -->
  <div class="editor-section">
    <h3>Transform</h3>
    <div class="control-group">
      <label>Brightness: <input type="range" min="-100" max="100" /></label>
      <label>Contrast: <input type="range" min="-100" max="100" /></label>
      <label>Saturation: <input type="range" min="-100" max="100" /></label>
      <label>Hue: <input type="range" min="-180" max="180" /></label>
      <label>Blur: <input type="range" min="0" max="10" /></label>
      <label>Rotation: <input type="range" min="-180" max="180" /></label>
    </div>
  </div>
  
  <!-- Crop controls -->
  <div class="editor-section">
    <h3>Crop</h3>
    <button onClick="toggleCropMode">Toggle Crop Mode</button>
    <button onClick="applyCrop">Apply Crop</button>
    <button onClick="resetCrop">Reset Crop</button>
  </div>
  
  <!-- Action buttons -->
  <div class="editor-actions">
    <button onClick="saveStyle">Save Style</button>
    <button onClick="saveAsCopy">Save As Copy</button>
    <button onClick="resetAll">Reset All</button>
  </div>
</div>
```

### Import Interface

```html
<div id="importPhotosDisplay" class="importDisplay" data-page="{N}">
  <!-- Import source paths -->
  <ul class="list-of-import-path">
    <li><strong>Import Photos From</strong>:</li>
    <li><a href="#" onClick="showImporter">{path}</a></li>
  </ul>
  
  <!-- Progress information -->
  <div class="import-progress">
    <span>Now Importing... {progress} / {total}</span>
    <span>({rate} /sec : {time_left} mins left)</span>
  </div>
  
  <div id="import-container">
    <!-- Directory navigation -->
    <div id="importer-directories-list">
      <p>{currentPath}:</p>
      <ul>
        <li><a href="#" onClick="navigateUp">..</a></li>
        <li>📁 <a href="#" onClick="navigateToDir">{dirname}</a></li>
      </ul>
    </div>
    
    <!-- File selection area -->
    <div id="importer-files-list">
      <!-- Controls -->
      <div class="row1-container">
        <div class="row1">page. {N}</div>
        <div class="row1-right">
          Created Date: after <input id="filterDate" name="date" type="date" />
        </div>
      </div>
      
      <!-- Selection buttons -->
      <div class="row0-center">
        <button onClick="selectAllInPage">Select All photos in this page</button>
        <button onClick="selectAll">Select All photos in all pages</button>
        <button onClick="unselectAll">Unselect All</button>
      </div>
      
      <!-- Navigation -->
      <div class="navigation">
        <a href="#">&lt;&lt; Prev</a>
        <a href="#">Next &gt;&gt;</a>
      </div>
      
      <!-- Photo grid -->
      <div class="importer-photos">
        <div class="row selected" | "row notSelected">
          <a href="#" id="{path}" class="import-photo" data-created-at="{date}">
            <img src="..." style="width: 100px" />
          </a>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Preferences Screen

```html
<div id="preferences" class="preferences">
  <h1>Preferences</h1>
  <div class="preferences-input">
    <!-- Directory pickers -->
    <div class="row0">DataPath:</div>
    <div class="row1">
      <input type="text" readonly />
      <button onClick="pickFolder">Browse</button>
    </div>
    
    <!-- Thumbnail settings -->
    <div class="row0">Thumbnail:</div>
    <div class="row1">Store Path:</div>
    <div class="row4">[FolderPicker component]</div>
    
    <div class="row1">CompressQuality:</div>
    <div class="row4">
      <select>
        <option value="0.01">1%</option>
        <option value="0.05">5%</option>
        <!-- ... -->
      </select>
    </div>
    
    <!-- Parallel processing settings -->
    <div class="row0">Num of Parallel:</div>
    <div class="row1">Import:</div>
    <div class="row4"><input type="number" step="1" /></div>
    
    <!-- Tutorial reset -->
    <div class="row0">
      <input type="checkbox" id="preference-check" />
      <label class="checkbox checkbox-normal" for="preference-check">
        Show Welcome tutorial again?
      </label>
    </div>
    
    <!-- Save button -->
    <div class="row0">
      <button name="save" onClick="saveConfig">SAVE</button>
    </div>
  </div>
</div>
```

### Job Queue Interface

```html
<div class="job-queue-container">
  <h2>Job Queue Status</h2>
  
  <!-- Job units table -->
  <div class="job-units-section">
    <h3>Job Units</h3>
    <table class="job-units-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Status</th>
          <th>Progress</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{unit_id}</td>
          <td>{job_type}</td>
          <td class="status-{status}">{status}</td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {percent}%"></div>
            </div>
          </td>
          <td>{created_at}</td>
          <td>
            <button onClick="deleteJobUnit">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  
  <!-- Individual jobs table -->
  <div class="jobs-section">
    <h3>Individual Jobs</h3>
    <table class="jobs-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Unit ID</th>
          <th>Status</th>
          <th>File Path</th>
          <th>Error</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{job_id}</td>
          <td>{unit_id}</td>
          <td class="status-{status}">{status}</td>
          <td class="file-path">{source_path}</td>
          <td class="error-message">{error_message}</td>
          <td>
            <button onClick="retryJob">Retry</button>
            <button onClick="deleteJob">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  
  <!-- Cleanup controls -->
  <div class="cleanup-section">
    <button onClick="cleanupCompleted">Cleanup Completed Jobs</button>
  </div>
</div>
```

### Right Sidebar Panels

#### Directory Menu (when no photo selected)

```html
<div class="rightMenu">
  <!-- Vertical tabs -->
  <div class="directory-vertical-tabs">
    <button class="directory-vertical-tab-button active" title="Search Tools">
      <span class="directory-vertical-text">Search</span>
    </button>
    <button class="directory-vertical-tab-button" title="Filter Photos">
      <span class="directory-vertical-text">Filter</span>
    </button>
    <button class="directory-vertical-tab-button" title="Photo Selection">
      <span class="directory-vertical-text">Selection</span>
    </button>
    <button class="directory-vertical-tab-button" title="Maintenance Tools">
      <span class="directory-vertical-text">Maintenance</span>
    </button>
    <button class="directory-vertical-tab-button directory-close-tab" title="Close Panel">
      ×
    </button>
  </div>
  
  <!-- Search tab (search mode only) -->
  <div id="tab-search" class="tab-active">
    <div class="search-tools">
      <!-- Search Bar -->
      <div class="search-bar">
        <input type="text" placeholder="Search photos..." class="search-input" />
        <button class="search-button">🔍</button>
        <button class="clear-button">✕</button>
        <button class="advanced-toggle">⚙️</button>
      </div>
      
      <!-- Advanced Filters Toggle -->
      <div class="search-filters-toggle">
        <button class="toggle-advanced-filters">Show Advanced Filters</button>
      </div>
      
      <!-- Advanced Filters (when visible) -->
      <div class="advanced-filters">
        <div class="filters-header">
          <h3>Advanced Filters</h3>
          <button class="clear-filters-button">Clear All</button>
        </div>
        
        <!-- Camera Equipment -->
        <div class="filter-section">
          <h4>Camera Equipment</h4>
          <select>Camera options</select>
          <select>Lens options</select>
        </div>
        
        <!-- Technical Settings -->
        <div class="filter-section">
          <h4>Technical Settings</h4>
          <div class="range-inputs">ISO range</div>
          <div class="range-inputs">Aperture range</div>
          <div class="range-inputs">Focal length range</div>
        </div>
        
        <!-- Date Range -->
        <div class="filter-section">
          <h4>Date Range</h4>
          <input type="date" />
          <input type="date" />
        </div>
        
        <!-- Other Filters -->
        <div class="filter-section">
          <h4>Other Filters</h4>
          <select>File extension</select>
          <select>Star rating</select>
          <input type="checkbox" />Has Comments
        </div>
      </div>
      
      <!-- Saved Searches -->
      <div class="saved-searches">
        <div class="saved-searches-header">
          <h3>Saved Searches</h3>
          <div class="header-actions">
            <button class="save-button">💾</button>
            <button class="export-button">📤</button>
            <button class="import-button">📥</button>
          </div>
        </div>
        
        <!-- Search items -->
        <div class="searches-list">
          <div class="search-item">
            <div class="search-info">
              <div class="search-name">My Search</div>
              <div class="search-details">
                <span class="search-query">"vacation"</span>
                <span class="search-type">in all</span>
              </div>
            </div>
            <div class="search-actions">
              <button>✏️</button>
              <button>📝</button>
              <button>🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Filter tab -->
  <div id="tab-filter" class="tab">
    <!-- Star filter -->
    <div class="filter-section">
      <h4>Star Rating</h4>
      <select name="star-filter">
        <option value="0">All</option>
        <option value="1">1 star+</option>
        <!-- ... -->
      </select>
    </div>
    
    <!-- Comment filter -->
    <div class="filter-section">
      <input type="checkbox" id="has-comment-filter" />
      <label for="has-comment-filter">Has Comments</label>
    </div>
  </div>
  
  <!-- Maintenance tab -->
  <div id="tab-maintenance" class="tab">
    <button onClick="createThumbnails">Create Thumbnails</button>
    <button onClick="createDatabase">Create Database</button>
  </div>
  
  <!-- Selection tab -->
  <div id="tab-selection" class="tab">
    <div class="selection-info">{count} photos selected</div>
    <button onClick="clearSelection">Clear Selection</button>
    <button onClick="selectAll">Select All</button>
    <button onClick="deleteSelected">Delete Selected</button>
  </div>
</div>
```

#### Photo Options Panel (when photo selected)

```html
<div class="rightMenu">
  <!-- Photo metadata display -->
  <div class="photo-info-section">
    <h3>Photo Information</h3>
    <div class="info-item">
      <label>File:</label>
      <span class="file-path">{filename}</span>
    </div>
    <div class="info-item">
      <label>Size:</label>
      <span>{width} x {height}</span>
    </div>
    <div class="info-item">
      <label>Date:</label>
      <span>{date_taken}</span>
    </div>
  </div>
  
  <!-- Star rating -->
  <div class="rating-section">
    <h4>Rating</h4>
    <div class="star-rating">
      <span class="star" data-rating="1">⭐</span>
      <span class="star" data-rating="2">⭐</span>
      <span class="star" data-rating="3">⭐</span>
      <span class="star" data-rating="4">⭐</span>
      <span class="star" data-rating="5">⭐</span>
    </div>
  </div>
  
  <!-- Comments -->
  <div class="comment-section">
    <h4>Comment</h4>
    <textarea placeholder="Add a comment..."></textarea>
    <button onClick="saveComment">Save Comment</button>
  </div>
  
  <!-- Actions -->
  <div class="actions-section">
    <button onClick="openInEditor">Edit Photo</button>
    <button onClick="openInExternal">Open in External App</button>
    <button onClick="moveToTrash">Delete</button>
  </div>
</div>
```

### Footer

```html
<footer class="footer">
  <div class="footer-messages">
    <!-- Dynamic status messages -->
    <div class="message-item">{message_text}</div>
  </div>
  
  <!-- Random motivational messages -->
  <div class="random-messages">
    <span class="random-message">{random_text}</span>
  </div>
</footer>
```

## CSS Classes and Styling

### Layout Classes
- `.container` - Main application wrapper
- `.inner-container` - Content wrapper inside main container
- `.leftMenu` - Left sidebar for navigation and dates
- `.centerDisplay` / `.centerDisplayMax` - Main content area (normal/maximized)
- `.rightMenu` / `.rightMenu-close` - Right sidebar (open/closed)

### Component-Specific Classes
- `.welcome` - Welcome screen styles
- `.photo-display` - Full-screen photo viewer
- `.photo-list-header` - Photo grid header controls
- `.photo-operation` - Sort/filter controls
- `.importer-photos` - Import photo grid
- `.preferences-input` - Settings form layout
- `.tab-content` - Tab panel content
- `.scroll-indicator` - Loading indicators
- `.search-tools` - Search tools container
- `.search-bar` - Search input container
- `.advanced-filters` - Advanced search filters
- `.saved-searches` - Saved searches container
- `.back-to-home` - Back to HOME button (search mode)
- `.directory-vertical-tabs` - Vertical tab navigation
- `.home-search-container` - Home page search box
- `.log-viewer-overlay` - LogViewer modal overlay
- `.log-viewer` - LogViewer main container
- `.log-viewer-header` - LogViewer header with actions
- `.log-viewer-stats` - LogViewer statistics display
- `.log-viewer-filters` - LogViewer filter controls
- `.log-viewer-content` - LogViewer log entries container
- `.log-header` - LogViewer column headers
- `.log-entries` - LogViewer log entries wrapper
- `.log-entry` - Individual log entry row
- `.infinite-scroll-footer` - Infinite scroll status container
- `.infinite-scroll-loading` - Loading indicator for infinite scroll
- `.infinite-scroll-prompt` - Load more prompt for infinite scroll
- `.infinite-scroll-complete` - All photos loaded message
- `.infinite-scroll-limit` - Configuration limit warning

### State Classes
- `.selected` / `.notSelected` - Selection state
- `.active` - Active tab/button state
- `.status-{status}` - Job status indicators
- `.useCount-{N}` - Tutorial step visibility

### Functional Classes
- `.scroll-box` - Scrollable container
- `.checkbox` - Custom checkbox styling
- `.progress-bar` / `.progress-fill` - Progress indicators
- `.file-path` - File path display
- `.error-message` - Error text styling

### Debug Log Viewer

```html
<div class="log-viewer-overlay">
  <div class="log-viewer">
    <!-- Header with actions -->
    <div class="log-viewer-header">
      <h2>Debug Logs</h2>
      <div class="log-viewer-actions">
        <button onClick="exportLogs">Export Logs</button>
        <button onClick="clearFrontendLogs">Clear Frontend Logs</button>
        <button onClick="loadLogs">Refresh</button>
        <button onClick="onClose">Close</button>
      </div>
    </div>

    <!-- Statistics display -->
    <div class="log-viewer-stats">
      <span>Frontend Logs: {stats.totalLogs}</span>
      <span>Session: {stats.sessionId}</span>
      <span>Raw Frontend: {logs.length}</span>
      <span>Backend Lines: {backendLines}</span>
      <span>Total Displayed: {filteredLogs.length}</span>
    </div>

    <!-- Filter controls -->
    <div class="log-viewer-filters">
      <label>Level:
        <select value={filters.level}>
          <option value="all">All</option>
          <option value="DEBUG">Debug</option>
          <option value="INFO">Info</option>
          <option value="WARN">Warning</option>
          <option value="ERROR">Error</option>
        </select>
      </label>
      <label>Component:
        <select value={filters.component}>
          <option value="all">All</option>
          <!-- Dynamic component options -->
        </select>
      </label>
      <label>Source:
        <select value={filters.source}>
          <option value="all">All</option>
          <option value="frontend">Frontend Only</option>
          <option value="backend">Backend Only</option>
        </select>
      </label>
      <label>Since:
        <select value={filters.since}>
          <option value="5m">Last 5 minutes</option>
          <option value="1h">Last hour</option>
          <option value="24h">Last 24 hours</option>
          <option value="all">All time</option>
        </select>
      </label>
    </div>

    <!-- Log entries display -->
    <div class="log-viewer-content">
      <!-- Column headers -->
      <div class="log-header">
        <span class="log-header-time">Time</span>
        <span class="log-header-level">Level</span>
        <span class="log-header-component">Component</span>
        <span class="log-header-event">Event</span>
        <span class="log-header-message">Message</span>
        <span class="log-header-correlation">Correlation ID</span>
      </div>
      
      <!-- Log entries -->
      <div class="log-entries">
        <div class="log-entry log-{level}">
          <span class="log-timestamp">{time}</span>
          <span class="log-level">{level}</span>
          <span class="log-component">{component}</span>
          <span class="log-event">{event}</span>
          <span class="log-message">{message}</span>
          <span class="log-correlation">{correlationId}</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Key Features:**
- **Global Accessibility**: Available from any page via Help menu → "Show log" or `Ctrl+Shift+L`
- **Structured Logging**: Frontend and backend logs with correlation tracking
- **Real-time Updates**: Automatically refreshes every 5 seconds
- **Advanced Filtering**: By level, component, source, and time range
- **Export Functionality**: Download logs as JSON for external analysis
- **Cross-boundary Correlation**: Links frontend actions with backend operations

This structure provides a comprehensive view of the application's component hierarchy and DOM structure, making it easier to understand the codebase organization and implement features or modifications.