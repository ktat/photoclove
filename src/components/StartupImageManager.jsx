import React, { useState, useEffect } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { logger } from '../services/LoggerService.js';
import styles from './StartupImageManager.module.css';

/**
 * StartupImageManager Component
 *
 * Manages custom startup/splash images for the application.
 * Users can add photos from their library to display on startup,
 * enable/disable individual images, or switch between default, custom, and memories modes.
 */
const StartupImageManager = ({ config, setConfig }) => {
    const { t } = useTranslation('preferences');

    // Get startup images config with defaults
    const startupImages = config?.startup_images || { mode: 'default', images: [], show_memories_on_home: true, memories_fallback: 'default' };
    const mode = startupImages.mode || 'default';
    const images = startupImages.images || [];
    const showMemoriesOnHome = startupImages.show_memories_on_home !== false;
    const memoriesFallback = startupImages.memories_fallback || 'default';

    // State for memories preview
    const [memoriesPreview, setMemoriesPreview] = useState([]);
    const [memoriesLoading, setMemoriesLoading] = useState(false);

    // Sort images by photo_date descending (newest first)
    const sortedImages = [...images].sort((a, b) => {
        return (b.photo_date || '').localeCompare(a.photo_date || '');
    });

    const enabledCount = images.filter(img => img.enabled).length;

    // Load memories preview when switching to memories mode
    useEffect(() => {
        if (mode === 'memories') {
            loadMemoriesPreview();
        }
    }, [mode]);

    const loadMemoriesPreview = async () => {
        setMemoriesLoading(true);
        try {
            const response = await invoke("get_photos_unified", {
                request: {
                    type: "search",
                    search_type: "memories",
                    query: null,
                    star: null,
                    has_comment: null,
                    extension: null,
                    page: null,
                    limit: null,
                    offset: null,
                    sort_value: null,
                    params: null
                }
            });
            const result = JSON.parse(response);
            setMemoriesPreview(result.groups || []);
        } catch (error) {
            logger.error('StartupImageManager', 'load_memories_preview_error', 'Failed to load memories', { error: error.message });
            setMemoriesPreview([]);
        } finally {
            setMemoriesLoading(false);
        }
    };

    const handleModeChange = (newMode) => {
        setConfig(prev => ({
            ...prev,
            startup_images: {
                ...startupImages,
                mode: newMode
            }
        }));
        logger.info('StartupImageManager', 'mode_changed', 'Startup image mode changed', { newMode });
    };

    const handleShowMemoriesOnHomeChange = (e) => {
        setConfig(prev => ({
            ...prev,
            startup_images: {
                ...startupImages,
                show_memories_on_home: e.target.checked
            }
        }));
        logger.info('StartupImageManager', 'show_memories_on_home_changed', 'Show memories on home changed', { value: e.target.checked });
    };

    const handleMemoriesFallbackChange = (fallback) => {
        setConfig(prev => ({
            ...prev,
            startup_images: {
                ...startupImages,
                memories_fallback: fallback
            }
        }));
        logger.info('StartupImageManager', 'memories_fallback_changed', 'Memories fallback changed', { value: fallback });
    };

    const handleToggleEnabled = (path) => {
        const updatedImages = images.map(img =>
            img.path === path ? { ...img, enabled: !img.enabled } : img
        );
        setConfig(prev => ({
            ...prev,
            startup_images: {
                ...startupImages,
                images: updatedImages
            }
        }));
        logger.info('StartupImageManager', 'image_toggled', 'Startup image enabled state toggled', {
            path,
            enabled: !images.find(img => img.path === path)?.enabled
        });
    };

    const handleRemoveImage = (path) => {
        const updatedImages = images.filter(img => img.path !== path);
        setConfig(prev => ({
            ...prev,
            startup_images: {
                ...startupImages,
                images: updatedImages
            }
        }));
        logger.info('StartupImageManager', 'image_removed', 'Startup image removed', { path });
    };

    // Extract filename from path for display
    const getDisplayName = (path) => {
        return path.split('/').pop() || path;
    };

    // Format date for display
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        // Handle both YYYY/MM/DD and YYYY-MM-DD formats
        return dateStr.replace(/\//g, '-');
    };

    return (
        <div className={styles.startupImageManager}>
            {/* Mode Selection */}
            <div className={styles.modeSelection}>
                <label className={styles.modeOption}>
                    <input
                        type="radio"
                        name="startupImageMode"
                        value="default"
                        checked={mode === 'default'}
                        onChange={() => handleModeChange('default')}
                    />
                    <span className={styles.modeLabel}>{t('startup.defaultImages', 'Use default images')}</span>
                    <span className={styles.modeDescription}>
                        {t('startup.defaultImagesDescription', 'Show built-in landscape photos on startup')}
                    </span>
                </label>
                <label className={styles.modeOption}>
                    <input
                        type="radio"
                        name="startupImageMode"
                        value="custom"
                        checked={mode === 'custom'}
                        onChange={() => handleModeChange('custom')}
                    />
                    <span className={styles.modeLabel}>{t('startup.customImages', 'Use custom images')}</span>
                    <span className={styles.modeDescription}>
                        {t('startup.customImagesDescription', 'Show your own photos on startup (add from photo selection)')}
                    </span>
                </label>
                <label className={styles.modeOption}>
                    <input
                        type="radio"
                        name="startupImageMode"
                        value="memories"
                        checked={mode === 'memories'}
                        onChange={() => handleModeChange('memories')}
                    />
                    <span className={styles.modeLabel}>{t('startup.onThisDay', 'On This Day memories')}</span>
                    <span className={styles.modeDescription}>
                        {t('startup.onThisDayDescription', 'Show photos from same day in previous years')}
                    </span>
                </label>
            </div>

            {/* Custom Images List */}
            {mode === 'custom' && (
                <div className={styles.customImagesList}>
                    <div className={styles.listHeader}>
                        <h4>Custom Startup Images</h4>
                        {images.length > 0 && (
                            <span className={styles.imageCount}>
                                {enabledCount} of {images.length} enabled
                            </span>
                        )}
                    </div>

                    {images.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>No custom images added yet.</p>
                            <p className={styles.emptyHint}>
                                Select photos in the photo list and use "Add to Startup Images" from the operations menu.
                            </p>
                        </div>
                    ) : (
                        <div className={styles.imageList}>
                            {sortedImages.map((image) => (
                                <div key={image.path} className={classNames(styles.imageItem, { [styles.disabled]: !image.enabled })}>
                                    <div className={styles.imagePreview}>
                                        <img
                                            src={convertFileSrc(image.path)}
                                            alt={getDisplayName(image.path)}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <div className={styles.imageInfo}>
                                        <span className={styles.imageName} title={image.path}>
                                            {getDisplayName(image.path)}
                                        </span>
                                        {image.photo_date && (
                                            <span className={styles.imageDate}>
                                                {formatDate(image.photo_date)}
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.imageActions}>
                                        <label className={styles.enableToggle} title={image.enabled ? 'Disable' : 'Enable'}>
                                            <input
                                                type="checkbox"
                                                checked={image.enabled}
                                                onChange={() => handleToggleEnabled(image.path)}
                                            />
                                            <span className={styles.toggleSlider}></span>
                                        </label>
                                        <button
                                            className={styles.removeButton}
                                            onClick={() => handleRemoveImage(image.path)}
                                            title="Remove from startup images"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {enabledCount === 0 && images.length > 0 && (
                        <div className={styles.warningMessage}>
                            {t('startup.noImagesEnabled', 'No images enabled. Default images will be shown on startup.')}
                        </div>
                    )}
                </div>
            )}

            {/* Memories Mode Settings */}
            {mode === 'memories' && (
                <div className={styles.memoriesSection}>
                    <div className={styles.memoriesSettings}>
                        <label className={styles.checkboxOption}>
                            <input
                                type="checkbox"
                                checked={showMemoriesOnHome}
                                onChange={handleShowMemoriesOnHomeChange}
                            />
                            <span>{t('startup.showOnHome', 'Show "On This Day" section on Home screen')}</span>
                        </label>

                        <div className={styles.fallbackSection}>
                            <span className={styles.fallbackLabel}>
                                {t('startup.fallbackLabel', 'If no memories for today:')}
                            </span>
                            <div className={styles.fallbackOptions}>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="memoriesFallback"
                                        value="default"
                                        checked={memoriesFallback === 'default'}
                                        onChange={() => handleMemoriesFallbackChange('default')}
                                    />
                                    <span>{t('startup.fallbackDefault', 'Use default images')}</span>
                                </label>
                                <label className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="memoriesFallback"
                                        value="custom"
                                        checked={memoriesFallback === 'custom'}
                                        onChange={() => handleMemoriesFallbackChange('custom')}
                                        disabled={images.filter(img => img.enabled).length === 0}
                                    />
                                    <span>{t('startup.fallbackCustom', 'Use custom images')}</span>
                                    {images.filter(img => img.enabled).length === 0 && (
                                        <span className={styles.fallbackHint}>
                                            {t('startup.fallbackCustomDisabled', '(no custom images added)')}
                                        </span>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className={styles.memoriesPreview}>
                        <h4>{t('startup.todaysMemories', "Today's Memories")}</h4>
                        {memoriesLoading ? (
                            <div className={styles.loadingState}>
                                {t('common.loading', 'Loading...')}
                            </div>
                        ) : memoriesPreview.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>{t('startup.noMemories', 'No memories found for today.')}</p>
                                <p className={styles.emptyHint}>
                                    {t('startup.noMemoriesHint', 'Photos from the same date in previous years will appear here.')}
                                </p>
                            </div>
                        ) : (
                            <div className={styles.memoriesGroups}>
                                {memoriesPreview.map((group) => (
                                    <div key={group.year} className={styles.memoriesGroup}>
                                        <div className={styles.memoriesGroupHeader}>
                                            {group.years_ago === 1
                                                ? t('startup.yearsAgoSingular', '1 year ago')
                                                : t('startup.yearsAgoPlural', '{{count}} years ago', { count: group.years_ago })}
                                            <span className={styles.memoriesYear}>({group.year})</span>
                                        </div>
                                        <div className={styles.memoriesThumbnails}>
                                            {group.photos.slice(0, 4).map((photo) => (
                                                <div key={photo.file.path} className={styles.memoryThumbnail}>
                                                    <img
                                                        src={convertFileSrc(photo.file.path)}
                                                        alt=""
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                            {group.photos.length > 4 && (
                                                <div className={styles.memoriesMore}>
                                                    +{group.photos.length - 4}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StartupImageManager;
