import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';
import { useError } from '../context/ErrorContext.jsx';
import { UnifiedPhotoCollection } from '../domain/UnifiedPhotoCollection.js';
import TagInput from './TagInput.jsx';
import './BulkTagSelectorModal.css';

const BulkTagSelectorModal = ({ isOpen, onClose, onConfirm, selectedPhotosCount = 0 }) => {
  const { handleTauriError } = useError();
  const [tags, setTags] = useState([]);
  const [filteredTags, setFilteredTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      logger.info('BulkTagSelectorModal', 'load_tags_start', 'Loading tags for bulk selection', { selectedPhotosCount });

      // Use UnifiedPhotoCollection to get all tags (same as TagSelector)
      const tagList = await UnifiedPhotoCollection.getAllTags();

      // Filter out invalid entries
      const processedTags = (Array.isArray(tagList) ? tagList : [])
        .filter(tag => tag && tag.id && tag.name);

      setTags(processedTags);
      setFilteredTags(processedTags);
      logger.info('BulkTagSelectorModal', 'load_tags_complete', 'Tags loaded successfully', {
        tagCount: processedTags.length,
        sampleTag: processedTags[0] // Log first tag to see structure
      });
    } catch (error) {
      logger.error('BulkTagSelectorModal', 'load_tags_failed', 'Failed to load tags', { error: error.message });
      handleTauriError(error, 'Load tags');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTags();
      setSearchTerm('');
      setSelectedTagIds([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = tags.filter(tag =>
      tag && tag.name && tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTags(filtered);
    logger.debug('BulkTagSelectorModal', 'tags_filtered', 'Tags filtered by search term', {
      searchTerm,
      filteredCount: filtered.length,
      totalCount: tags.length
    });
  }, [searchTerm, tags]);

  const handleTagToggle = (tagId) => {
    setSelectedTagIds(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  const handleSubmit = async () => {
    if (selectedTagIds.length === 0) return;

    setIsAdding(true);
    try {
      const selectedTagNames = selectedTagIds.map(id => {
        const tag = tags.find(t => t.id === id);
        return tag?.name || 'Unknown';
      }).join(', ');

      logger.info('BulkTagSelectorModal', 'add_tags_start', 'Adding tags to selected photos', {
        tagIds: selectedTagIds,
        tagNames: selectedTagNames,
        photoCount: selectedPhotosCount
      });

      await onConfirm(selectedTagIds);

      logger.info('BulkTagSelectorModal', 'add_tags_complete', 'Tags added to photos successfully', {
        tagIds: selectedTagIds,
        tagNames: selectedTagNames,
        photoCount: selectedPhotosCount
      });
    } catch (error) {
      logger.error('BulkTagSelectorModal', 'add_tags_failed', 'Failed to add tags to photos', {
        tagIds: selectedTagIds,
        error: error.message
      });
      // Error handling is done in the parent component
    } finally {
      setIsAdding(false);
    }
  };

  const handleTagCreated = (newTag) => {
    if (!newTag || !newTag.id || !newTag.name) {
      logger.warn('BulkTagSelectorModal', 'invalid_tag_created', 'Invalid tag data received', { newTag });
      return;
    }
    setTags(prev => [...prev, newTag]);
    setSelectedTagIds(prev => [...prev, newTag.id]);
    logger.info('BulkTagSelectorModal', 'tag_created_and_selected', 'New tag created and selected for bulk assignment', {
      tagId: newTag.id,
      tagName: newTag.name
    });
  };

  const handleClose = () => {
    if (!isAdding) {
      logger.debug('BulkTagSelectorModal', 'modal_closed', 'Bulk tag selector modal closed by user');
      onClose();
    }
  };

  if (!isOpen) return null;

  const selectedTags = tags.filter(tag => tag && tag.id && selectedTagIds.includes(tag.id));

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '500px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>Add Tags</h2>
            <button
              onClick={handleClose}
              disabled={isAdding}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 'var(--font-size-xl)',
                cursor: isAdding ? 'not-allowed' : 'pointer',
                color: 'var(--color-text-primary)',
                padding: '0',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-base)' }}>
            Add tags to {selectedPhotosCount} photo{selectedPhotosCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Selected Tags Display */}
        {selectedTags.length > 0 && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: 'var(--color-bg-surface)',
            borderRadius: '4px',
            border: '1px solid var(--color-border-default)'
          }}>
            <div style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
              marginBottom: '8px',
              fontWeight: 'bold'
            }}>
              Selected Tags ({selectedTags.length}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selectedTags.map(tag => (
                <span
                  key={tag.id}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: 'var(--color-primary-selected)',
                    border: '1px solid var(--color-primary)',
                    borderRadius: '12px',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isAdding}
            className="tag-search-input"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--color-border-default)',
              borderRadius: '4px',
              fontSize: 'var(--font-size-base)',
              boxSizing: 'border-box',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)'
            }}
          />
        </div>

        {/* Tag List with Checkboxes - Compact horizontal layout */}
        <div style={{
          flex: 1,
          maxHeight: '250px',
          overflowY: 'auto',
          marginBottom: '16px',
          border: '1px solid var(--color-border-default)',
          borderRadius: '4px',
          backgroundColor: 'var(--color-bg-surface)',
          padding: '12px'
        }}>
          {isLoading ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-base)'
            }}>
              Loading tags...
            </div>
          ) : filteredTags.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-base)'
            }}>
              {searchTerm ? 'No tags match your search' : 'No tags found'}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {filteredTags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <label
                    key={tag.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      cursor: isAdding ? 'not-allowed' : 'pointer',
                      backgroundColor: isSelected ? 'var(--color-primary-selected)' : 'var(--color-bg-elevated)',
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border-default)'}`,
                      borderRadius: '16px',
                      transition: 'all 0.2s',
                      opacity: isAdding ? 0.6 : 1,
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-primary)',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isAdding && !isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-muted)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isAdding && !isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => !isAdding && handleTagToggle(tag.id)}
                      disabled={isAdding}
                      style={{
                        cursor: isAdding ? 'not-allowed' : 'pointer',
                        width: '14px',
                        height: '14px',
                        margin: 0
                      }}
                    />
                    <span>{tag.name} ({tag.photoCount || 0})</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Create New Tag Section */}
        <div style={{
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: '4px',
          border: '1px solid var(--color-border-default)'
        }}>
          <div style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
            fontWeight: 'bold'
          }}>
            Or Create New Tag:
          </div>
          <TagInput
            onTagCreated={handleTagCreated}
            placeholder="New tag name..."
          />
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleClose}
            disabled={isAdding}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--color-border-default)',
              borderRadius: '4px',
              backgroundColor: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
              cursor: isAdding ? 'not-allowed' : 'pointer',
              fontSize: 'var(--font-size-base)',
              opacity: isAdding ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedTagIds.length === 0 || isAdding}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: (selectedTagIds.length === 0 || isAdding) ? 'var(--color-bg-muted)' : 'var(--color-primary)',
              color: (selectedTagIds.length === 0 || isAdding) ? 'var(--color-text-muted)' : 'white',
              cursor: (selectedTagIds.length === 0 || isAdding) ? 'not-allowed' : 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'bold'
            }}
          >
            {isAdding ? '🏷️ Adding...' : `🏷️ Add Tags to ${selectedPhotosCount} Photo${selectedPhotosCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkTagSelectorModal;
