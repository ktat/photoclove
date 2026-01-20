import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../services/LoggerService.js';
import TagSelector from '../../../components/TagSelector.jsx';
import styles from './PhotoTags.module.css';

/**
 * Check if a tag is an AI-generated tag
 */
const isAITag = (tagName) => tagName?.startsWith('ai:');

/**
 * Parse confidence from tag metadata
 */
const parseConfidence = (metadata) => {
    if (!metadata) return null;
    try {
        const parsed = JSON.parse(metadata);
        return parsed.confidence ? Math.round(parsed.confidence * 100) : null;
    } catch {
        return null;
    }
};

function PhotoTags({ currentPhotoPath, addFooterMessage, onPhotosRefresh }) {
    const [photoTags, setPhotoTags] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

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
            addFooterMessage?.('Failed to load photo tags');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTagsChange = async (newTags) => {
        setPhotoTags(newTags);
        addFooterMessage?.(`Photo tags updated (${newTags.length} tags)`);

        // Note: No need to refresh photos list in PhotoViewer mode
        // Grid view will be updated when user returns to grid or uses bulk tag operations
        logger.info('PhotoTags', 'tags_updated', 'Photo tags updated in viewer', {
            photoPath: currentPhotoPath,
            tagCount: newTags.length
        });
    };

    if (isLoading) {
        return (
            <div className={styles['photo-tags-container']}>
                <div className={styles['photo-tags-header']}>
                    <h3>Photo Tags</h3>
                </div>
                <div className={styles['photo-tags-loading']}>Loading tags...</div>
            </div>
        );
    }

    return (
        <div className={styles['photo-tags-container']}>
            <div className={styles['photo-tags-header']}>
                <h3>Photo Tags</h3>
                <p className={styles['photo-tags-description']}>
                    Add tags to organize and categorize your photos.
                    Tags make it easier to find related photos later.
                </p>
            </div>

            <div className={styles['photo-tags-content']}>
                <div className={styles['photo-tags-section']}>
                    <h4>Current Tags ({photoTags.length})</h4>
                    <TagSelector
                        photoPath={currentPhotoPath}
                        selectedTags={photoTags}
                        onTagsChange={handleTagsChange}
                    />
                </div>

                {photoTags.length === 0 && (
                    <div className={styles['photo-tags-empty']}>
                        <p>No tags assigned to this photo yet.</p>
                        <p>Click the + button above to add your first tag!</p>
                    </div>
                )}

                <div className={styles['photo-tags-tips']}>
                    <h4>Tips</h4>
                    <ul>
                        <li>Use descriptive tags like "vacation", "family", or "nature"</li>
                        <li>Create color-coded tags for different categories</li>
                        <li>Tags are shared across all photos in your library</li>
                        <li>You can search for photos by tag using the search feature</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default PhotoTags;