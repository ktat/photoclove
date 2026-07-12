/**
 * ShareTab Component
 *
 * Handles photo sharing and collage creation
 * Used in both PhotoOption (PhotoViewer) and DirectoryMenu (PhotoGrid)
 *
 * @param {Object} props
 * @param {string} props.currentPhotoPath - Current photo path (PhotoViewer only)
 * @param {Array} props.photoSelection - Selected photo paths
 * @param {boolean} props.isPhotoViewer - True if in PhotoViewer context
 * @param {string} props.userWatermarkText - Custom watermark text from preferences
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    generateShareablePhoto,
    generateCollage,
    getCollageLayout,
    copyImageToClipboard,
    saveImageAsFile,
    shareToSocial
} from '../../../utils/ShareUtils.js';
import { Photo } from '../../../domain/Photo.js';
import { logger } from '../../../services/LoggerService.js';
import { checkFirstActionAchievement } from '../../../services/AchievementService.js';
import CollageOrderEditor from './CollageOrderEditor.jsx';
import styles from './ShareTab.module.css';

// Video extensions excluded from collage/share (matches Photo.isVideo()).
const VIDEO_EXT_REGEX = /\.(mp4|webm|avi|mov)$/i;

const BACKGROUND_COLORS = [
    { value: '#000000', label: 'Black' },
    { value: '#ffffff', label: 'White' },
    { value: '#1a1a2e', label: 'Dark Blue' },
    { value: '#2d2d2d', label: 'Gray' }
];

function ShareTab({
    currentPhotoPath,
    photoSelection = [],
    isPhotoViewer = false,
    userWatermarkText = '',
    appConfig,
    // In DirectoryMenu the Share tab stays mounted but hidden via CSS, so pass
    // whether it is the visible tab. undefined (e.g. PhotoOption, which mounts
    // ShareTab only when active) is treated as active.
    isActive
}) {
    const { t } = useTranslation(['directoryMenu', 'common']);

    // Source selection (PhotoViewer only)
    const [photoSource, setPhotoSource] = useState('current'); // 'current' | 'selection'

    // Mode: 'single' or 'collage'
    const [shareMode, setShareMode] = useState('single');

    // Generated image state
    const [imageBlob, setImageBlob] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [copyStatus, setCopyStatus] = useState(null);

    // Big photo overlay
    const [showBigPhoto, setShowBigPhoto] = useState(false);

    // Watermark options
    const [addPhotoCloveWatermark, setAddPhotoCloveWatermark] = useState(true);
    const [addUserWatermark, setAddUserWatermark] = useState(true);
    const [watermarkColor, setWatermarkColor] = useState('#ffffff');
    const [watermarkOpacity, setWatermarkOpacity] = useState(70);
    const [watermarkStyle, setWatermarkStyle] = useState('corner');

    // Collage options
    const [backgroundColor, setBackgroundColor] = useState('#000000');
    const [customColor, setCustomColor] = useState('#333333');
    const [useCustomColor, setUseCustomColor] = useState(false);
    const [padding, setPadding] = useState(10);
    const [cornerRadius, setCornerRadius] = useState(8);

    // Resolve relative paths to absolute via Photo entity for image loading
    const resolveToDisplayPath = useCallback((path) => {
        if (!path || path.startsWith('/')) return path;
        const photo = Photo.fromJSON({
            originalPath: path,
            name: path.replace(/^.+\//, ''),
            configData: {
                import_to: appConfig?.import_to,
                thumbnail_store: appConfig?.thumbnail_store,
                trash_path: appConfig?.trash_path
            }
        });
        return photo?.displayPath() || path;
    }, [appConfig]);

    // Determine active photos based on source (resolved to absolute paths for image loading).
    // Videos can't be drawn into a collage (they load as broken images), so they
    // are excluded here even when selected — this keeps them out of the collage,
    // the order editor, and the layout count. Extensions match Photo.isVideo().
    const activePhotos = useMemo(() => {
        if (isPhotoViewer && photoSource === 'current' && currentPhotoPath) {
            return [currentPhotoPath];
        }
        return photoSelection
            .filter(p => !VIDEO_EXT_REGEX.test(p))
            .map(resolveToDisplayPath);
    }, [isPhotoViewer, photoSource, currentPhotoPath, photoSelection, resolveToDisplayPath]);

    // User-controlled collage order. Mirrors activePhotos but keeps any
    // ordering set by the drag handle in CollageOrderEditor. Reconciles
    // on activePhotos changes by preserving existing positions for kept
    // paths and appending newly-added ones to the end.
    const [orderedPaths, setOrderedPaths] = useState([]);
    useEffect(() => {
        setOrderedPaths(prev => {
            const activeSet = new Set(activePhotos);
            const kept = prev.filter(p => activeSet.has(p));
            const keptSet = new Set(kept);
            const additions = activePhotos.filter(p => !keptSet.has(p));
            return [...kept, ...additions];
        });
    }, [activePhotos]);

    // Auto-select mode based on photo count
    useEffect(() => {
        if (activePhotos.length === 1) {
            setShareMode('single');
        } else if (activePhotos.length >= 2) {
            // Keep current mode or default to collage
            if (shareMode === 'single' && activePhotos.length >= 2) {
                setShareMode('collage');
            }
        }
    }, [activePhotos.length]);

    // Layout info for collage
    const photoCount = Math.min(activePhotos.length, 9);
    const layout = useMemo(() => getCollageLayout(photoCount), [photoCount]);
    const layoutDescription = layout ? `${photoCount} photos - ${layout.cols}x${layout.rows}` : '';

    // Effective background color
    const effectiveBackgroundColor = useCustomColor ? customColor : backgroundColor;

    // Generate image when options change
    useEffect(() => {
        // Skip the expensive collage/image generation while the Share tab is
        // hidden. In DirectoryMenu the tab stays mounted (CSS hide), so without
        // this every selection toggle would reload images and run canvas work
        // even when the user never opened Share. isActive === false means hidden;
        // undefined (PhotoOption) is treated as active.
        if (isActive === false) {
            return;
        }

        if (activePhotos.length === 0) {
            setImageBlob(null);
            setImageUrl(null);
            return;
        }

        // Debounce regeneration
        const timeoutId = setTimeout(() => {
            setGenerating(true);

            const generateImage = async () => {
                try {
                    let blob;
                    const watermarkOptions = {
                        addPhotoCloveWatermark,
                        addUserWatermark: addUserWatermark && !!userWatermarkText,
                        userWatermarkText,
                        watermarkColor,
                        watermarkOpacity: watermarkOpacity / 100,
                        watermarkStyle
                    };

                    if (shareMode === 'single' && activePhotos.length >= 1) {
                        blob = await generateShareablePhoto(activePhotos[0], watermarkOptions);
                    } else if (shareMode === 'collage' && orderedPaths.length >= 2) {
                        blob = await generateCollage(orderedPaths.slice(0, 9), {
                            backgroundColor: effectiveBackgroundColor,
                            padding,
                            cornerRadius,
                            ...watermarkOptions
                        });
                    }

                    if (blob) {
                        // Revoke old URL
                        if (imageUrl) {
                            URL.revokeObjectURL(imageUrl);
                        }
                        setImageBlob(blob);
                        setImageUrl(URL.createObjectURL(blob));
                    }
                } catch (err) {
                    logger.error('ShareTab', 'generate_error', 'Failed to generate image', { error: err.message });
                } finally {
                    setGenerating(false);
                }
            };

            generateImage();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [isActive, activePhotos, orderedPaths, shareMode, addPhotoCloveWatermark, addUserWatermark, userWatermarkText, effectiveBackgroundColor, padding, cornerRadius, watermarkColor, watermarkOpacity, watermarkStyle]);

    // Cleanup URL on unmount
    useEffect(() => {
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, []);

    // Handle copy image
    const handleCopyImage = useCallback(async () => {
        if (!imageBlob) return;
        const success = await copyImageToClipboard(imageBlob);
        setCopyStatus(success ? 'copied' : 'error');
        setTimeout(() => setCopyStatus(null), 2000);
        // Trigger collage achievement if successful
        if (success && shareMode === 'collage') {
            checkFirstActionAchievement('first_collage').catch(() => {});
        }
    }, [imageBlob, shareMode]);

    // Handle save image
    const [saveStatus, setSaveStatus] = useState(null);
    const handleSaveImage = useCallback(async () => {
        if (!imageBlob) return;
        const now = new Date();
        const timestamp = now.toISOString().split('T')[0] + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        const filename = shareMode === 'collage'
            ? `photoclove-collage-${timestamp}.png`
            : `photoclove-share-${timestamp}.png`;
        try {
            await saveImageAsFile(imageBlob, filename, appConfig?.copyright || null);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(null), 2000);
            // Trigger collage achievement if successful
            if (shareMode === 'collage') {
                checkFirstActionAchievement('first_collage').catch(() => {});
            }
        } catch (error) {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 2000);
        }
    }, [imageBlob, shareMode, appConfig]);

    // Check if we have enough photos
    const hasPhotos = activePhotos.length > 0;
    const canCreateCollage = activePhotos.length >= 2;

    return (
        <div className={styles.shareTab}>
            {/* Source Selection (PhotoViewer only) */}
            {isPhotoViewer && (
                <div className={styles.section}>
                    <label className={styles.sectionTitle}>
                        {t('directoryMenu:share.photoSource', 'Photo Source')}
                    </label>
                    <div className={styles.sourceButtons}>
                        <button
                            className={`${styles.sourceBtn} ${photoSource === 'current' ? styles.active : ''}`}
                            onClick={() => setPhotoSource('current')}
                            disabled={!currentPhotoPath}
                        >
                            {t('directoryMenu:share.currentPhoto', 'Current Photo')}
                        </button>
                        <button
                            className={`${styles.sourceBtn} ${photoSource === 'selection' ? styles.active : ''}`}
                            onClick={() => setPhotoSource('selection')}
                            disabled={photoSelection.length === 0}
                        >
                            {t('directoryMenu:share.selection', 'Selection')} ({photoSelection.length})
                        </button>
                    </div>
                </div>
            )}

            {/* Mode Selection */}
            {hasPhotos && (
                <div className={styles.section}>
                    <label className={styles.sectionTitle}>
                        {t('directoryMenu:share.mode', 'Mode')}
                    </label>
                    <div className={styles.modeButtons}>
                        <button
                            className={`${styles.modeBtn} ${shareMode === 'single' ? styles.active : ''}`}
                            onClick={() => setShareMode('single')}
                        >
                            {t('directoryMenu:share.singlePhoto', 'Single Photo')}
                        </button>
                        <button
                            className={`${styles.modeBtn} ${shareMode === 'collage' ? styles.active : ''}`}
                            onClick={() => setShareMode('collage')}
                            disabled={!canCreateCollage}
                            title={!canCreateCollage ? t('directoryMenu:share.needTwoPhotos', 'Need 2+ photos') : ''}
                        >
                            {t('directoryMenu:share.collage', 'Collage')}
                        </button>
                    </div>
                </div>
            )}

            {/* Collage order (drag-and-drop) */}
            {shareMode === 'collage' && canCreateCollage && (
                <div className={styles.section}>
                    <label className={styles.sectionTitle}>
                        {t('directoryMenu:share.order', 'Order')}
                    </label>
                    <CollageOrderEditor
                        paths={orderedPaths.slice(0, 9)}
                        onReorder={(reordered) => {
                            // Preserve any extras beyond 9 — they're not in
                            // the collage but are still in the selection.
                            setOrderedPaths(prev => [...reordered, ...prev.slice(9)]);
                        }}
                    />
                </div>
            )}

            {/* Preview */}
            {hasPhotos && (
                <div className={styles.section}>
                    <div className={styles.preview}>
                        {generating ? (
                            <div className={styles.generating}>
                                {t('common:status.processing', 'Processing...')}
                            </div>
                        ) : imageUrl ? (
                            <img src={imageUrl} alt="Preview" />
                        ) : (
                            <div className={styles.noPreview}>
                                {t('directoryMenu:share.noPreview', 'No preview')}
                            </div>
                        )}
                    </div>
                    {shareMode === 'collage' && layoutDescription && (
                        <div className={styles.layoutInfo}>{layoutDescription}</div>
                    )}
                    {imageUrl && !generating && (
                        <a
                            className={styles.enlargeLink}
                            onClick={() => setShowBigPhoto(true)}
                        >
                            {t('directoryMenu:share.enlarge', 'Enlarge preview')}
                        </a>
                    )}
                    {showBigPhoto && imageUrl && (
                        <div
                            className={styles.bigPhoto}
                            onMouseLeave={() => setShowBigPhoto(false)}
                            onClick={() => setShowBigPhoto(false)}
                        >
                            <img src={imageUrl} alt="Preview enlarged" />
                        </div>
                    )}
                </div>
            )}

            {/* Options */}
            {hasPhotos && (
                <div className={styles.section}>
                    <label className={styles.sectionTitle}>
                        {t('directoryMenu:share.options', 'Options')}
                    </label>

                    {/* Collage-specific options */}
                    {shareMode === 'collage' && canCreateCollage && (
                        <>
                            {/* Background Color */}
                            <div className={styles.optionGroup}>
                                <label className={styles.optionLabel}>
                                    {t('directoryMenu:share.backgroundColor', 'Background')}
                                </label>
                                <div className={styles.colorOptions}>
                                    {BACKGROUND_COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            className={`${styles.colorBtn} ${!useCustomColor && backgroundColor === color.value ? styles.selected : ''}`}
                                            style={{ backgroundColor: color.value }}
                                            onClick={() => {
                                                setBackgroundColor(color.value);
                                                setUseCustomColor(false);
                                            }}
                                            title={color.label}
                                        />
                                    ))}
                                    <label className={styles.customColorWrapper}>
                                        <input
                                            type="color"
                                            value={customColor}
                                            onChange={(e) => {
                                                setCustomColor(e.target.value);
                                                setUseCustomColor(true);
                                            }}
                                            className={styles.customColorInput}
                                        />
                                        <span
                                            className={`${styles.colorBtn} ${styles.customColor} ${useCustomColor ? styles.selected : ''}`}
                                            style={{ backgroundColor: customColor }}
                                            title="Custom"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Padding */}
                            <div className={styles.optionGroup}>
                                <label className={styles.optionLabel}>
                                    {t('directoryMenu:share.padding', 'Padding')}: {padding}px
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="30"
                                    value={padding}
                                    onChange={(e) => setPadding(Number(e.target.value))}
                                    className={styles.slider}
                                />
                            </div>

                            {/* Corner Radius */}
                            <div className={styles.optionGroup}>
                                <label className={styles.optionLabel}>
                                    {t('directoryMenu:share.corners', 'Corners')}: {cornerRadius}px
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="24"
                                    value={cornerRadius}
                                    onChange={(e) => setCornerRadius(Number(e.target.value))}
                                    className={styles.slider}
                                />
                            </div>
                        </>
                    )}

                    {/* PhotoClove Watermark */}
                    <div className={styles.optionGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={addPhotoCloveWatermark}
                                onChange={(e) => setAddPhotoCloveWatermark(e.target.checked)}
                            />
                            <span>{t('directoryMenu:share.addPhotoCloveWatermark', 'Add PhotoClove watermark')}</span>
                        </label>
                    </div>

                    {/* User Watermark (only shown when configured) */}
                    {userWatermarkText && (
                        <div className={styles.optionGroup}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={addUserWatermark}
                                    onChange={(e) => setAddUserWatermark(e.target.checked)}
                                />
                                <span>{t('directoryMenu:share.addUserWatermark', 'Add your watermark')}</span>
                            </label>
                            <span className={styles.watermarkPreview}>"{userWatermarkText}"</span>
                        </div>
                    )}

                    {/* Watermark Style (show when at least one watermark is enabled) */}
                    {(addPhotoCloveWatermark || (addUserWatermark && userWatermarkText)) && (
                        <div className={styles.optionGroup}>
                            <label className={styles.optionLabel}>
                                {t('directoryMenu:share.watermarkStyle', 'Watermark Style')}
                            </label>
                            <div className={styles.watermarkStyleButtons}>
                                <button
                                    className={`${styles.modeBtn} ${watermarkStyle === 'corner' ? styles.active : ''}`}
                                    onClick={() => setWatermarkStyle('corner')}
                                >
                                    {t('directoryMenu:share.watermarkCorner', 'Corner')}
                                </button>
                                <button
                                    className={`${styles.modeBtn} ${watermarkStyle === 'diagonal' ? styles.active : ''}`}
                                    onClick={() => setWatermarkStyle('diagonal')}
                                >
                                    {t('directoryMenu:share.watermarkDiagonal', 'Diagonal')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Watermark Color & Opacity (show when at least one watermark is enabled) */}
                    {(addPhotoCloveWatermark || (addUserWatermark && userWatermarkText)) && (
                        <>
                            {/* Watermark Color */}
                            <div className={styles.optionGroup}>
                                <label className={styles.optionLabel}>
                                    {t('directoryMenu:share.watermarkColor', 'Watermark Color')}
                                </label>
                                <div className={styles.colorOptions}>
                                    {[
                                        { value: '#ffffff', label: 'White' },
                                        { value: '#000000', label: 'Black' },
                                        { value: '#cccccc', label: 'Gray' }
                                    ].map(color => (
                                        <button
                                            key={color.value}
                                            className={`${styles.colorBtn} ${watermarkColor === color.value ? styles.selected : ''}`}
                                            style={{ backgroundColor: color.value }}
                                            onClick={() => setWatermarkColor(color.value)}
                                            title={color.label}
                                        />
                                    ))}
                                    <label className={styles.customColorWrapper}>
                                        <input
                                            type="color"
                                            value={watermarkColor}
                                            onChange={(e) => setWatermarkColor(e.target.value)}
                                            className={styles.customColorInput}
                                        />
                                        <span
                                            className={`${styles.colorBtn} ${styles.customColor} ${!['#ffffff', '#000000', '#cccccc'].includes(watermarkColor) ? styles.selected : ''}`}
                                            style={{ backgroundColor: watermarkColor }}
                                            title="Custom"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Watermark Opacity */}
                            <div className={styles.optionGroup}>
                                <label className={styles.optionLabel}>
                                    {t('directoryMenu:share.watermarkOpacity', 'Watermark Opacity')}: {watermarkOpacity}%
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={watermarkOpacity}
                                    onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                                    className={styles.slider}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Actions */}
            {hasPhotos && imageBlob && (
                <>
                    <div className={styles.actions}>
                        <button
                            className={`${styles.actionBtn} ${copyStatus === 'copied' ? styles.success : ''}`}
                            onClick={handleCopyImage}
                            disabled={generating}
                        >
                            <span className={styles.actionIcon}>📋</span>
                            <span>
                                {copyStatus === 'copied'
                                    ? t('common:status.copied', 'Copied!')
                                    : t('directoryMenu:share.copy', 'Copy')}
                            </span>
                        </button>
                        <button
                            className={`${styles.actionBtn} ${saveStatus === 'saved' ? styles.success : ''}`}
                            onClick={handleSaveImage}
                            disabled={generating}
                        >
                            <span className={styles.actionIcon}>💾</span>
                            <span>
                                {saveStatus === 'saved'
                                    ? t('common:status.saved', 'Saved!')
                                    : t('directoryMenu:share.save', 'Save')}
                            </span>
                        </button>
                    </div>

                    {/* Social Share */}
                    <div className={styles.section}>
                        <label className={styles.sectionTitle}>
                            {t('directoryMenu:share.shareTo', 'Share to')}
                        </label>
                        <div className={styles.socialButtons}>
                            <button
                                className={styles.socialBtn}
                                onClick={() => shareToSocial('twitter', '#PhotoClove')}
                                title="X (Twitter)"
                            >
                                𝕏
                            </button>
                            <button
                                className={styles.socialBtn}
                                onClick={() => shareToSocial('bluesky', '#PhotoClove')}
                                title="Bluesky"
                            >
                                🦋
                            </button>
                            <button
                                className={styles.socialBtn}
                                onClick={() => shareToSocial('threads', '')}
                                title="Threads"
                            >
                                @
                            </button>
                            <button
                                className={styles.socialBtn}
                                onClick={() => shareToSocial('instagram', '')}
                                title="Instagram"
                            >
                                📷
                            </button>
                            <button
                                className={styles.socialBtn}
                                onClick={() => shareToSocial('facebook', '#PhotoClove')}
                                title="Facebook"
                            >
                                f
                            </button>
                        </div>
                        <p className={styles.socialHint}>
                            {t('directoryMenu:share.socialHint', 'Copy image first, then paste after opening')}
                        </p>
                    </div>
                </>
            )}

            {/* Empty State */}
            {!hasPhotos && (
                <div className={styles.emptyState}>
                    {isPhotoViewer ? (
                        t('directoryMenu:share.noPhotoSelected', 'No photo selected')
                    ) : (
                        t('directoryMenu:share.selectPhotosFirst', 'Select photos to share')
                    )}
                </div>
            )}
        </div>
    );
}

export default ShareTab;
