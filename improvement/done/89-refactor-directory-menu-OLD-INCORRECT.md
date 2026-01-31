# Improvement #88: Refactor DirectoryMenu.jsx - Extract Menu Components

## Current Status
- File: `src/App/PhotosList/DirectoryMenu.jsx`
- Lines: **966 lines**
- Complexity: High - managing directory tree, context menus, operations

## Problem
DirectoryMenu.jsx is close to the 1000 line limit and handles:
- Directory tree rendering (recursive)
- Context menu (right-click actions)
- Directory operations (create, delete, rename, move)
- File operations (copy, move, delete)
- Drag and drop functionality
- Directory state management (expanded/collapsed)
- Selection state
- Path navigation

## Goal
Extract menu components and utilities to improve modularity and reduce file size.

## Implementation Plan

### Step 1: Create `DirectoryMenu/DirectoryTree.jsx`
Extract tree rendering component (~200 lines):
- Recursive directory tree structure
- Expand/collapse functionality
- Directory selection
- Visual tree indicators (├─ └─)
- Nesting/indentation logic

Props:
```javascript
{
    directories,
    selectedPath,
    expandedDirs,
    onSelect,
    onExpand,
    onCollapse,
    onContextMenu,
    level
}
```

### Step 2: Create `DirectoryMenu/DirectoryContextMenu.jsx`
Extract context menu component (~200 lines):
- Right-click menu rendering
- Menu items:
  - New folder
  - Rename
  - Delete
  - Copy path
  - Move to...
  - Properties
- Menu positioning
- Keyboard shortcuts display

Props:
```javascript
{
    visible,
    position,
    targetPath,
    onNewFolder,
    onRename,
    onDelete,
    onCopy,
    onMove,
    onClose
}
```

### Step 3: Create `DirectoryMenu/DirectoryOperations.jsx`
Extract operation dialogs/modals (~200 lines):
- New folder dialog
- Rename dialog
- Delete confirmation
- Move/copy dialog
- Properties dialog
- Progress indicators
- Error handling UI

Props:
```javascript
{
    operation, // 'new' | 'rename' | 'delete' | 'move' | 'copy'
    targetPath,
    onConfirm,
    onCancel,
    isProcessing
}
```

### Step 4: Create `DirectoryMenu/useDragAndDrop.js`
Extract drag and drop hook (~150 lines):
- Drag start handler
- Drag over handler
- Drop handler
- Drop zone highlighting
- Drag preview
- Validation (can drop here?)

Return:
```javascript
{
    draggedItem,
    dropTarget,
    isDragging,
    canDrop,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop
}
```

### Step 5: Create `DirectoryMenu/useDirectoryOperations.js`
Extract directory operation hooks (~200 lines):
- `createDirectory(path, name)` - Create new folder
- `renameDirectory(oldPath, newPath)` - Rename
- `deleteDirectory(path)` - Delete folder
- `moveDirectory(sourcePath, destPath)` - Move folder
- `copyFiles(files, destPath)` - Copy files
- `moveFiles(files, destPath)` - Move files

Return:
```javascript
{
    createDirectory,
    renameDirectory,
    deleteDirectory,
    moveDirectory,
    copyFiles,
    moveFiles,
    isProcessing,
    error
}
```

### Step 6: Update DirectoryMenu.jsx (main component)
Keep only (~200-300 lines):
- Main component structure
- State management
- Component composition
- Integration with PhotosList
- Props handling

Use extracted components:
```javascript
import DirectoryTree from './DirectoryMenu/DirectoryTree.jsx';
import DirectoryContextMenu from './DirectoryMenu/DirectoryContextMenu.jsx';
import DirectoryOperations from './DirectoryMenu/DirectoryOperations.jsx';
import { useDragAndDrop } from './DirectoryMenu/useDragAndDrop.js';
import { useDirectoryOperations } from './DirectoryMenu/useDirectoryOperations.js';
```

## Expected Results
- DirectoryMenu.jsx reduced from 966 lines to ~200-300 lines
- Reusable tree component
- Better separation of concerns
- Easier to test individual features
- Improved maintainability

## File Structure
```
src/App/PhotosList/
  DirectoryMenu.jsx                      # Main component (200-300 lines)
  DirectoryMenu/
    DirectoryTree.jsx                    # Tree rendering (200 lines)
    DirectoryContextMenu.jsx             # Context menu (200 lines)
    DirectoryOperations.jsx              # Operation dialogs (200 lines)
    useDragAndDrop.js                    # Drag and drop hook (150 lines)
    useDirectoryOperations.js            # Operations hook (200 lines)
```

## Testing
- Test tree rendering:
  - Nested directories
  - Expand/collapse
  - Selection
  - Large directory trees
- Test context menu:
  - All menu items
  - Keyboard shortcuts
  - Menu positioning
- Test operations:
  - Create folder
  - Rename folder
  - Delete folder (with confirmation)
  - Move folder
  - Copy files
  - Move files
- Test drag and drop:
  - Drag files to folder
  - Drag folder to folder
  - Invalid drop targets
  - Drop feedback
- Test error cases:
  - Permission denied
  - Folder already exists
  - Invalid paths

## Related Files
- `src/App/PhotosList/DirectoryMenu.jsx` (will be refactored)
- `src/App/PhotosList.jsx` (parent component)
- Backend Tauri commands for directory operations

## Notes
- Consider adding keyboard navigation (arrow keys)
- May want to add directory icons/badges
- Consider adding directory size display
- May want to add favorites/bookmarks
- Consider adding recent directories
