import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../services/LoggerService.js';
import { invokeWithErrorHandling } from '../../../services/TauriService.js';
import TagSelector from '../../../components/TagSelector.jsx';
import styles from './PhotoTags.module.css';

/**
 * Check if a tag is an AI-generated tag
 */
const isAITag = (tagName) => tagName?.startsWith('ai:');

/**
 * Threshold ranges per model (same as AITaggingTab.jsx)
 */
const MODEL_THRESHOLD_RANGES = {
    mobilenet: { min: 0.05, max: 0.35 },
    openclip: { min: 0.15, max: 0.40 },
    siglip: { min: 0.15, max: 0.35 }
};

/**
 * Parse confidence from tag metadata and normalize to 0-100% scale
 */
const parseConfidence = (metadata) => {
    if (!metadata) return null;
    try {
        const parsed = JSON.parse(metadata);
        if (!parsed.confidence) return null;
        const raw = parsed.confidence;
        const model = (parsed.model || '').toLowerCase();
        const range = model.includes('siglip') ? MODEL_THRESHOLD_RANGES.siglip
            : model.includes('openclip') || model.includes('clip') ? MODEL_THRESHOLD_RANGES.openclip
            : MODEL_THRESHOLD_RANGES.mobilenet;
        const normalized = Math.round(((raw - range.min) / (range.max - range.min)) * 100);
        return Math.min(100, Math.max(0, normalized));
    } catch {
        return null;
    }
};

