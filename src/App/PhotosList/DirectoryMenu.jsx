import React, { useState, useEffect, useRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { message, confirm } from "@tauri-apps/plugin-dialog";
import { emit } from "@tauri-apps/api/event";
import { localForage } from "../../storage/forage";
import { logger } from "../../services/LoggerService.js";
import { useUI } from "../../context/UIContext.jsx";
import { useError } from "../../context/ErrorContext.jsx";
import { useTutorial } from "../../hooks/useTutorial.js";
import AlbumCreationModal from "../../components/AlbumCreationModal.jsx";
import AlbumSelectorModal from "../../components/AlbumSelectorModal.jsx";
import TutorialTooltip from "../../components/TutorialTooltip.jsx";

function DirectoryMenu(props) {
    const { viewMode, currentAlbumId } = useUI();
    const { handleTauriError } = useError();

    const [photoIndex, setPhotoIndex] = useState(-1);
    const [showBigPhoto, setShowBigPhoto] = useState(false);
    const [showAlbumCreationModal, setShowAlbumCreationModal] = useState(false);
    const [showAlbumSelectorModal, setShowAlbumSelectorModal] = useState(false);
    
    // Tutorial state
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialContent, setTutorialContent] = useState('');
    const dropdownRef = useRef(null);
    
    // Check if we're in album mode
    const isAlbumMode = viewMode === 'album' && currentAlbumId;
    
    // Tutorial hooks
    const {
        shouldShowTutorial,
        markTutorialShown,
        dismissTutorial,
        disableTutorial
    } = useTutorial();
    

    useEffect(() => {
        let l = props.photoSelection.length;
        setPhotoIndex(l - 1)
    }, [props.photoSelection])

    // Tutorial trigger effect
    useEffect(() => {
        if (props.photoSelection.length > 0) {
            const context = isAlbumMode ? 'albumMode' : 'dateMode';
            
            if (shouldShowTutorial('selectionTutorial', context)) {
                setTutorialContent(getTutorialContent(context, props.photoSelection.length));
                setShowTutorial(true);
                markTutorialShown('selectionTutorial', context);
                
                logger.info('DirectoryMenu', 'tutorial_triggered', 'Selection tutorial shown', {
                    context,
                    photoCount: props.photoSelection.length
                });
            }
        } else {
            setShowTutorial(false);
        }
    }, [props.photoSelection.length, isAlbumMode, shouldShowTutorial, markTutorialShown]);

    // Generate tutorial content based on context
    const getTutorialContent = (context, photoCount) => {
        const photoText = `${photoCount} photo${photoCount !== 1 ? 's' : ''}`;
        
        if (context === 'albumMode') {
            return (
                <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        💡 Selected {photoText} from this album
                    </div>
                    <div>You can now:</div>
                    <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
                        <li>📚 Create Album - Make a new album</li>
                        <li>📚 Add to Album - Add to a different album</li>
                        <li>❌ Remove from Album - Remove from current album</li>
                        <li>⬆️ Upload to Google Photos - Sync with Google</li>
                        <li>🗑️ Delete Files - Permanently remove files</li>
                    </ul>
                </div>
            );
        } else {
            return (
                <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        💡 Selected {photoText}
                    </div>
                    <div>You can now:</div>
                    <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
                        <li>📚 Create Album - Make a new album</li>
                        <li>📚 Add to Album - Add to existing album</li>
                        <li>⬆️ Upload to Google Photos - Sync with Google</li>
                        <li>🗑️ Delete Files - Permanently remove files</li>
                    </ul>
                </div>
            );
        }
    };

    // Tutorial event handlers
    const handleTutorialDismiss = () => {
        setShowTutorial(false);
        const context = isAlbumMode ? 'albumMode' : 'dateMode';
        dismissTutorial('selectionTutorial', context);
        
        logger.info('DirectoryMenu', 'tutorial_dismissed', 'User dismissed selection tutorial', { context });
    };

    const handleTutorialDisable = () => {
        setShowTutorial(false);
        const context = isAlbumMode ? 'albumMode' : 'dateMode';
        disableTutorial('selectionTutorial', context);
        
        logger.info('DirectoryMenu', 'tutorial_disabled', 'User disabled selection tutorial', { context });
    };

    let lock = false;
    let lockThumbnail = false;
    let lockUpload = false;
    let lockDelete = false;
    

    function doOperation(e) {
        const selected = e.target.value;
        if (selected == "uploadToGooglePhotos") {
            uploadToGooglePhotos()
        } else if (selected == "deleteFiles") {
            deleteFiles();
        } else if (selected == "removeFromAlbum") {
            removeFromCurrentAlbum();
        } else if (selected == "createAlbum") {
            showCreateAlbumModal();
        } else if (selected == "addToAlbum") {
            showAddToAlbumModal();
        }
        e.target.value = "";
    }

    async function createDbInDate() {
        if (lock) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lock = true;
                    invoke("create_db_in_date", { dateStr: props.currentDate }).then((r) => {
                        lock = false;
                        let data = JSON.parse(r);
                        props.setCurrentDateNum(data[props.currentDate.replace(/\//g, "-")]);
                    })
                }
            });
        }
    }

    async function movePhotosToExifDate() {
        if (lock) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lock = true;
                    invoke("move_photos_to_exif_date", { dateStr: props.currentDate }).then(() => {
                        lock = false;
                    })
                }
            });
        }
    }

    async function createThumbnails() {
        if (lockThumbnail) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lockThumbnail = true;
                    invoke("create_thumbnails_in_date", { dateStr: props.currentDate }).then((r) => {
                        lockThumbnail = false;
                        // console.log(r);
                    })
                }
            });
        }
    }


    async function uploadToGooglePhotos() {
        if (lockUpload) {
            message("Currently uploading. Please wait for the current upload to complete.", "Upload in Progress");
            return;
        }
        
        const files = props.photoSelection;
        const BATCH_SIZE = 50;
        const numBatches = Math.ceil(files.length / BATCH_SIZE);
        
        let answer = true;
        if (files.length > BATCH_SIZE) {
            answer = await confirm(
                `Upload ${files.length} photos to Google Photos?\n` +
                `This will create ${numBatches} upload jobs (max ${BATCH_SIZE} photos per job).`, 
                "Confirm Upload"
            );
        } else {
            answer = await confirm(
                `Upload ${files.length} photos to Google Photos?`, 
                "Confirm Upload"
            );
        }
        
        if (answer) {
            try {
                const tokens = await localForage.getItem("GoogleOAuthTokens");
                if (!tokens) {
                    message("Please sign in to Google Photos first", "Authentication Required");
                    return;
                }
                
                lockUpload = true;
                
                logger.info('DirectoryMenu', 'google_photos_upload_start', 'User initiated Google Photos upload', {
                    filesCount: files.length,
                    batchesExpected: numBatches
                });
                
                const jobUnitIds = await invoke("upload_to_google_photos", {
                    selectedFiles: files,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken
                });
                
                props.clearPhotoSelection();
                lockUpload = false;
                
                message(
                    `Created ${jobUnitIds.length} upload job${jobUnitIds.length > 1 ? 's' : ''}. ` +
                    `Check Job Queue for progress.`,
                    "Upload Started"
                );
                
                logger.info('DirectoryMenu', 'google_photos_jobs_created', 'Google Photos upload jobs created', {
                    jobUnitsCreated: jobUnitIds.length,
                    jobUnitIds: jobUnitIds
                });
                
                // Show job queue to display progress
                props.setShowJobQueue(true);
                
            } catch (e) {
                lockUpload = false;
                logger.error('DirectoryMenu', 'google_photos_upload_error', 'Failed to start Google Photos upload', {
                    error: e.toString(),
                    filesCount: files.length
                });
                message("Failed to start upload: " + e.toString(), "Upload Error");
            }
        }
    }

    async function deleteFiles() {
        if (!lockDelete) {
            props.photoSelection.map((v, i) => {
                props.moveToTrashCan(v);
            });
            lockDelete = false;
            props.clearPhotoSelection()
        }
    }

    // Album operation functions
    async function removeFromCurrentAlbum() {
        if (!currentAlbumId || props.photoSelection.length === 0) return;
        
        const count = props.photoSelection.length;
        const confirmed = await confirm(
            `Remove ${count} photo${count > 1 ? 's' : ''} from this album?\n\nPhotos will remain in your library.`,
            "Remove from Album"
        );
        
        if (confirmed) {
            try {
                logger.info('DirectoryMenu', 'remove_from_album_start', 'Removing photos from album', {
                    albumId: currentAlbumId,
                    photoCount: count
                });
                
                for (const photoPath of props.photoSelection) {
                    await invoke("remove_photo_from_album", {
                        albumId: currentAlbumId,
                        photoPath: photoPath
                    });
                }
                
                props.clearPhotoSelection();
                props.addFooterMessage(`${count} photo${count > 1 ? 's' : ''} removed from album`);
                props.onPhotosRefresh?.(); // Refresh the album view
                
                logger.info('DirectoryMenu', 'photos_removed_from_album', 'Photos removed from album successfully', {
                    albumId: currentAlbumId,
                    photoCount: count
                });
            } catch (error) {
                logger.error('DirectoryMenu', 'remove_from_album_failed', 'Failed to remove photos from album', {
                    albumId: currentAlbumId,
                    photoCount: count,
                    error: error.message
                });
                handleTauriError(error, 'Remove from album');
            }
        }
    }

    function showCreateAlbumModal() {
        if (props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return;
        }
        
        logger.debug('DirectoryMenu', 'show_create_album_modal', 'Opening album creation modal', {
            selectedPhotosCount: props.photoSelection.length
        });
        setShowAlbumCreationModal(true);
    }

    function showAddToAlbumModal() {
        if (props.photoSelection.length === 0) {
            props.addFooterMessage('Please select photos first');
            return;
        }
        
        logger.debug('DirectoryMenu', 'show_add_to_album_modal', 'Opening album selector modal', {
            selectedPhotosCount: props.photoSelection.length
        });
        setShowAlbumSelectorModal(true);
    }

    async function createAlbumFromSelection(albumData) {
        try {
            logger.info('DirectoryMenu', 'create_album_start', 'Creating album from selection', {
                albumName: albumData.name,
                photoCount: props.photoSelection.length
            });
            
            const albumId = await invoke("create_album", {
                name: albumData.name,
                description: albumData.description
            });
            
            // Add all selected photos to the new album
            for (const photoPath of props.photoSelection) {
                await invoke("add_photo_to_album", {
                    albumId: albumId,
                    photoPath: photoPath
                });
            }
            
            // Automatically set the first selected photo as the cover photo
            if (props.photoSelection.length > 0) {
                const firstPhotoPath = props.photoSelection[0];
                logger.info('DirectoryMenu', 'set_cover_photo', 'Setting first photo as album cover', {
                    albumId,
                    coverPhotoPath: firstPhotoPath
                });
                
                await invoke("update_album", {
                    id: albumId,
                    name: albumData.name,
                    description: albumData.description,
                    coverPhotoPath: firstPhotoPath
                });
            }
            
            const photoCount = props.photoSelection.length;
            props.clearPhotoSelection();
            props.addFooterMessage(`Album "${albumData.name}" created with ${photoCount} photos`);
            
            logger.info('DirectoryMenu', 'album_created_from_selection', 'Album created from selected photos', {
                albumName: albumData.name,
                albumId,
                photoCount,
                coverPhotoSet: props.photoSelection.length > 0
            });
            
            setShowAlbumCreationModal(false);
        } catch (error) {
            logger.error('DirectoryMenu', 'create_album_failed', 'Failed to create album from selection', {
                albumName: albumData.name,
                photoCount: props.photoSelection.length,
                error: error.message
            });
            handleTauriError(error, 'Create album');
        }
    }

    async function addPhotosToAlbum(albumId) {
        try {
            logger.info('DirectoryMenu', 'add_to_album_start', 'Adding photos to existing album', {
                albumId,
                photoCount: props.photoSelection.length
            });
            
            for (const photoPath of props.photoSelection) {
                await invoke("add_photo_to_album", {
                    albumId: albumId,
                    photoPath: photoPath
                });
            }
            
            const photoCount = props.photoSelection.length;
            props.clearPhotoSelection();
            props.addFooterMessage(`${photoCount} photo${photoCount > 1 ? 's' : ''} added to album`);
            
            logger.info('DirectoryMenu', 'photos_added_to_album', 'Photos added to album successfully', {
                albumId,
                photoCount
            });
            
            setShowAlbumSelectorModal(false);
        } catch (error) {
            logger.error('DirectoryMenu', 'add_to_album_failed', 'Failed to add photos to album', {
                albumId,
                photoCount: props.photoSelection.length,
                error: error.message
            });
            handleTauriError(error, 'Add to album');
        }
    }



    return (
        <div id="directory-maintenance">
            {props.searchMode && (
                <div id="tab-search" className={props.tabClass['search'] ? "tab-active" : "tab"}>
                    <div className="search-tools-container">
                        {props.searchTools}
                    </div>
                </div>
            )}
            <div id="tab-maintenance" className={props.tabClass['maintenance'] ? "tab-active" : "tab"}>
                <ul>
                    <li><a href="#" onClick={() => { createDbInDate() }}>(re)Create database of the date</a></li>
                    <li><a href="#" onClick={() => { movePhotosToExifDate() }}>Move files according to Exif date</a></li>
                    <li><a href="#" onClick={() => { createThumbnails() }}>Make thumbnails</a></li>
                </ul>
            </div>
            <div id="tab-filter" className={props.tabClass['filter'] ? "tab-active" : "tab"}>
                <ul>
                    <li>
                        Stars:
                        {[0, 1, 2, 3, 4, 5].map((v, i) => {
                            return <span key={i} onClick={() => {
                                logger.debug('DirectoryMenu', 'filter_changed', 'User changed star filter', {
                                    filterType: 'starFilter',
                                    newValue: v,
                                    previousValue: props.starFilter
                                });
                                props.setStarFilter(v);
                            }}>{props.starFilter >= v ? " ★" + i : " ☆" + i}</span>
                        })}
                    </li>
                    <li>
                        <input type="checkbox" value="1" id="filter-has-comment-check"
                            onChange={(e) => { 
                                logger.debug('DirectoryMenu', 'filter_changed', 'User changed comment filter', {
                                    filterType: 'hasCommentFilter',
                                    newValue: e.target.checked,
                                    previousValue: props.hasCommentFilter
                                });
                                props.setHasCommentFilter(e.target.checked); 
                            }}
                        />
                        <label className="checkbox checkbox-normal" htmlFor="filter-has-comment-check">Has comment</label>
                    </li>
                    <li>
                        Extensions:
                        <div style={{ marginTop: '5px' }}>
                            {/* Image Extensions Group */}
                            <div style={{ marginBottom: '10px' }}>
                                <div>
                                    <input 
                                        type="checkbox" 
                                        id="filter-extension-image-group-check"
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
                                            
                                            let newFilters;
                                            if (checked) {
                                                // Add all image extensions
                                                newFilters = [...currentFilters.filter(f => !imageExtensions.includes(f)), ...imageExtensions];
                                            } else {
                                                // Remove all image extensions
                                                newFilters = currentFilters.filter(f => !imageExtensions.includes(f));
                                            }
                                            
                                            const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                            props.setExtensionFilter(filterString);
                                        }}
                                        checked={props.extensionFilter !== "all" && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].some(ext => props.extensionFilter.split(',').includes(ext))}
                                    />
                                    <label className="checkbox checkbox-normal" htmlFor="filter-extension-image-group-check"><strong>Image</strong></label>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', marginLeft: '20px' }}>
                                    {[
                                        { value: 'jpeg', label: 'jpeg(jpg)', extensions: ['jpg', 'jpeg'] },
                                        { value: 'png', label: 'png', extensions: ['png'] },
                                        { value: 'gif', label: 'gif', extensions: ['gif'] },
                                        { value: 'bmp', label: 'bmp', extensions: ['bmp'] },
                                        { value: 'tiff', label: 'tiff', extensions: ['tiff'] }
                                    ].map(item => (
                                        <div key={item.value}>
                                            <input 
                                                type="checkbox" 
                                                value={item.value}
                                                id={`filter-extension-${item.value}-check`}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                                    
                                                    let newFilters;
                                                    if (checked) {
                                                        // Add all extensions for this item
                                                        newFilters = [...currentFilters, ...item.extensions];
                                                    } else {
                                                        // Remove all extensions for this item
                                                        newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                                    }
                                                    
                                                    const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                                    props.setExtensionFilter(filterString);
                                                }}
                                                checked={props.extensionFilter !== "all" && item.extensions.some(ext => props.extensionFilter.split(',').includes(ext))}
                                            />
                                            <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${item.value}-check`}>{item.label}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Movie Extensions Group */}
                            <div>
                                <div>
                                    <input 
                                        type="checkbox" 
                                        id="filter-extension-movie-group-check"
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                            const movieExtensions = ['mp4', 'webm'];
                                            
                                            let newFilters;
                                            if (checked) {
                                                // Add all movie extensions
                                                newFilters = [...currentFilters.filter(f => !movieExtensions.includes(f)), ...movieExtensions];
                                            } else {
                                                // Remove all movie extensions
                                                newFilters = currentFilters.filter(f => !movieExtensions.includes(f));
                                            }
                                            
                                            const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                            props.setExtensionFilter(filterString);
                                        }}
                                        checked={props.extensionFilter !== "all" && ['mp4', 'webm'].some(ext => props.extensionFilter.split(',').includes(ext))}
                                    />
                                    <label className="checkbox checkbox-normal" htmlFor="filter-extension-movie-group-check"><strong>Movie</strong></label>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', marginLeft: '20px' }}>
                                    {[
                                        { value: 'mp4', label: 'mp4', extensions: ['mp4'] },
                                        { value: 'webm', label: 'webm', extensions: ['webm'] }
                                    ].map(item => (
                                        <div key={item.value}>
                                            <input 
                                                type="checkbox" 
                                                value={item.value}
                                                id={`filter-extension-${item.value}-check`}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                                    
                                                    let newFilters;
                                                    if (checked) {
                                                        // Add all extensions for this item
                                                        newFilters = [...currentFilters, ...item.extensions];
                                                    } else {
                                                        // Remove all extensions for this item
                                                        newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                                    }
                                                    
                                                    const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                                    props.setExtensionFilter(filterString);
                                                }}
                                                checked={props.extensionFilter !== "all" && item.extensions.some(ext => props.extensionFilter.split(',').includes(ext))}
                                            />
                                            <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${item.value}-check`}>{item.label}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>
            <div id="tab-selection" className={props.tabClass['selection'] ? "tab-active" : "tab"}>
                <div>
                    <button onClick={() => props.selectAllPhotoToSelection()}>Select all photos in page</button>
                </div>
                {props.photoSelection.length == 0
                    ?
                    <div><br />Photos are not selected.</div>
                    :
                    <div>
                        <div className="operation">
                            <select ref={dropdownRef} onChange={(e) => doOperation(e)}>
                                <option value="select">Select an Operation</option>
                                
                                {/* Album-specific operations (only in album mode) */}
                                {isAlbumMode && (
                                    <option value="removeFromAlbum">Remove from Album</option>
                                )}
                                
                                {/* Standard operations (all modes) */}
                                <option value="uploadToGooglePhotos">Upload to Google Photos</option>
                                <option value="deleteFiles">Delete files</option>
                                
                                {/* Album operations (all modes) */}
                                <option value="createAlbum">Create Album</option>
                                <option value="addToAlbum">Add to Existing Album</option>
                            </select>
                        </div>
                        <ul className="list-of-selected">
                            {props.photoSelection.map((v, i) => {
                                return <li key={v}><a href="#" onClick={() => setPhotoIndex(i)}>{v.replace(/^.+\//, "")}</a></li>
                            })}
                        </ul>
                        <button onClick={() => props.clearPhotoSelection()}>Clear Selection</button>
                    </div>
                }
                {photoIndex >= 0 &&
                    <img
                        onMouseOver={() => setShowBigPhoto(true)}
                        src={convertFileSrc(props.photoSelection[photoIndex])}
                    />}
            </div>
            <div className="big-photo-in-selection" style={{ display: showBigPhoto ? "block" : "none" }}
                onMouseLeave={() => setShowBigPhoto(false)}
                onClick={() => setShowBigPhoto(false)}
            >
                <img src={convertFileSrc(props.photoSelection[photoIndex])} />
            </div>
            
            {/* Album Creation Modal */}
            <AlbumCreationModal
                isOpen={showAlbumCreationModal}
                onClose={() => setShowAlbumCreationModal(false)}
                onConfirm={createAlbumFromSelection}
                selectedPhotosCount={props.photoSelection.length}
            />
            
            {/* Album Selector Modal */}
            <AlbumSelectorModal
                isOpen={showAlbumSelectorModal}
                onClose={() => setShowAlbumSelectorModal(false)}
                onConfirm={addPhotosToAlbum}
                selectedPhotosCount={props.photoSelection.length}
            />
            
            {/* Tutorial Tooltip */}
            <TutorialTooltip
                isVisible={showTutorial}
                content={tutorialContent}
                targetElement={dropdownRef.current}
                onDismiss={handleTutorialDismiss}
                onDontShowAgain={handleTutorialDisable}
                tutorialId={`selection_${isAlbumMode ? 'album' : 'date'}`}
            />
        </div >
    )
}

export default DirectoryMenu;
