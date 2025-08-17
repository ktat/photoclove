/**
 * Example showing how PhotosList would be simplified with DDD approach
 */
import { PhotoCollection } from '../domain/PhotoCollection.js';
import { SinglePhotoDisplay } from '../domain/SinglePhotoDisplay.js';
import { PhotoService } from '../services/PhotoService.js';

// Before: Complex PhotosList component with many props and mode checks
function PhotosListBefore(props) {
    const {
        // 20+ props for different modes
        viewMode, currentAlbumId, isTrashMode, isSearchMode, recentPhotosMode,
        showPhotoDisplay, currentPhotoPath, albumPhotos, trashPhotos, searchResults,
        // ... many more props
    } = props;

    // Complex mode checking logic scattered throughout
    const isAlbumMode = viewMode === 'album' && currentAlbumId;
    const displayKey = recentPhotosMode ? "recent" : 
                      (isSearchMode ? "search_results" : 
                      (isAlbumMode ? `album_${currentAlbumId}` : 
                      (isTrashMode ? "trash" : currentDate)));

    // Mode-specific rendering logic
    if (showPhotoDisplay[displayKey] && currentPhotoPath) {
        return (
            <SinglePhotoMode
                // Many props passed down
                currentPhotoPath={currentPhotoPath}
                isAlbumMode={isAlbumMode}
                isTrashMode={isTrashMode}
                // ... many more props
            />
        );
    }

    return (
        <PhotoListMode
            // Many props passed down
            photos={isAlbumMode ? albumPhotos : (isTrashMode ? trashPhotos : photos)}
            viewMode={viewMode}
            // ... many more props
        />
    );
}

// After: Clean PhotosList component with DDD approach
function PhotosListAfter({ photoCollection, singlePhotoDisplay, config }) {
    if (singlePhotoDisplay) {
        return <SinglePhotoMode display={singlePhotoDisplay} config={config} />;
    }

    return <PhotoListMode collection={photoCollection} config={config} />;
}

// Usage example in parent component
function ExampleUsage() {
    const [photoCollection, setPhotoCollection] = useState(null);
    const [singlePhotoDisplay, setSinglePhotoDisplay] = useState(null);
    
    // Load album photos
    const loadAlbumPhotos = async (albumId, albumName) => {
        const photoService = new PhotoService(config);
        const backendData = await invoke("get_album_photos", { albumId });
        const photos = photoService.transformAlbumData(JSON.parse(backendData), albumId);
        
        const collection = PhotoCollection.createAlbumCollection(photos, albumId, albumName);
        setPhotoCollection(collection);
        setSinglePhotoDisplay(null);
    };

    // Load trash photos
    const loadTrashPhotos = async () => {
        const photoService = new PhotoService(config);
        const backendData = await invoke("get_trash_photos");
        const photos = photoService.transformBackendData(JSON.parse(backendData), true);
        
        const collection = PhotoCollection.createTrashCollection(photos);
        setPhotoCollection(collection);
        setSinglePhotoDisplay(null);
    };

    // Display single photo
    const displayPhoto = (photoIndex) => {
        if (photoCollection) {
            const display = SinglePhotoDisplay.fromCollection(photoCollection, photoIndex);
            setSinglePhotoDisplay(display);
        }
    };

    // Navigate in single photo mode
    const navigatePhoto = (direction) => {
        if (singlePhotoDisplay) {
            const newDisplay = direction === 'next' 
                ? singlePhotoDisplay.next() 
                : singlePhotoDisplay.previous();
            setSinglePhotoDisplay(newDisplay);
        }
    };

    return (
        <div>
            {/* Navigation tabs - dynamically generated from collection */}
            {photoCollection && (
                <TabBar tabs={photoCollection.getAvailableTabs()} />
            )}

            {/* Keyboard shortcuts help - mode-specific */}
            {(photoCollection || singlePhotoDisplay) && (
                <KeyboardHelp 
                    shortcuts={
                        singlePhotoDisplay 
                            ? singlePhotoDisplay.getKeyboardShortcuts()
                            : photoCollection.getKeyboardShortcuts()
                    } 
                />
            )}

            {/* Dropdown menu - mode-specific items */}
            {photoCollection && (
                <DropdownMenu items={photoCollection.getDropdownItems()} />
            )}

            {/* Main photo display */}
            <PhotosListAfter 
                photoCollection={photoCollection}
                singlePhotoDisplay={singlePhotoDisplay}
                config={config}
            />

            {/* Tutorial - mode-specific steps */}
            {photoCollection && (
                <Tutorial steps={photoCollection.getTutorialSteps()} />
            )}
        </div>
    );
}

// Benefits of this approach:
// 1. PhotosList props reduced from 20+ to 3
// 2. Mode-specific logic encapsulated in domain objects
// 3. Keyboard shortcuts, tabs, dropdowns automatically match mode
// 4. Easy to add new modes without changing PhotosList
// 5. Better testability - can test domain objects independently
// 6. Clear separation of concerns

export { ExampleUsage };