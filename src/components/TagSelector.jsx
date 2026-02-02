import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { UnifiedPhotoCollection } from '../domain/UnifiedPhotoCollection.js';
import { logger } from '../services/LoggerService.js';
import TagInput from './TagInput.jsx';
import styles from './TagSelector.module.css';

/**
 * Check if a tag is an AI-generated tag
 */
const isAITag = (tagName) => tagName?.startsWith('ai:');

/**
 * Get display name for a tag (removes ai: prefix for cleaner display)
 */
const getTagDisplayName = (tagName) => {
    if (isAITag(tagName)) {
        return tagName.substring(3); // Remove 'ai:' prefix
    }
    return tagName;
};

const TagSelector = ({ photoPath, selectedTags = [], onTagsChange }) => {
    const [allTags, setAllTags] = useState([]);
    const [filteredTags, setFilteredTags] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        loadAllTags();
    }, []);

    useEffect(() => {
        filterTags();
    }, [allTags, searchTerm, selectedTags]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadAllTags = async () => {
        try {
            const tags = await UnifiedPhotoCollection.getAllTags();
            setAllTags(tags);
            logger.info('TagSelector', 'tags_loaded', 'All tags loaded using unified collections', { count: tags.length });
        } catch (error) {
            logger.error('TagSelector', 'load_tags_error', 'Failed to load tags', { error: error.toString() });
        }
    };

    const filterTags = () => {
        let filtered = allTags.filter(tag => 
            tag.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !selectedTags.some(selectedTag => selectedTag.id === tag.id)
        );
        setFilteredTags(filtered);
    };

    const handleTagSelect = async (tag) => {
        if (!photoPath) {
            // Just update local state if no photo path
            const newSelectedTags = [...selectedTags, tag];
            onTagsChange?.(newSelectedTags);
            setSearchTerm('');
            setIsDropdownOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            // Find the tag collection and add photo to it
            const tagCollection = new UnifiedPhotoCollection({
                id: tag.id,
                type: 'tag',
                name: tag.name,
                color: tag.color
            });
            await tagCollection.addPhoto(photoPath);

            const newSelectedTags = [...selectedTags, tag];
            onTagsChange?.(newSelectedTags);
            
            logger.info('TagSelector', 'tag_added', 'Tag added to photo using unified collection', { 
                tagId: tag.id, 
                tagName: tag.name,
                photoPath 
            });

            setSearchTerm('');
            setIsDropdownOpen(false);
        } catch (error) {
            logger.error('TagSelector', 'add_tag_error', 'Failed to add tag to photo', { 
                error: error.toString() 
            });
            alert('Failed to add tag: ' + error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTagRemove = async (tagId) => {
        if (!photoPath) {
            // Just update local state if no photo path
            const newSelectedTags = selectedTags.filter(tag => tag.id !== tagId);
            onTagsChange?.(newSelectedTags);
            return;
        }

        setIsLoading(true);
        try {
            // Find the tag in allTags to get its full data
            const tag = allTags.find(t => t.id === tagId) || { id: tagId, type: 'tag' };
            const tagCollection = new UnifiedPhotoCollection({
                ...tag,
                type: 'tag'
            });
            await tagCollection.removePhoto(photoPath);

            const newSelectedTags = selectedTags.filter(tag => tag.id !== tagId);
            onTagsChange?.(newSelectedTags);
            
            logger.info('TagSelector', 'tag_removed', 'Tag removed from photo using unified collection', { 
                tagId, 
                photoPath 
            });
        } catch (error) {
            logger.error('TagSelector', 'remove_tag_error', 'Failed to remove tag from photo', { 
                error: error.toString() 
            });
            alert('Failed to remove tag: ' + error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTagCreated = (newTag) => {
        setAllTags(prev => [...prev, newTag]);
        handleTagSelect(newTag);
    };

    const handleDropdownToggle = () => {
        setIsDropdownOpen(!isDropdownOpen);
        if (!isDropdownOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    };

    return (
        <div className={styles.tagSelector}>
            {/* Selected Tags */}
            <div className={styles.selectedTags} style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                alignItems: 'center'
            }}>
                {selectedTags.map(tag => {
                    const isAI = isAITag(tag.name);
                    const displayName = getTagDisplayName(tag.name);

                    return (
                        <span
                            key={tag.id}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                padding: '6px 12px',
                                backgroundColor: isAI ? 'var(--color-bg-surface)' : 'var(--color-primary-selected)',
                                border: isAI ? '1px solid var(--color-warning)' : '1px solid var(--color-primary)',
                                borderRadius: 'var(--radius-xl)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-primary)',
                                whiteSpace: 'nowrap'
                            }}
                            title={isAI && tag.confidence ? `AI confidence: ${tag.confidence}%` : undefined}
                        >
                            {isAI && (
                                <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>🤖</span>
                            )}
                            <span>{displayName}</span>
                            {isAI && tag.confidence && (
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '1px 4px',
                                    backgroundColor: 'var(--color-bg-muted)',
                                    borderRadius: 'var(--radius-lg)',
                                    color: 'var(--color-text-muted)'
                                }}>
                                    {tag.confidence}%
                                </span>
                            )}
                            <button
                                onClick={() => handleTagRemove(tag.id)}
                                disabled={isLoading}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-text-primary)',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    padding: '0 0 0 4px',
                                    fontSize: 'var(--font-size-lg)',
                                    lineHeight: '1',
                                    opacity: isLoading ? 0.5 : 0.7
                                }}
                                title="Remove tag"
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = isLoading ? '0.5' : '0.7'}
                            >
                                ×
                            </button>
                        </span>
                    );
                })}

                <button
                    className={styles.addTagButton}
                    onClick={handleDropdownToggle}
                    disabled={isLoading}
                    title="Add tag"
                    style={{
                        padding: '6px 12px',
                        backgroundColor: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-xl)',
                        color: 'var(--color-text-primary)',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'bold',
                        opacity: isLoading ? 0.6 : 1
                    }}
                >
                    {isLoading ? '...' : '+'}
                </button>
            </div>

            {/* Dropdown */}
            {isDropdownOpen && (
                <div className={styles.tagDropdown} ref={dropdownRef}>
                    <div className={styles.tagSearch}>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search tags..."
                            className={styles.tagSearchInput}
                        />
                    </div>

                    <div className={styles.tagOptions}>
                        {filteredTags.length > 0 ? (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 'var(--space-2)',
                                padding: 'var(--space-1)'
                            }}>
                                {filteredTags.map(tag => {
                                    const isAI = isAITag(tag.name);
                                    const displayName = getTagDisplayName(tag.name);

                                    return (
                                        <button
                                            key={tag.id}
                                            className={styles.tagOptionPill}
                                            onClick={() => handleTagSelect(tag)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-2)',
                                                padding: '6px 12px',
                                                cursor: 'pointer',
                                                backgroundColor: 'var(--color-bg-elevated)',
                                                border: isAI ? '1px solid var(--color-warning)' : '1px solid var(--color-border-default)',
                                                borderRadius: 'var(--radius-xl)',
                                                transition: 'all 0.2s',
                                                fontSize: 'var(--font-size-sm)',
                                                color: 'var(--color-text-primary)',
                                                whiteSpace: 'nowrap'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-muted)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                                            }}
                                        >
                                            {isAI && <span style={{ fontSize: 'var(--font-size-xs)' }}>🤖</span>}
                                            {displayName} ({tag.photoCount || 0})
                                        </button>
                                    );
                                })}
                            </div>
                        ) : searchTerm ? (
                            <div className={styles.tagNoResults}>
                                No tags found for "{searchTerm}"
                            </div>
                        ) : (
                            <div className={styles.tagNoResults}>
                                All tags are already selected
                            </div>
                        )}
                    </div>

                    <div className={styles.tagCreateSection}>
                        <div className={styles.tagCreateDivider}>or create new tag</div>
                        <TagInput onTagCreated={handleTagCreated} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TagSelector;