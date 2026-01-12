import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { openUrl } from '@tauri-apps/plugin-opener';
import { logger } from '../../../services/LoggerService.js';
import fileUrl from '../../../PathUtil.jsx';
import './PhotoEditor.css';

// Extracted utilities (improvement #88)
import {
    DEFAULT_EDITOR_VALUES,
    parseCssToEditorValues,
    generateCSSFromValues
} from './PhotoEditor/cssUtils.js';
import {
    CROP_PRESETS,
    calculateCropFromPreset,
    calculateCropPosition,
    calculateCropDrag
} from './PhotoEditor/cropUtils.js';
import {
    applyTempStyles,
    rotateValue,
    normalizeRotationValue
} from './PhotoEditor/styleUtils.js';
import {
    applyFiltersToCanvas,
    applyTransformsToCanvas
} from './PhotoEditor/imageProcessing.js';
import EditorControl from './EditorControl.jsx';
import CropTool from './CropTool.jsx';

function PhotoEditor(props) {
    const [originalStyles, setOriginalStyles] = useState(new Map());
    const [editorStyles, setEditorStyles] = useState({
        rotate: 0,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        scale: 100,
        crop: { x: 0, y: 0, width: 100, height: 100 }
    });
    const [cropMode, setCropMode] = useState(false);
    const [cropSelection, setCropSelection] = useState({ x: 0, y: 0, width: 100, height: 100 });
    const [cropOverlayBounds, setCropOverlayBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dragMode, setDragMode] = useState('create');

    // Load saved CSS styles when photo changes
    useEffect(() => {
        setOriginalStyles(new Map());
        
        if (props.currentPhotoPath) {
            // Load saved CSS style for this photo
            invoke("get_css_style", { photoPath: props.currentPhotoPath })
                .then((savedCssStyle) => {
                    
                    if (savedCssStyle && savedCssStyle.trim() !== '') {
                        // Parse the saved CSS and update editor values
                        const editorValues = parseCssToEditorValues(savedCssStyle);
                        setEditorStyles(editorValues);
                        
                        // Update UI elements with saved values
                        setTimeout(() => {
                            updateUIElementsWithValues(editorValues, savedCssStyle);
                            
                            // Note: Don't apply temp styles here - PhotoDisplay will apply saved CSS via props
                        }, 200);
                    } else {
                        // No saved CSS, use default values
                        setEditorStyles({ ...DEFAULT_EDITOR_VALUES });

                        setTimeout(() => {
                            updateUIElementsWithValues(DEFAULT_EDITOR_VALUES, '');
                        }, 100);
                    }
                })
                .catch((error) => {
                    logger.error('PhotoEditor', 'css_load_failed', 'Failed to load CSS style', { photoPath: props.currentPhotoPath, error: error.message });
                    // Fallback to reset editor styles
                    setEditorStyles({ ...DEFAULT_EDITOR_VALUES });

                    setTimeout(() => {
                        updateUIElementsWithValues(DEFAULT_EDITOR_VALUES, '');
                    }, 100);
                });
        }
    }, [props.currentPhotoPath])

    // Cleanup effect to reset crop mode when component unmounts
    useEffect(() => {
        return () => {
            setCropMode(false);
            setIsDragging(false);
        };
    }, [])

    // Update CSS preview when editor is opened
    useEffect(() => {
        if (props.currentPhotoPath) {
            // Ensure CSS preview is populated
            setTimeout(() => {
                
                const css = generateCSSFromValues(editorStyles);
                
                const previewTextarea = document.getElementById('css-preview-text');
                if (previewTextarea) {
                    previewTextarea.value = css;
                    logger.debug('PhotoEditor', 'css_preview_updated', 'CSS preview updated', { css });
                } else {
                    logger.warn('PhotoEditor', 'css_preview_missing', 'CSS preview textarea not found');
                }
                
                // Also ensure UI elements reflect current editorStyles
                updateUIElementsWithValues(editorStyles, css);
            }, 100);
        }
    }, [editorStyles])

    // Helper function to update CSS preview
    function updateUIElementsWithValues(editorValues, cssStyle) {
        logger.debug('PhotoEditor', 'update_css_preview', 'Updating CSS preview with values', { editorValues });

        // Update CSS preview with the actual saved CSS
        const previewTextarea = document.getElementById('css-preview-text');
        if (previewTextarea) {
            previewTextarea.value = cssStyle || '';
            logger.debug('PhotoEditor', 'css_preview_set', 'CSS preview textarea updated', { cssStyle });
        } else {
            logger.warn('PhotoEditor', 'css_preview_not_found', 'CSS preview textarea not found');
        }
    }

    // Editor functions
    function updateStyle(property, value) {
        // Handle rotation 360 = 0 case
        if (property === 'rotate' || property === 'hue') {
            value = normalizeRotationValue(value);
        }

        // Update state
        setEditorStyles(prev => {
            const newStyles = {
                ...prev,
                [property]: parseInt(value)
            };

            // Generate CSS with the new values immediately
            const css = generateCSSFromValues(newStyles);

            // Update CSS preview with the generated CSS
            const previewTextarea = document.getElementById('css-preview-text');
            if (previewTextarea) {
                previewTextarea.value = css;
                logger.debug('PhotoEditor', 'update_style_preview', 'CSS preview updated in updateStyle', { css });
            }

            // Apply to current image immediately with new values
            applyTempStyles(newStyles, originalStyles, setOriginalStyles, props.currentPhotoPath);

            return newStyles;
        });
    }

    function resetSingleControl(property) {
        updateStyle(property, DEFAULT_EDITOR_VALUES[property]);
    }

    function rotateBy(degrees) {
        const newRotation = rotateValue(editorStyles.rotate, degrees);
        updateStyle('rotate', newRotation);
    }

    function generateCSS() {
        return generateCSSFromValues(editorStyles);
    }

    function applyTempStyle(css) {
        applyTempStyles(editorStyles, originalStyles, setOriginalStyles, props.currentPhotoPath);
    }

    async function applyStyle() {
        if (!props.currentPhotoPath) {
            props.addFooterMessage('editor', 'Please select a photo first', false, 3000);
            return;
        }
        
        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('editor', 'No styles to apply', false, 3000);
            return;
        }
        
        try {
            await invoke('save_css_style', {
                photoPath: props.currentPhotoPath,
                cssStyle: css
            });
            
            props.addFooterMessage('editor', 'Style applied successfully', false, 3000);
        } catch (error) {
            logger.error('PhotoEditor', 'style_apply_failed', 'Failed to apply style', { error: error.message });
            props.addFooterMessage('editor', 'Failed to apply style', false, 3000);
        }
    }

    async function saveAsCopy() {
        if (!props.currentPhotoPath) {
            props.addFooterMessage('editor', 'Please select a photo first', false, 3000);
            return;
        }
        
        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('editor', 'No styles to save', false, 3000);
            return;
        }
        
        try {
            props.addFooterMessage('editor', 'Creating styled copy...', false, 2000);
            
            // Use the same canvas logic as downloadStyled() to create the image
            const mainImage = document.querySelector('#photoImgTag');
            if (!mainImage) {
                props.addFooterMessage('editor', 'Photo not found', false, 3000);
                return;
            }
            
            // Create a canvas to render the styled image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match image, but limit to reasonable size to prevent memory issues
            const maxSize = 4096; // Max 4K resolution
            let width = mainImage.naturalWidth || mainImage.width;
            let height = mainImage.naturalHeight || mainImage.height;
            
            if (width > maxSize || height > maxSize) {
                const scale = Math.min(maxSize / width, maxSize / height);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
                logger.info('PhotoEditor', 'resize_image', 'Resizing image', {
                    originalWidth: mainImage.naturalWidth,
                    originalHeight: mainImage.naturalHeight,
                    newWidth: width,
                    newHeight: height
                });
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Create a new image with applied styles
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            
            tempImg.onload = async function() {
                const { rotate, brightness, contrast, saturation, hue, scale } = editorStyles;

                // Create temporary canvas for filters
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = tempImg.width;
                tempCanvas.height = tempImg.height;

                // Draw the original image
                tempCtx.drawImage(tempImg, 0, 0);

                // Apply filters using extracted utility
                applyFiltersToCanvas(tempCtx, tempCanvas.width, tempCanvas.height,
                    { brightness, contrast, saturation, hue });

                // Apply transforms using extracted utility
                applyTransformsToCanvas(ctx, canvas.width, canvas.height, tempCanvas,
                    { rotate, scale });
                
                // Convert canvas to blob and send to backend
                canvas.toBlob(async function(blob) {
                    try {
                        // Use FileReader for more reliable base64 conversion
                        const reader = new FileReader();
                        reader.onload = async function(e) {
                            try {
                                const base64Data = e.target.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
                                
                                // Send to backend to save as copy
                                const newPhotoPath = await invoke('save_styled_copy_from_frontend', {
                                    originalPhotoPath: props.currentPhotoPath,
                                    cssStyle: css,
                                    imageData: base64Data
                                });
                                
                                // Extract filename from path for display
                                const newFilename = newPhotoPath.split('/').pop();
                                props.addFooterMessage('editor', `Styled copy created: ${newFilename}`, false, 5000);
                                
                                // Refresh photo list to show the new image
                                if (props.onPhotosRefresh) {
                                    props.onPhotosRefresh();
                                }
                                
                                // Since we don't have onDatesRefresh prop, trigger a manual reload
                                // by emitting an event that the main app can listen to
                                if (window.dispatchEvent) {
                                    window.dispatchEvent(new CustomEvent('refreshDates'));
                                }
                                
                            } catch (error) {
                                logger.error('PhotoEditor', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
                                props.addFooterMessage('editor', `Failed to create styled copy: ${error}`, false, 5000);
                            }
                        };
                        
                        reader.onerror = function() {
                            props.addFooterMessage('editor', 'Failed to process image data', false, 3000);
                        };
                        
                        // Convert blob to base64 using FileReader
                        reader.readAsDataURL(blob);
                        
                    } catch (error) {
                        logger.error('PhotoEditor', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
                        props.addFooterMessage('editor', `Failed to create styled copy: ${error}`, false, 5000);
                    }
                }, 'image/jpeg', 0.95);
            };
            
            tempImg.onerror = function() {
                props.addFooterMessage('editor', 'Failed to load image for processing', false, 3000);
            };
            
            // Load the original image
            tempImg.src = mainImage.src;
            
        } catch (error) {
            logger.error('PhotoEditor', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
            props.addFooterMessage('editor', `Failed to create styled copy: ${error}`, false, 5000);
        }
    }

    function resetStyle() {
        // First restore original styles before resetting state
        const mainImage = document.querySelector('#photoImgTag');
        if (mainImage) {
            const originalStyle = originalStyles.get('main-image');
            if (originalStyle) {
                mainImage.style.transform = originalStyle.transform;
                mainImage.style.filter = originalStyle.filter;
                mainImage.style.clipPath = originalStyle.clipPath || '';
            } else {
                mainImage.style.transform = '';
                mainImage.style.filter = '';
                mainImage.style.clipPath = '';
            }
        }
        
        // Restore original styles to thumbnails
        const restoreThumbnails = (selector, keyPrefix) => {
            const thumbnails = document.querySelectorAll(selector);
            thumbnails.forEach((img, index) => {
                const key = `${keyPrefix}-${index}`;
                const originalStyle = originalStyles.get(key);
                if (originalStyle) {
                    img.style.transform = originalStyle.transform;
                    img.style.filter = originalStyle.filter;
                    img.style.clipPath = originalStyle.clipPath || '';
                } else {
                    img.style.transform = '';
                    img.style.filter = '';
                    img.style.clipPath = '';
                }
            });
        };
        
        restoreThumbnails('.photos .row img', 'grid-thumb');
        restoreThumbnails('#photos-list-mini img', 'mini-thumb');
        
        // Clear stored original styles BEFORE resetting state
        setOriginalStyles(new Map());

        // Reset state (this will trigger applyTempStyles)
        setEditorStyles({ ...DEFAULT_EDITOR_VALUES });

        // Reset crop mode
        setCropMode(false);
        setCropSelection({ ...DEFAULT_EDITOR_VALUES.crop });
        
        // Clear CSS preview
        setTimeout(() => {
            const previewTextarea = document.getElementById('css-preview-text');
            if (previewTextarea) {
                previewTextarea.value = '';
            }
        }, 0);
    }

    async function downloadStyled() {
        if (!props.currentPhotoPath) {
            props.addFooterMessage('editor', 'Please select a photo first', false, 3000);
            return;
        }
        
        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('editor', 'No styles to download', false, 3000);
            return;
        }
        
        try {
            // Get the main image element
            const mainImage = document.querySelector('#photoImgTag');
            if (!mainImage) {
                props.addFooterMessage('editor', 'Photo not found', false, 3000);
                return;
            }
            
            // Create a canvas to render the styled image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match image
            canvas.width = mainImage.naturalWidth || mainImage.width;
            canvas.height = mainImage.naturalHeight || mainImage.height;
            
            // Create a new image with applied styles
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            
            tempImg.onload = function() {
                const { rotate, brightness, contrast, saturation, hue, scale } = editorStyles;

                // Create temporary canvas for filters
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = tempImg.width;
                tempCanvas.height = tempImg.height;

                // Draw the original image
                tempCtx.drawImage(tempImg, 0, 0);

                // Apply filters using extracted utility
                applyFiltersToCanvas(tempCtx, tempCanvas.width, tempCanvas.height,
                    { brightness, contrast, saturation, hue });

                // Apply transforms using extracted utility
                applyTransformsToCanvas(ctx, canvas.width, canvas.height, tempCanvas,
                    { rotate, scale });

                // Convert canvas to blob and download
                canvas.toBlob(async function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const fileName = props.currentPhotoPath.split('/').pop().replace(/\.[^/.]+$/, '_styled.png');
                    link.download = fileName;
                    link.href = url;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    // Get configurable download directory and show notification
                    try {
                        const downloadDir = await invoke('get_download_dir');
                        const fullPath = `${downloadDir}/${fileName}`;
                        
                        // Check and request notification permission if needed
                        let permissionGranted = await isPermissionGranted();
                        if (!permissionGranted) {
                            const permission = await requestPermission();
                            permissionGranted = permission === 'granted';
                        }
                        
                        // Show system notification if permission is granted
                        if (permissionGranted) {
                            await sendNotification({
                                title: 'Download Complete',
                                body: `Styled image saved to: ${fullPath}`
                            });
                        }
                        
                        // Also show footer message with full path and click-to-open functionality
                        props.addFooterMessage("download", `Styled image downloaded to: ${fullPath} (Click to open)`, false, 8000);
                        
                        // Add click handler to footer message
                        setTimeout(() => {
                            const downloadMessage = document.querySelector('.download');
                            if (downloadMessage) {
                                downloadMessage.style.cursor = 'pointer';
                                downloadMessage.style.textDecoration = 'underline';
                                downloadMessage.title = 'Click to open file';
                                downloadMessage.addEventListener('click', async () => {
                                    try {
                                        await invoke('open_file_in_default_app', { filePath: fullPath });
                                    } catch (error) {
                                        logger.error('PhotoEditor', 'file_open_failed', 'Failed to open downloaded file', { error: error.message });
                                        // Fallback to plugin opener
                                        try {
                                            await openUrl(fileUrl(fullPath));
                                        } catch (fallbackError) {
                                            logger.error('PhotoEditor', 'fallback_file_open_failed', 'Fallback file opening also failed', { error: fallbackError.message });
                                        }
                                    }
                                });
                            }
                        }, 100);
                    } catch (error) {
                        logger.error('PhotoEditor', 'download_notification_failed', 'Failed to get download directory or show notification', { error: error.message });
                        // Fallback to footer message only
                        props.addFooterMessage("download", `Styled image downloaded: ${fileName}`, false, 5000);
                    }
                }, 'image/png');
            };
            
            tempImg.onerror = function() {
                props.addFooterMessage('editor', 'Failed to load image for download', false, 3000);
            };
            
            // Load the original image
            tempImg.src = mainImage.src;
            
        } catch (error) {
            logger.error('PhotoEditor', 'download_failed', 'Download failed', { error: error.message });
            props.addFooterMessage('editor', 'Download failed: ' + error.message, false, 3000);
        }
    }

    // Crop functionality
    function enterCropMode() {
        setCropMode(true);
        setCropSelection({ x: 0, y: 0, width: 100, height: 100 });
        logger.debug('PhotoEditor', 'crop_mode_enter', 'Entering crop mode');
    }

    function exitCropMode() {
        setCropMode(false);
        setCropSelection({ x: 0, y: 0, width: 100, height: 100 });
        setIsDragging(false);
        logger.debug('PhotoEditor', 'crop_mode_exit', 'Exiting crop mode');
    }

    function applyCrop() {
        setEditorStyles(prev => ({
            ...prev,
            crop: { ...cropSelection }
        }));
        setCropMode(false);
        setIsDragging(false);
        
        // Apply the crop immediately
        const newStyles = {
            ...editorStyles,
            crop: { ...cropSelection }
        };
        applyTempStyles(newStyles, originalStyles, setOriginalStyles, props.currentPhotoPath);
    }

    function setCropPreset(preset) {
        const cropSelection = calculateCropFromPreset(preset);
        setCropSelection(cropSelection);
    }

    function handleImageMouseDown(e) {
        if (!cropMode) return;

        logger.debug('PhotoEditor', 'crop_mouse_down', 'Mouse down event in crop mode');

        // Get position relative to the overlay element (which covers the image)
        const rect = e.currentTarget.getBoundingClientRect();
        const position = calculateCropPosition(e, rect);

        setIsDragging(true);
        setDragStart(position);
        setDragMode('create');
        setCropSelection({ ...position, width: 0, height: 0 });

        // Prevent default to avoid any interference
        e.preventDefault();
        e.stopPropagation();
    }

    function handleImageMouseMove(e) {
        if (!cropMode || !isDragging) return;

        // Get position relative to the overlay element
        const rect = e.currentTarget.getBoundingClientRect();
        const position = calculateCropPosition(e, rect);

        if (dragMode === 'create') {
            const newCropSelection = calculateCropDrag(position, dragStart);
            setCropSelection(newCropSelection);
        }

        // Prevent default to avoid any interference
        e.preventDefault();
        e.stopPropagation();
    }

    function handleImageMouseUp(e) {
        if (!cropMode) return;
        logger.debug('PhotoEditor', 'crop_mouse_up', 'Mouse up event in crop mode');
        setIsDragging(false);
        
        // Prevent default to avoid any interference
        e.preventDefault();
        e.stopPropagation();
    }


    // Crop overlay handlers for CropTool component
    const cropHandlers = {
        onMouseDown: handleImageMouseDown,
        onMouseMove: handleImageMouseMove,
        onMouseUp: handleImageMouseUp
    };

    return (
        <>
            <CropTool
                cropMode={cropMode}
                cropSelection={cropSelection}
                handlers={cropHandlers}
            />
            <div className="editor-tab">
                <div className="photo-info-editor">
                    <div className="editor-controls">
                        <EditorControl
                            label={<>Rotation<br />(deg):</>}
                            value={editorStyles.rotate}
                            min={0}
                            max={360}
                            onChange={(v) => updateStyle('rotate', v)}
                            onReset={() => resetSingleControl('rotate')}
                            resetTitle="Reset rotation"
                        >
                            <div className="rotation-shortcuts">
                                <button className="shortcut-btn" onClick={() => rotateBy(-90)} title="Turn left 90°">↶ 90°</button>
                                <button className="shortcut-btn" onClick={() => rotateBy(90)} title="Turn right 90°">↷ 90°</button>
                            </div>
                        </EditorControl>
                        <EditorControl
                            label="Brightness:"
                            value={editorStyles.brightness}
                            min={0}
                            max={200}
                            onChange={(v) => updateStyle('brightness', v)}
                            onReset={() => resetSingleControl('brightness')}
                            resetTitle="Reset brightness"
                        />
                        <EditorControl
                            label="Contrast:"
                            value={editorStyles.contrast}
                            min={0}
                            max={200}
                            onChange={(v) => updateStyle('contrast', v)}
                            onReset={() => resetSingleControl('contrast')}
                            resetTitle="Reset contrast"
                        />
                        <EditorControl
                            label="Saturation:"
                            value={editorStyles.saturation}
                            min={0}
                            max={200}
                            onChange={(v) => updateStyle('saturation', v)}
                            onReset={() => resetSingleControl('saturation')}
                            resetTitle="Reset saturation"
                        />
                        <EditorControl
                            label="Hue (deg):"
                            value={editorStyles.hue}
                            min={0}
                            max={360}
                            onChange={(v) => updateStyle('hue', v)}
                            onReset={() => resetSingleControl('hue')}
                            resetTitle="Reset hue"
                        />
                        <EditorControl
                            label="Scale:"
                            value={editorStyles.scale}
                            min={50}
                            max={200}
                            onChange={(v) => updateStyle('scale', v)}
                            onReset={() => resetSingleControl('scale')}
                            resetTitle="Reset scale"
                        />
                        <div className="editor-control crop-control">
                            <div className="control-row">
                                <label>Crop:</label>
                                {!cropMode ? (
                                    <button className="action-btn" onClick={enterCropMode}>Crop</button>
                                ) : (
                                    <div className="crop-buttons">
                                        <button className="action-btn" onClick={applyCrop}>Done</button>
                                        <button className="action-btn" onClick={exitCropMode}>Cancel</button>
                                    </div>
                                )}
                            </div>
                            {cropMode && (
                                <div className="crop-presets">
                                    <label>Presets:</label>
                                    <div className="preset-buttons">
                                        {CROP_PRESETS.map((preset, index) => (
                                            <button
                                                key={index}
                                                className="preset-btn"
                                                onClick={() => setCropPreset(preset)}
                                                title={`Set crop to ${preset.name}`}
                                            >
                                                {preset.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="editor-buttons">
                        <button className="action-btn" onClick={() => applyStyle()}>Apply</button>
                        <button className="action-btn" onClick={() => saveAsCopy()}>Save As Copy</button>
                        <button className="action-btn" onClick={() => resetStyle()}>Reset</button>
                        <button className="action-btn" onClick={() => downloadStyled()}>Download</button>
                    </div>
                    <div className="css-preview">
                        <label>CSS Preview:</label>
                        <textarea id="css-preview-text" rows="4" readOnly className="css-preview-textarea"></textarea>
                    </div>
                </div>
            </div>
        </>
    );
}

export default PhotoEditor;
