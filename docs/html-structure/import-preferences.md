# PhotoClove Import, Preferences & Job Queue HTML Structure

This document describes the HTML structure for PhotoClove's Import interface, Preferences screen, and Job Queue interface.

See also:
- [Component Hierarchy](../component-structure.md#component-hierarchy)
- [Main Screens](main-screens.md)
- [Sidebar Panels](sidebar-panels.md)
- [CSS Reference](../css-reference.md)

## Import Interface

**Component**: `src/App/Importer.jsx`

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

## Preferences Screen

**Component**: `src/App/Preferences/index.jsx`

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
        <option value="0.10">10%</option>
        <option value="0.20">20%</option>
        <option value="0.30">30%</option>
        <option value="0.50">50%</option>
        <option value="0.70">70%</option>
        <option value="0.90">90%</option>
      </select>
    </div>

    <!-- Parallel processing settings -->
    <div class="row0">Num of Parallel:</div>
    <div class="row1">Import:</div>
    <div class="row4"><input type="number" step="1" min="1" max="10" /></div>

    <div class="row1">Thumbnail Generation:</div>
    <div class="row4"><input type="number" step="1" min="1" max="10" /></div>

    <!-- Display settings -->
    <div class="row0">Display:</div>
    <div class="row1">Photos per page:</div>
    <div class="row4"><input type="number" step="50" min="50" max="1000" /></div>

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

## Job Queue Interface

**Component**: `src/App/JobQueue.jsx`

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
            <span class="progress-text">{completed}/{total}</span>
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
    <button onClick="cleanupFailed">Cleanup Failed Jobs</button>
    <button onClick="cleanupAll">Cleanup All Jobs</button>
  </div>

  <!-- Auto-refresh toggle -->
  <div class="auto-refresh-section">
    <label>
      <input type="checkbox" checked />
      Auto-refresh every 5 seconds
    </label>
  </div>
</div>
```

**Key Features**:
- **Job Units**: Batch operations (import, thumbnail generation, etc.)
- **Individual Jobs**: Per-file job status and error tracking
- **Progress Tracking**: Real-time progress bars and completion counts
- **Error Handling**: Retry and delete failed jobs
- **Cleanup**: Bulk cleanup of completed/failed jobs
- **Auto-refresh**: Automatic status updates every 5 seconds
