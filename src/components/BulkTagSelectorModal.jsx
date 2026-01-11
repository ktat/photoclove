import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';
import { useError } from '../context/ErrorContext.jsx';
import TagChip from './TagChip.jsx';
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
      const tagsResult = await invoke('get_photos_unified', {
        request: {
          type: 'search',
          search_type: 'all_tags'
        }
      });
      const tagList = JSON.parse(tagsResult);

      // Convert tuple format to object format: [id, name, color, photo_count]
      // Filter out invalid entries
      const processedTags = (Array.isArray(tagList) ? tagList : [])
        .filter(tag => Array.isArray(tag) && tag[0] && tag[1]) // Ensure valid tag with id and name
        .map(tag => ({
          id: tag[0],
          name: tag[1],
          color: tag[2] || null,
          photo_count: tag[3] || 0
        }));

      setTags(processedTags);
      setFilteredTags(processedTags);
      logger.info('BulkTagSelectorModal', 'load_tags_complete', 'Tags loaded successfully', { tagCount: processedTags.length });
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
        backgroundColor: 'var(--bg-elevated)',
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
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--text)' }}>Add Tags</h2>
            <button
              onClick={handleClose}
              disabled={isAdding}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: isAdding ? 'not-allowed' : 'pointer',
                color: 'var(--text)',
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
          <p style={{ margin: 0, color: 'var(--text)', fontSize: '14px' }}>
            Add tags to {selectedPhotosCount} photo{selectedPhotosCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Selected Tags Display */}
        {selectedTags.length > 0 && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: 'var(--bg)',
            borderRadius: '4px',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              fontSize: '12px',
              color: 'var(--text)',
              marginBottom: '8px',
              fontWeight: 'bold'
            }}>
              Selected Tags ({selectedTags.length}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selectedTags.map(tag => (
                <TagChip key={tag.id} tag={tag} />
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
              border: '1px solid var(--border)',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text)'
            }}
          />
        </div>

        {/* Tag List with Checkboxes */}
        <div style={{
          flex: 1,
          maxHeight: '250px',
          overflowY: 'auto',
          marginBottom: '16px',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          backgroundColor: 'var(--bg)'
        }}>
          {isLoading ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text)',
              fontSize: '14px'
            }}>
              Loading tags...
            </div>
          ) : filteredTags.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text)',
              fontSize: '14px'
            }}>
              {searchTerm ? 'No tags match your search' : 'No tags found'}
            </div>
          ) : (
            filteredTags.map(tag => (
              <div
                key={tag.id}
                onClick={() => !isAdding && handleTagToggle(tag.id)}
                style={{
                  padding: '12px',
                  cursor: isAdding ? 'not-allowed' : 'pointer',
                  backgroundColor: selectedTagIds.includes(tag.id) ? 'rgba(33, 150, 243, 0.2)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background-color 0.2s',
                  opacity: isAdding ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={(e) => {
                  if (!isAdding && !selectedTagIds.includes(tag.id)) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAdding && !selectedTagIds.includes(tag.id)) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => {}} // Handled by parent div onClick
                  disabled={isAdding}
                  style={{
                    cursor: isAdding ? 'not-allowed' : 'pointer',
                    width: '16px',
                    height: '16px'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    marginBottom: '4px',
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <TagChip tag={tag} />
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text)'
                  }}>
                    📸 {tag.photo_count || 0} photos
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create New Tag Section */}
        <div style={{
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: 'var(--bg)',
          borderRadius: '4px',
          border: '1px solid var(--border)'
        }}>
          <div style={{
            fontSize: '12px',
            color: 'var(--text)',
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
              border: '1px solid var(--border)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text)',
              cursor: isAdding ? 'not-allowed' : 'pointer',
              fontSize: '14px',
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
              backgroundColor: (selectedTagIds.length === 0 || isAdding) ? '#ccc' : '#2196F3',
              color: 'white',
              cursor: (selectedTagIds.length === 0 || isAdding) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
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
