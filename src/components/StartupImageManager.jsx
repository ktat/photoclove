import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import classNames from 'classnames';
import { logger } from '../services/LoggerService.js';
import styles from './StartupImageManager.module.css';

/**
 * StartupImageManager Component
 *
 * Manages custom startup/splash images for the application.
 * Users can add photos from their library to display on startup,
 * enable/disable individual images, or switch between default and custom modes.
 */
const StartupImageManager = ({ config, setConfig }) => {
    // Get startup images config with defaults
    const startupImages = config?.startup_images || { mode: 'default', images: [] };
    const mode = startupImages.mode || 'default';
    const images = startupImages.images || [];

    // Sort images by photo_date descending (newest first)
    const sortedImages = [...images].sort((a, b) => {
        return (b.photo_date || '').localeCompare(a.photo_date || '');
    });

    const enabledCount = images.filter(img => img.enabled).length;

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
                    <span className={styles.modeLabel}>Use default images</span>
                    <span className={styles.modeDescription}>
                        Show built-in landscape photos on startup
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
                    <span className={styles.modeLabel}>Use custom images</span>
                    <span className={styles.modeDescription}>
                        Show your own photos on startup (add from photo selection)
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
                            No images enabled. Default images will be shown on startup.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StartupImageManager;
