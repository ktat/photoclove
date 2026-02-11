import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from 'react-i18next';
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
import CropTool from './CropTool.jsx';
import AdjustmentSlider from './PhotoEditor/AdjustmentSlider.jsx';

function PhotoEditor(props) {
    const { t } = useTranslation('common');
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
    const [savedCssStyle, setSavedCssStyle] = useState('');
    const [cssPreview, setCssPreview] = useState('');

    // Derive path from Photo entity (all backend invoke calls use relative path)
    const currentPhotoPath = props.currentPhoto?.originalPath;

    // Refs for checking unsaved changes (to avoid stale closure in useEffect)
    const editorStylesRef = useRef(editorStyles);
    const savedCssStyleRef = useRef(savedCssStyle);
    const currentPhotoPathRef = useRef(currentPhotoPath);

    // Keep refs in sync with state
    useEffect(() => {
        editorStylesRef.current = editorStyles;
    }, [editorStyles]);

    useEffect(() => {
        savedCssStyleRef.current = savedCssStyle;
    }, [savedCssStyle]);

    useEffect(() => {
        currentPhotoPathRef.current = currentPhotoPath;
    }, [currentPhotoPath]);

    // Reset visual styles on image elements
    function resetVisualStyles() {
        const mainImage = document.querySelector('#photoImgTag');
        if (mainImage) {
            mainImage.style.transform = '';
            mainImage.style.filter = '';
            mainImage.style.clipPath = '';
        }

        // Reset thumbnails
        const resetThumbnails = (selector) => {
            const thumbnails = document.querySelectorAll(selector);
            thumbnails.forEach((img) => {
                img.style.transform = '';
                img.style.filter = '';
                img.style.clipPath = '';
            });
        };

        resetThumbnails('.photos .row img');
        resetThumbnails('#photos-list-mini img');
    }

    // Load saved CSS styles when photo changes
    useEffect(() => {
        // Immediately clear CSS preview and reset state
        setCssPreview('');
        setEditorStyles({ ...DEFAULT_EDITOR_VALUES });
        setSavedCssStyle('');
        resetVisualStyles();
        setOriginalStyles(new Map());
        setCropMode(false);
        setCropSelection({ x: 0, y: 0, width: 100, height: 100 });
        // Reset parent state - no unsaved changes when photo changes
        props.setEditorHasUnsavedChanges?.(false);

        if (currentPhotoPath) {
            const loadingPhotoPath = currentPhotoPath;
            // Load saved CSS style for this photo
            invoke("get_css_style", { photoPath: currentPhotoPath })
                .then((loadedCssStyle) => {
                    // Check if photo hasn't changed during async load
                    if (currentPhotoPathRef.current !== loadingPhotoPath) {
                        return;
                    }

                    if (loadedCssStyle && loadedCssStyle.trim() !== '') {
                        // Parse the saved CSS and update editor values
                        const editorValues = parseCssToEditorValues(loadedCssStyle);
                        setEditorStyles(editorValues);
                        setSavedCssStyle(loadedCssStyle.trim());
                        setCssPreview(loadedCssStyle.trim());
                    }
                    // No else needed - defaults already set at start of useEffect
                })
                .catch((error) => {
                    // Check if photo hasn't changed during async load
                    if (currentPhotoPathRef.current !== loadingPhotoPath) {
                        return;
                    }
                    logger.error('PhotoEditor', 'css_load_failed', 'Failed to load CSS style', { photoPath: currentPhotoPath, error: error.message });
                    // Defaults already set at start of useEffect
                });
        }
    }, [currentPhotoPath])

    // Cleanup effect to reset crop mode when component unmounts
    useEffect(() => {
        return () => {
            setCropMode(false);
            setIsDragging(false);
        };
    }, [])

    // Update CSS preview when editor styles change
    useEffect(() => {
        if (currentPhotoPath) {
            const css = generateCSSFromValues(editorStyles);
            setCssPreview(css);
            // Update parent about unsaved changes
            const hasChanges = css !== savedCssStyle;
            props.setEditorHasUnsavedChanges?.(hasChanges);
            logger.debug('PhotoEditor', 'css_preview_updated', 'CSS preview updated', { css, hasChanges });
        }
    }, [editorStyles, currentPhotoPath, savedCssStyle])

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

            applyTempStyles(newStyles, originalStyles, setOriginalStyles, currentPhotoPath);
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
        if (!currentPhotoPath) {
            props.addFooterMessage('editor', t('photoEditor.selectPhotoFirst'), false, 3000);
            return;
        }

        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('editor', t('photoEditor.noStylesToApply'), false, 3000);
            return;
        }

        try {
            await invoke('save_css_style', {
                photoPath: currentPhotoPath,
                cssStyle: css
            });
            setSavedCssStyle(css);
            // Reset parent state - changes are now saved
            props.setEditorHasUnsavedChanges?.(false);
            props.addFooterMessage('editor', t('photoEditor.styleApplied'), false, 3000);
        } catch (error) {
            logger.error('PhotoEditor', 'style_apply_failed', 'Failed to apply style', { error: error.message });
            props.addFooterMessage('editor', t('photoEditor.styleFailed'), false, 3000);
        }
    }

    async function saveAsCopy() {
        if (!currentPhotoPath) {
            props.addFooterMessage('editor', t('photoEditor.selectPhotoFirst'), false, 3000);
            return;
        }

        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('editor', t('photoEditor.noStylesToSave'), false, 3000);
            return;
        }

        try {
            props.addFooterMessage('editor', t('photoEditor.creatingCopy'), false, 2000);

            const mainImage = document.querySelector('#photoImgTag');
            if (!mainImage) {
                props.addFooterMessage('editor', t('photoEditor.photoNotFound'), false, 3000);
                return;
            }

            await saveStyledCopy({
                mainImage,
                editorStyles,
                photoPath: currentPhotoPath,
                cssStyle: css,
                addFooterMessage: props.addFooterMessage,
                onPhotosRefresh: props.onPhotosRefresh
            });
        } catch (error) {
            logger.error('PhotoEditor', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
            props.addFooterMessage('editor', t('photoEditor.createCopyFailed', { error: error.message }), false, 5000);
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
        // cssPreview will be updated by useEffect when editorStyles changes
    }

    async function downloadStyled() {
        if (!currentPhotoPath) {
            props.addFooterMessage('editor', t('photoEditor.selectPhotoFirst'), false, 3000);
            return;
        }

        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('editor', t('photoEditor.noStylesToDownload'), false, 3000);
            return;
        }

        try {
            const mainImage = document.querySelector('#photoImgTag');
            if (!mainImage) {
                props.addFooterMessage('editor', t('photoEditor.photoNotFound'), false, 3000);
                return;
            }

            await downloadStyledImage({
                mainImage,
                editorStyles,
                photoPath: currentPhotoPath,
                addFooterMessage: props.addFooterMessage
            });
        } catch (error) {
            logger.error('PhotoEditor', 'download_failed', 'Download failed', { error: error.message });
            props.addFooterMessage('editor', t('photoEditor.downloadFailed', { error: error.message }), false, 3000);
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
        applyTempStyles(newStyles, originalStyles, setOriginalStyles, currentPhotoPath);
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
                        <table className={styles['editor-table']}>
                            <tbody>
                                <AdjustmentSlider
                                    label={<>{t('photoEditor.rotation')}<br />{t('photoEditor.deg')}</>}
                                    value={editorStyles.rotate}
                                    onChange={(val) => updateStyle('rotate', val)}
                                    onReset={() => resetSingleControl('rotate')}
                                    min={0}
                                    max={360}
                                    extraRow={
                                        <>
                                            <button className={styles['shortcut-btn']} onClick={() => rotateBy(-90)} title={t('photoEditor.turnLeft')}>↶ 90°</button>
                                            <button className={styles['shortcut-btn']} onClick={() => rotateBy(90)} title={t('photoEditor.turnRight')}>↷ 90°</button>
                                        </>
                                    }
                                />
                                <AdjustmentSlider
                                    label={t('photoEditor.brightness')}
                                    value={editorStyles.brightness}
                                    onChange={(val) => updateStyle('brightness', val)}
                                    onReset={() => resetSingleControl('brightness')}
                                    min={0}
                                    max={200}
                                />
                                <AdjustmentSlider
                                    label={t('photoEditor.contrast')}
                                    value={editorStyles.contrast}
                                    onChange={(val) => updateStyle('contrast', val)}
                                    onReset={() => resetSingleControl('contrast')}
                                    min={0}
                                    max={200}
                                />
                                <AdjustmentSlider
                                    label={t('photoEditor.saturation')}
                                    value={editorStyles.saturation}
                                    onChange={(val) => updateStyle('saturation', val)}
                                    onReset={() => resetSingleControl('saturation')}
                                    min={0}
                                    max={200}
                                />
                                <AdjustmentSlider
                                    label={t('photoEditor.hue')}
                                    value={editorStyles.hue}
                                    onChange={(val) => updateStyle('hue', val)}
                                    onReset={() => resetSingleControl('hue')}
                                    min={0}
                                    max={360}
                                />
                                <AdjustmentSlider
                                    label={t('photoEditor.scale')}
                                    value={editorStyles.scale}
                                    onChange={(val) => updateStyle('scale', val)}
                                    onReset={() => resetSingleControl('scale')}
                                    min={50}
                                    max={200}
                                />
                            </tbody>
                        </table>
                        <div className={styles['editor-control-crop']}>
                            <div className={styles['control-row']}>
                                <label>{t('photoEditor.crop')}:</label>
                                {!cropMode ? (
                                    <button className={styles['action-btn']} onClick={enterCropMode}>{t('photoEditor.crop')}</button>
                                ) : (
                                    <div className={styles['crop-buttons']}>
                                        <button className={styles['action-btn']} onClick={applyCrop}>{t('button.done')}</button>
                                        <button className={styles['action-btn']} onClick={exitCropMode}>{t('button.cancel')}</button>
                                    </div>
                                )}
                            </div>
                            {cropMode && (
                                <div className={styles['crop-presets']}>
                                    <label>{t('photoEditor.presets')}</label>
                                    <div className={styles['preset-buttons']}>
                                        {CROP_PRESETS.map((preset, index) => (
                                            <button
                                                key={index}
                                                className={styles['preset-btn']}
                                                onClick={() => setCropPreset(preset)}
                                                title={t('photoEditor.setCropPreset', { name: preset.name })}
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
                        <button className={styles['action-btn']} onClick={() => applyStyle()}>{t('button.apply')}</button>
                        <button className={styles['action-btn']} onClick={() => saveAsCopy()}>{t('photoEditor.saveAsCopy')}</button>
                        <button className={styles['action-btn']} onClick={() => resetStyle()}>{t('button.reset')}</button>
                        <button className={styles['action-btn']} onClick={() => downloadStyled()}>{t('button.download')}</button>
                    </div>
                    <div className={styles['css-preview']}>
                        <label>{t('photoEditor.cssPreview')}</label>
                        <textarea
                            id="css-preview-text"
                            rows="4"
                            readOnly
                            value={cssPreview}
                            className={styles['css-preview-textarea']}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

export default PhotoEditor;
