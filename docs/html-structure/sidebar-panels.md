# PhotoClove Sidebar Panels HTML Structure

This document describes the HTML structure for PhotoClove's right sidebar panels: Directory Menu (filters, search, maintenance) and Photo Options Panel.

See also:
- [Component Hierarchy](../component-structure.md#component-hierarchy)
- [Main Screens](main-screens.md)
- [Photo Editor & Info](photo-editor.md)
- [CSS Reference](../css-reference.md)

## Directory Menu (when no photo selected)

**Component**: `src/App/PhotosList/DirectoryMenu.jsx` (966 lines)

This sidebar appears when no photo is selected and provides filtering, search, maintenance, and selection operations.

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
        <option value="2">2 stars+</option>
        <option value="3">3 stars+</option>
        <option value="4">4 stars+</option>
        <option value="5">5 stars</option>
      </select>
    </div>

    <!-- Comment filter -->
    <div class="filter-section">
      <input type="checkbox" id="has-comment-filter" />
      <label for="has-comment-filter">Has Comments</label>
    </div>

    <!-- Tag filter -->
    <div class="filter-section">
      <input type="checkbox" id="has-tag-filter" />
      <label for="has-tag-filter">Has Tags</label>
    </div>

    <!-- Extension filters -->
    <div class="filter-section">
      <h4>File Types</h4>
      <div class="extension-filters">
        <label><input type="checkbox" name="ext-jpg" />JPG</label>
        <label><input type="checkbox" name="ext-png" />PNG</label>
        <label><input type="checkbox" name="ext-gif" />GIF</label>
        <label><input type="checkbox" name="ext-mp4" />MP4</label>
        <label><input type="checkbox" name="ext-webm" />WebM</label>
      </div>
    </div>
  </div>

  <!-- Maintenance tab -->
  <div id="tab-maintenance" class="tab">
    <button onClick="createThumbnails">Create Thumbnails</button>
    <button onClick="createDatabase">Create Database in Date</button>
    <button onClick="movePhotosToExifDate">Move Photos to EXIF Date</button>
  </div>

  <!-- Selection tab -->
  <div id="tab-selection" class="tab">
    <div class="selection-info">{count} photos selected</div>
    <button onClick="clearSelection">Clear Selection</button>
    <button onClick="selectAll">Select All</button>

    <!-- Album operations -->
    <div class="album-operations">
      <button onClick="createAlbum">Create Album from Selection</button>
      <button onClick="addToAlbum">Add to Album</button>
    </div>

    <!-- Tag operations -->
    <div class="tag-operations">
      <button onClick="addTags">Add Tags</button>
    </div>

    <!-- Destructive operations -->
    <div class="destructive-operations">
      <button onClick="deleteSelected">Delete Selected</button>
      <button onClick="removeFromAlbum">Remove from Album</button>
    </div>

    <!-- Import mode operations -->
    <div class="import-operations" style="display: {isImportMode ? 'block' : 'none'}">
      <button onClick="importSelected">Import Selected</button>
    </div>
  </div>
</div>
```

## Debug Log Viewer

**Component**: `src/App/LogViewer.jsx`

Global accessibility via Help menu → "Show log" or `Ctrl+Shift+L`

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
- Structured logging with correlation tracking
- Real-time updates every 5 seconds
- Advanced filtering by level, component, source, time range
- Export functionality (download as JSON)
- Cross-boundary correlation (frontend ↔ backend)
