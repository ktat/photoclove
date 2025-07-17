# PhotoClove Component and HTML Structure

This document describes the React component hierarchy and HTML element structure with their IDs and CSS classes.

## Component Hierarchy

```
App (root)
├── Welcome (first-time users)
│   ├── WelcomeImage
│   └── Tutorial steps
├── Home (main dashboard)
│   └── WelcomeImage
├── PhotosList (main photo view)
│   ├── PhotosListMini (full-screen viewer)
│   │   └── PhotoDisplay
│   ├── PhotoLoading
│   └── DirectoryMenu
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

```html
<div id="photoList" 
     class="centerDisplay" | "centerDisplayMax"
     data-date="{YYYY/MM/DD}" 
     data-page="{N}">
  
  <!-- Header with navigation and controls -->
  <div class="photo-list-header">
    <div class="photo-page-info">{date} page:{N}</div>
    <div class="navigation">
      <a href="#">&lt;&lt; Prev</a>
      <a href="#">Next &gt;&gt;</a>
    </div>
    <div class="photo-operation">
      <select name="icon_size">Icon size options</select>
      <select name="sort">Sort options</select>
      <select name="num">Items per page</select>
      <select name="extension_filter">File type filter</select>
    </div>
  </div>
  
  <!-- Scrollable photo grid -->
  <div class="scroll-box photos">
    <!-- Scroll indicators -->
    <div class="scroll-indicator">
      <div class="scroll-indicator-text up">⬆ scroll to load more ⬆</div>
    </div>
    
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
    
    <div class="scroll-indicator">
      <div class="scroll-indicator-text down">⬇ scroll to load more ⬇</div>
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
  <!-- Tab navigation -->
  <div class="tab-menu">
    <a href="#tab-filter" class="tab-link active">Filter</a>
    <a href="#tab-maintenance" class="tab-link">Maintenance</a>
    <a href="#tab-selection" class="tab-link">Selection</a>
  </div>
  
  <!-- Filter tab -->
  <div id="tab-filter" class="tab-content active">
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
  <div id="tab-maintenance" class="tab-content">
    <button onClick="createThumbnails">Create Thumbnails</button>
    <button onClick="createDatabase">Create Database</button>
  </div>
  
  <!-- Selection tab -->
  <div id="tab-selection" class="tab-content">
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

This structure provides a comprehensive view of the application's component hierarchy and DOM structure, making it easier to understand the codebase organization and implement features or modifications.