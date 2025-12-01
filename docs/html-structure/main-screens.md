# PhotoClove Main Screens HTML Structure

This document describes the HTML structure for PhotoClove's main screens: Welcome, Home, Left Menu/Date List, Photo Grid, and Full-Screen Photo Display.

See also:
- [Component Hierarchy](../component-structure.md#component-hierarchy)
- [Photo Editor & Info Panels](photo-editor.md)
- [Sidebar Panels](sidebar-panels.md)
- [Import & Preferences](import-preferences.md)
- [CSS Reference](../css-reference.md)

## Main Application Container

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

## Welcome Screen

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

## Home Screen

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

## Left Menu and Date List

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

## Photo Grid View

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

## Full-Screen Photo Display

**Component**: `src/App/PhotosList/PhotosListMini.jsx` (735 lines, refactored from 833 lines)

**Utility Modules** (extracted for better organization):
- **`photoUtils.js`** (128 lines): Thumbnail display calculations
  - `calculateSimpleThumbnailDisplay()`: Calculate visible thumbnail range and navigation state
  - `createBorderStyles()`: Generate CSS border styles for thumbnail indicators
- **`useKeyboardShortcuts.js`** (124 lines): Keyboard navigation hook
  - Arrow keys: Navigate between photos
  - `c`, `s`, `d`, `i`, `f`: Photo operations (crop, star, delete, info, favorite)
  - `?`: Show help
  - `Del`: Delete photo
  - `Ctrl+0`: Reset zoom

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

## Footer

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