function PhotoTags({ currentPhoto, addFooterMessage, onPhotosRefresh }) {
    const { t } = useTranslation('common');
    const currentPhotoPath = currentPhoto?.originalPath;
    const isRaw = currentPhoto?.isRawFormat?.() ?? false;
    const [photoTags, setPhotoTags] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAiTagging, setIsAiTagging] = useState(false);
    const [useFullImage, setUseFullImage] = useState(false);

    // Reset useFullImage when switching to a RAW file
    useEffect(() => {
        if (isRaw) {
            setUseFullImage(false);
        }
    }, [isRaw]);

    useEffect(() => {
        if (currentPhotoPath) {
            loadPhotoTags();
        }
    }, [currentPhotoPath]);

    const loadPhotoTags = async () => {
        if (!currentPhotoPath) return;

        setIsLoading(true);
        try {
            // Use the new command that includes metadata for AI tags
            const tags = await invoke('get_tags_for_photo_with_metadata', {
                photoPath: currentPhotoPath
            });

            const formattedTags = tags.map(([id, name, color, metadata]) => ({
                id,
                name,
                color,
                metadata,
                isAI: isAITag(name),
                confidence: parseConfidence(metadata)
            }));
            setPhotoTags(formattedTags);

            logger.info('PhotoTags', 'tags_loaded', 'Photo tags loaded', {
                photoPath: currentPhotoPath,
                tagCount: formattedTags.length,
                aiTagCount: formattedTags.filter(t => t.isAI).length
            });
        } catch (error) {
            logger.error('PhotoTags', 'load_tags_error', 'Failed to load photo tags', {
                photoPath: currentPhotoPath,
                error: error.toString()
            });
            addFooterMessage?.(t('photoTags.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleTagsChange = async (newTags) => {
        setPhotoTags(newTags);
        addFooterMessage?.(t('photoTags.tagsUpdated', { count: newTags.length }));

        // Note: No need to refresh photos list in PhotoViewer mode
        // Grid view will be updated when user returns to grid or uses bulk tag operations
        logger.info('PhotoTags', 'tags_updated', 'Photo tags updated in viewer', {
            photoPath: currentPhotoPath,
            tagCount: newTags.length
        });
    };

    const handleAiTagging = async () => {
        if (!currentPhotoPath || isAiTagging) return;

        setIsAiTagging(true);
        logger.info('PhotoTags', 'ai_tagging_start', 'Starting AI tagging for photo', { photoPath: currentPhotoPath });

        // Wait for UI to update before starting heavy processing
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const result = await invokeWithErrorHandling(
                'run_ai_tagging_for_photo',
                { photoPath: currentPhotoPath, useFullImage },
                'PhotoTags',
                { parseJson: true }
            );

            if (result.success) {
                // Reload tags to show newly added AI tags
                await loadPhotoTags();
                addFooterMessage?.(t('photoTags.aiTaggingAdded', { count: result.count }));
                logger.info('PhotoTags', 'ai_tagging_complete', 'AI tagging completed', {
                    photoPath: currentPhotoPath,
                    tagCount: result.count
                });
            }
        } catch (error) {
            const errorMsg = error.toString();
            logger.error('PhotoTags', 'ai_tagging_error', 'AI tagging failed', {
                photoPath: currentPhotoPath,
                error: errorMsg
            });

            // Check if AI tagging is disabled
            if (errorMsg.includes('AI tagging is disabled')) {
                window.alert(
                    t('photoTags.aiTaggingDisabledTitle') + '\n\n' +
                    t('photoTags.aiTaggingDisabledMessage')
                );
            } else {
                addFooterMessage?.(t('photoTags.aiTaggingFailed', { error: error.toString() }));
            }
        } finally {
            setIsAiTagging(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles['photo-tags-container']}>
                <div className={styles['photo-tags-header']}>
                    <h3>{t('photoTags.title')}</h3>
                </div>
                <div className={styles['photo-tags-loading']}>{t('photoTags.loadingTags')}</div>
            </div>
        );
    }

    return (
        <div className={styles['photo-tags-container']}>
            <div className={styles['photo-tags-header']}>
                <h3>{t('photoTags.title')}</h3>
                <p className={styles['photo-tags-description']}>
                    {t('photoTags.description')}
                </p>
            </div>

            <div className={styles['photo-tags-content']}>
                {/* AI Tagging Button */}
                <div className={styles['photo-tags-section']}>
                    <div className={styles['ai-tagging-actions']}>
                        <button
                            className={`${styles['ai-tagging-button']} ${isAiTagging ? styles['running'] : ''}`}
                            onClick={handleAiTagging}
                            disabled={isAiTagging}
                        >
                            {isAiTagging ? `⏳ ${t('photoTags.runningAiTagging')}` : t('photoTags.runAiTagging')}
                        </button>
                        {/* Use Full Image option */}
                        <label
                            className={styles['use-full-image-option']}
                            title={isRaw ? t('aiTagging.highAccuracyRawDisabled') : t('aiTagging.highAccuracyTooltip')}
                        >
                            <input
                                type="checkbox"
                                className={styles['use-full-image-checkbox']}
                                checked={useFullImage}
                                onChange={(e) => setUseFullImage(e.target.checked)}
                                disabled={isAiTagging || isRaw}
                            />
                            <span>{t('aiTagging.highAccuracy')}</span>
                        </label>
                    </div>
                </div>

                <div className={styles['photo-tags-section']}>
                    <h4>{t('photoTags.currentTags', { count: photoTags.length })}</h4>
                    <TagSelector
                        photoPath={currentPhotoPath}
                        selectedTags={photoTags}
                        onTagsChange={handleTagsChange}
                    />
                </div>

                {photoTags.length === 0 && (
                    <div className={styles['photo-tags-empty']}>
                        <p>{t('photoTags.noTags')}</p>
                        <p>{t('photoTags.noTagsHint')}</p>
                    </div>
                )}

                <div className={styles['photo-tags-tips']}>
                    <h4>{t('photoTags.tips')}</h4>
                    <ul>
                        <li>{t('photoTags.tipDescriptive')}</li>
                        <li>{t('photoTags.tipColorCoded')}</li>
                        <li>{t('photoTags.tipShared')}</li>
                        <li>{t('photoTags.tipSearch')}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default PhotoTags;