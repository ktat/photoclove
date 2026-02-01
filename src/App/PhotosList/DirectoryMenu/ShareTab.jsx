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
import { logger } from '../../../services/LoggerService.js';
import styles from './ShareTab.module.css';

const BACKGROUND_COLORS = [
    { value: '#000000', label: 'Black' },
    { value: '#ffffff', label: 'White' },
    { value: '#1a1a2e', label: 'Dark Blue' },
    { value: '#2d2d2d', label: 'Gray' }
];

function ShareTab({
    currentPhotoPath,
    photoSelection = [],
    isPhotoViewer = false
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

    // Single photo options
    const [addWatermark, setAddWatermark] = useState(false);

    // Collage options
    const [backgroundColor, setBackgroundColor] = useState('#000000');
    const [customColor, setCustomColor] = useState('#333333');
    const [useCustomColor, setUseCustomColor] = useState(false);
    const [padding, setPadding] = useState(10);
    const [cornerRadius, setCornerRadius] = useState(8);

    // Determine active photos based on source
    const activePhotos = useMemo(() => {
        if (isPhotoViewer && photoSource === 'current' && currentPhotoPath) {
            return [currentPhotoPath];
        }
        return photoSelection;
    }, [isPhotoViewer, photoSource, currentPhotoPath, photoSelection]);

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
                    if (shareMode === 'single' && activePhotos.length >= 1) {
                        blob = await generateShareablePhoto(activePhotos[0], { addWatermark });
                    } else if (shareMode === 'collage' && activePhotos.length >= 2) {
                        blob = await generateCollage(activePhotos.slice(0, 9), {
                            backgroundColor: effectiveBackgroundColor,
                            padding,
                            cornerRadius,
                            addWatermark
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
    }, [activePhotos, shareMode, addWatermark, effectiveBackgroundColor, padding, cornerRadius]);

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
    }, [imageBlob]);

    // Handle save image
    const handleSaveImage = useCallback(() => {
        if (!imageBlob) return;
        const date = new Date().toISOString().split('T')[0];
        const filename = shareMode === 'collage'
            ? `photoclove-collage-${date}.png`
            : `photoclove-share-${date}.png`;
        saveImageAsFile(imageBlob, filename);
    }, [imageBlob, shareMode]);

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

                    {/* Watermark (all modes) */}
                    <div className={styles.optionGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={addWatermark}
                                onChange={(e) => setAddWatermark(e.target.checked)}
                            />
                            <span>{t('directoryMenu:share.addWatermark', 'Add PhotoClove watermark')}</span>
                        </label>
                    </div>
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
                            className={styles.actionBtn}
                            onClick={handleSaveImage}
                            disabled={generating}
                        >
                            <span className={styles.actionIcon}>💾</span>
                            <span>{t('directoryMenu:share.save', 'Save')}</span>
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
