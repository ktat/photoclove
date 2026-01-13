import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from '../../../services/LoggerService.js';
import styles from './PhotoEditor.module.css';

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
// Photo export utilities (improvement #160)
import {
    downloadStyledImage,
    saveStyledCopy
} from './PhotoEditor/photoExportUtils.js';
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

    // Update CSS preview when editor styles change
    useEffect(() => {
        if (props.currentPhotoPath) {
            setTimeout(() => {
                const css = generateCSSFromValues(editorStyles);
                const previewTextarea = document.getElementById('css-preview-text');
                if (previewTextarea) {
                    previewTextarea.value = css;
                    logger.debug('PhotoEditor', 'css_preview_updated', 'CSS preview updated', { css });
                }
                updateUIElementsWithValues(editorStyles, css);
            }, 100);
        }
    }, [editorStyles])

    // Helper function to update CSS preview
    function updateUIElementsWithValues(editorValues, cssStyle) {
        logger.debug('PhotoEditor', 'update_css_preview', 'Updating CSS preview with values', { editorValues });
        const previewTextarea = document.getElementById('css-preview-text');
        if (previewTextarea) {
            previewTextarea.value = cssStyle || '';
        }
    }

    // Editor functions
    function updateStyle(property, value) {
        if (property === 'rotate' || property === 'hue') {
            value = normalizeRotationValue(value);
        }

        setEditorStyles(prev => {
            const newStyles = {
                ...prev,
                [property]: parseInt(value)
            };

            const css = generateCSSFromValues(newStyles);
            const previewTextarea = document.getElementById('css-preview-text');
            if (previewTextarea) {
                previewTextarea.value = css;
            }

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

            const mainImage = document.querySelector('#photoImgTag');
            if (!mainImage) {
                props.addFooterMessage('editor', 'Photo not found', false, 3000);
                return;
            }

            await saveStyledCopy({
                mainImage,
                editorStyles,
                photoPath: props.currentPhotoPath,
                cssStyle: css,
                addFooterMessage: props.addFooterMessage,
                onPhotosRefresh: props.onPhotosRefresh
            });
        } catch (error) {
            logger.error('PhotoEditor', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
            props.addFooterMessage('editor', `Failed to create styled copy: ${error.message}`, false, 5000);
        }
    }

    function resetStyle() {
        // Restore original styles to main image
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

        setOriginalStyles(new Map());
        setEditorStyles({ ...DEFAULT_EDITOR_VALUES });
        setCropMode(false);
        setCropSelection({ ...DEFAULT_EDITOR_VALUES.crop });

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
            const mainImage = document.querySelector('#photoImgTag');
            if (!mainImage) {
                props.addFooterMessage('editor', 'Photo not found', false, 3000);
                return;
            }

            await downloadStyledImage({
                mainImage,
                editorStyles,
                photoPath: props.currentPhotoPath,
                addFooterMessage: props.addFooterMessage
            });
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

        const newStyles = {
            ...editorStyles,
            crop: { ...cropSelection }
        };
        applyTempStyles(newStyles, originalStyles, setOriginalStyles, props.currentPhotoPath);
    }

    function setCropPreset(preset) {
        const newCropSelection = calculateCropFromPreset(preset);
        setCropSelection(newCropSelection);
    }

    function handleImageMouseDown(e) {
        if (!cropMode) return;

        logger.debug('PhotoEditor', 'crop_mouse_down', 'Mouse down event in crop mode');

        const rect = e.currentTarget.getBoundingClientRect();
        const position = calculateCropPosition(e, rect);

        setIsDragging(true);
        setDragStart(position);
        setDragMode('create');
        setCropSelection({ ...position, width: 0, height: 0 });

        e.preventDefault();
        e.stopPropagation();
    }

    function handleImageMouseMove(e) {
        if (!cropMode || !isDragging) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const position = calculateCropPosition(e, rect);

        if (dragMode === 'create') {
            const newCropSelection = calculateCropDrag(position, dragStart);
            setCropSelection(newCropSelection);
        }

        e.preventDefault();
        e.stopPropagation();
    }

    function handleImageMouseUp(e) {
        if (!cropMode) return;
        logger.debug('PhotoEditor', 'crop_mouse_up', 'Mouse up event in crop mode');
        setIsDragging(false);

        e.preventDefault();
        e.stopPropagation();
    }

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
            <div className={styles['editor-tab']}>
                <div className={styles['photo-info-editor']}>
                    <div className={styles['editor-controls']}>
                        <EditorControl
                            label={<>Rotation<br />(deg):</>}
                            value={editorStyles.rotate}
                            min={0}
                            max={360}
                            onChange={(v) => updateStyle('rotate', v)}
                            onReset={() => resetSingleControl('rotate')}
                            resetTitle="Reset rotation"
                        >
                            <div className={styles['rotation-shortcuts']}>
                                <button className={styles['shortcut-btn']} onClick={() => rotateBy(-90)} title="Turn left 90°">↶ 90°</button>
                                <button className={styles['shortcut-btn']} onClick={() => rotateBy(90)} title="Turn right 90°">↷ 90°</button>
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
                        <div className={styles['editor-control-crop']}>
                            <div className={styles['control-row']}>
                                <label>Crop:</label>
                                {!cropMode ? (
                                    <button className={styles['action-btn']} onClick={enterCropMode}>Crop</button>
                                ) : (
                                    <div className={styles['crop-buttons']}>
                                        <button className={styles['action-btn']} onClick={applyCrop}>Done</button>
                                        <button className={styles['action-btn']} onClick={exitCropMode}>Cancel</button>
                                    </div>
                                )}
                            </div>
                            {cropMode && (
                                <div className={styles['crop-presets']}>
                                    <label>Presets:</label>
                                    <div className={styles['preset-buttons']}>
                                        {CROP_PRESETS.map((preset, index) => (
                                            <button
                                                key={index}
                                                className={styles['preset-btn']}
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
                    <div className={styles['editor-buttons']}>
                        <button className={styles['action-btn']} onClick={() => applyStyle()}>Apply</button>
                        <button className={styles['action-btn']} onClick={() => saveAsCopy()}>Save As Copy</button>
                        <button className={styles['action-btn']} onClick={() => resetStyle()}>Reset</button>
                        <button className={styles['action-btn']} onClick={() => downloadStyled()}>Download</button>
                    </div>
                    <div className={styles['css-preview']}>
                        <label>CSS Preview:</label>
                        <textarea id="css-preview-text" rows="4" readOnly className={styles['css-preview-textarea']}></textarea>
                    </div>
                </div>
            </div>
        </>
    );
}

export default PhotoEditor;
