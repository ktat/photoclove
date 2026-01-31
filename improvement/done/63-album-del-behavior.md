# Album DEL Key Behavior

## Overview
Implement context-aware DEL key behavior in PhotosListMini (full-screen photo viewer) to provide safe and intuitive photo removal based on current viewing context. Add modal confirmations with clear context-specific messaging.

## Problem
When viewing photos in album mode, the DEL key should behave differently than in date/search mode:
- **Album mode**: DEL should remove from album (safer), Ctrl+DEL should delete file
- **Date mode**: DEL should delete file (current behavior)
- Users need clear confirmation dialogs that explain what will happen

## Implementation Plan

### 1. Context Detection in PhotosListMini
Detect current viewing context and show appropriate visual indicators:
```javascript
// In PhotosListMini.jsx
const isAlbumMode = props.albumId !== undefined;
const isSearchMode = props.searchMode === true;
const isDateMode = !isAlbumMode && !isSearchMode;
```

### 2. Context-Aware Keyboard Handling
Implement different DEL key behaviors based on context:

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Delete') {
      e.preventDefault(); // Prevent default behavior
      
      if (isAlbumMode) {
        if (e.ctrlKey) {
          // Ctrl+DEL: Delete file AND remove from album
          showDeleteFileModal();
        } else {
          // DEL only: Remove from album (safer default)
          showRemoveFromAlbumModal();
        }
      } else {
        // Date/Search mode: DEL deletes file (current behavior)
        showDeleteFileModal();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isAlbumMode, currentPhoto]);
```

### 3. Context-Specific Modal Confirmations
Create different confirmation modals based on operation and context:

**Remove from Album Modal:**
```
"Remove from Album"
"Remove '[filename]' from album '[Album Name]'?"
"The photo will remain in your library and other albums."
[Cancel] [Remove from Album]
```

**Delete File Modal (Album Mode):**
```
"Delete Photo File"
"Permanently delete '[filename]'?"
"This will delete the file from your computer AND remove it from album '[Album Name]'."
[Cancel] [Delete Permanently]
```

**Delete File Modal (Date Mode):**
```
"Delete Photo"
"Move '[filename]' to trash?"
"This will permanently remove the photo from your library."
[Cancel] [Delete]
```

### 4. Visual Mode Indicators
Show clear visual indicators of current mode and available keyboard shortcuts:

```jsx
// Mode indicator in PhotosListMini
<div className="mode-indicator">
  {isAlbumMode ? (
    <div className="album-mode-indicator">
      📚 Album Mode
      <div className="keyboard-hints">
        <span>DEL: Remove from album</span>
        <span>Ctrl+DEL: Delete file</span>
      </div>
    </div>
  ) : (
    <div className="date-mode-indicator">
      📅 Library Mode
      <div className="keyboard-hints">
        <span>DEL: Delete file</span>
      </div>
    </div>
  )}
</div>
```

### 5. Modal Component Implementation
Create reusable confirmation modal with context-aware content:

```jsx
const ContextualDeleteModal = ({ 
  isOpen, 
  operation, // 'removeFromAlbum' | 'deleteFile'
  photoPath,
  albumName,
  onConfirm,
  onCancel 
}) => {
  if (!isOpen) return null;

  const getModalContent = () => {
    const filename = photoPath?.split('/').pop() || 'photo';
    
    if (operation === 'removeFromAlbum') {
      return {
        title: 'Remove from Album',
        message: `Remove '${filename}' from album '${albumName}'?`,
        description: 'The photo will remain in your library and other albums.',
        confirmText: 'Remove from Album',
        confirmStyle: { backgroundColor: '#F59E0B' } // Orange
      };
    } else {
      return {
        title: 'Delete Photo File',
        message: `Permanently delete '${filename}'?`,
        description: albumName 
          ? `This will delete the file from your computer AND remove it from album '${albumName}'.`
          : 'This will permanently remove the photo from your library.',
        confirmText: 'Delete Permanently',
        confirmStyle: { backgroundColor: '#DC2626' } // Red
      };
    }
  };

  const content = getModalContent();

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{content.title}</h2>
        <p className="modal-message">{content.message}</p>
        <p className="modal-description">{content.description}</p>
        
        <div className="modal-actions">
          <button onClick={onCancel} className="cancel-button">
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="confirm-button"
            style={content.confirmStyle}
          >
            {content.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
```

## Files to Create
- `src/components/ContextualDeleteModal.jsx` - Context-aware delete confirmation modal

## Files to Modify
- `src/App/PhotosList/PhotosListMini.jsx` - Add context-aware DEL key handling
- `src/App/PhotosList/PhotosListMini.css` - Add styles for mode indicators

## Implementation Details

### PhotosListMini.jsx Integration
```javascript
import ContextualDeleteModal from '../../components/ContextualDeleteModal.jsx';

function PhotosListMini(props) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteOperation, setDeleteOperation] = useState(null); // 'removeFromAlbum' | 'deleteFile'
  
  const isAlbumMode = props.albumId !== undefined;
  const currentPhoto = props.photos[props.currentIndex];

  // Modal handlers
  const showRemoveFromAlbumModal = () => {
    setDeleteOperation('removeFromAlbum');
    setShowDeleteModal(true);
  };

  const showDeleteFileModal = () => {
    setDeleteOperation('deleteFile');
    setShowDeleteModal(true);
  };

  const handleConfirmAction = async () => {
    try {
      if (deleteOperation === 'removeFromAlbum') {
        await invoke('remove_photo_from_album', {
          albumId: props.albumId,
          photoPath: currentPhoto.path
        });
        
        // Remove from current view and show next photo
        props.removePhotoFromList(props.currentIndex);
        props.addFooterMessage('Photo removed from album');
      } else {
        await props.moveToTrashCan(currentPhoto.path);
        
        // Remove from current view and show next photo
        props.removePhotoFromList(props.currentIndex);
        props.addFooterMessage('Photo deleted');
      }
    } catch (error) {
      props.handleTauriError(error, `${deleteOperation === 'removeFromAlbum' ? 'Remove from album' : 'Delete photo'}`);
    } finally {
      setShowDeleteModal(false);
      setDeleteOperation(null);
    }
  };

  return (
    <div className="photos-list-mini">
      {/* Mode indicator */}
      <div className="mode-indicator">
        {isAlbumMode ? (
          <div className="album-mode">
            📚 {props.albumName || 'Album'} 
            <span className="keyboard-hint">DEL: Remove | Ctrl+DEL: Delete</span>
          </div>
        ) : (
          <div className="library-mode">
            📅 Library
            <span className="keyboard-hint">DEL: Delete</span>
          </div>
        )}
      </div>

      {/* Existing PhotosListMini content */}

      {/* Context-aware delete modal */}
      <ContextualDeleteModal
        isOpen={showDeleteModal}
        operation={deleteOperation}
        photoPath={currentPhoto?.path}
        albumName={props.albumName}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeleteOperation(null);
        }}
      />
    </div>
  );
}
```

### CSS Styles for Mode Indicators
```css
/* PhotosListMini.css */
.mode-indicator {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  z-index: 1000;
}

.album-mode, .library-mode {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.keyboard-hint {
  font-size: 11px;
  opacity: 0.8;
  margin-top: 2px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 400px;
  text-align: center;
}

.modal-message {
  font-weight: bold;
  margin: 16px 0;
  font-size: 16px;
}

.modal-description {
  color: #666;
  margin-bottom: 20px;
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.cancel-button, .confirm-button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.cancel-button {
  background: #6B7280;
  color: white;
}

.confirm-button {
  color: white;
}
```

## User Experience Flow

### Album Mode - Remove from Album (DEL)
1. User viewing photo in album, presses DEL
2. Modal appears: "Remove '[filename]' from album '[Album Name]'?"
3. Clear explanation that photo stays in library
4. Orange "Remove from Album" button (less destructive)
5. Photo removed from album view, next photo shown

### Album Mode - Delete File (Ctrl+DEL)
1. User presses Ctrl+DEL in album mode
2. Modal appears: "Permanently delete '[filename]'?"
3. Warning that file will be deleted AND removed from album
4. Red "Delete Permanently" button (destructive action)
5. File deleted, next photo shown

### Date Mode - Delete File (DEL)
1. User in date/library mode presses DEL
2. Standard delete confirmation
3. File moved to trash
4. Next photo shown

## Safety Features
- **Default Safe Action**: In album mode, DEL removes from album (safer)
- **Destructive Action Requires Modifier**: Ctrl+DEL needed to delete file in album mode
- **Clear Visual Feedback**: Mode indicators show current context and shortcuts
- **Contextual Confirmations**: Different messages for different operations
- **Color-coded Actions**: Orange for remove, red for delete

## Success Criteria
- DEL key behavior changes appropriately based on context
- Visual mode indicators are clear and informative
- Confirmation modals provide clear context and consequences
- Keyboard shortcuts work reliably
- Users can distinguish between remove and delete operations
- No accidental file deletions when user intended to remove from album

## Testing Plan
1. Test DEL behavior in album mode vs date mode
2. Test Ctrl+DEL behavior in album mode
3. Test modal confirmations for all operations
4. Test mode indicator display in different contexts
5. Test keyboard shortcut reliability
6. Test error handling for failed operations

keep context