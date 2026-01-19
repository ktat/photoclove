import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';
import { useError } from '../context/ErrorContext.jsx';
import { unifiedCollectionService } from '../services/UnifiedCollectionService.js';
import TagInput from './TagInput.jsx';
import styles from './CollectionSelectorModal.module.css';

/**
 * Unified modal for selecting albums or tags.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Called when modal is closed
 * @param {Function} props.onConfirm - Called with selected ID(s) when confirmed
 * @param {number} props.selectedPhotosCount - Number of photos being affected
 * @param {'album' | 'tag'} props.collectionType - Type of collection to select
 * @param {'single' | 'multiple'} props.selectionMode - Single or multi-select mode
 * @param {boolean} props.allowCreate - Whether to show create new item section (tags only)
 */
const CollectionSelectorModal = ({
  isOpen,
  onClose,
  onConfirm,
  selectedPhotosCount = 0,
  collectionType = 'album',
  selectionMode = 'single',
  allowCreate = false
}) => {
  const { handleTauriError } = useError();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAlbum = collectionType === 'album';
  const isMultiSelect = selectionMode === 'multiple';

  // UI labels based on collection type
  const labels = {
    title: isAlbum ? 'Add to Album' : 'Add Tags',
    subtitle: isAlbum
      ? `Add ${selectedPhotosCount} photo${selectedPhotosCount !== 1 ? 's' : ''} to an existing album`
      : `Add tags to ${selectedPhotosCount} photo${selectedPhotosCount !== 1 ? 's' : ''}`,
    searchPlaceholder: isAlbum ? 'Search albums...' : 'Search tags...',
    emptyMessage: isAlbum ? 'No albums found' : 'No tags found',
    emptySearchMessage: isAlbum ? 'No albums match your search' : 'No tags match your search',
    loadingMessage: isAlbum ? 'Loading albums...' : 'Loading tags...',
    confirmButton: isAlbum
      ? 'Add to Album'
      : `Add Tags to ${selectedPhotosCount} Photo${selectedPhotosCount !== 1 ? 's' : ''}`,
    confirmingButton: isAlbum ? 'Adding...' : 'Adding...',
    selectedLabel: 'Selected Tags'
  };

  const loadItems = async () => {
    setIsLoading(true);
    try {
      logger.info('CollectionSelectorModal', 'load_items_start', `Loading ${collectionType}s for selection`, {
        collectionType,
        selectedPhotosCount
      });

      const itemList = isAlbum
        ? await unifiedCollectionService.getAlbums()
        : await unifiedCollectionService.getTags();

      // Filter out invalid entries
      const processedItems = (Array.isArray(itemList) ? itemList : [])
        .filter(item => item && item.id != null && item.name != null);

      setItems(processedItems);
      setFilteredItems(processedItems);
      logger.info('CollectionSelectorModal', 'load_items_complete', `${collectionType}s loaded successfully`, {
        count: processedItems.length
      });
    } catch (error) {
      logger.error('CollectionSelectorModal', 'load_items_failed', `Failed to load ${collectionType}s`, {
        error: error.message
      });
      handleTauriError(error, `Load ${collectionType}s`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadItems();
      setSearchTerm('');
      setSelectedIds([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = items.filter(item =>
      item && item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredItems(filtered);
  }, [searchTerm, items]);

  const handleItemToggle = (itemId) => {
    if (isMultiSelect) {
      setSelectedIds(prev =>
        prev.includes(itemId)
          ? prev.filter(id => id !== itemId)
          : [...prev, itemId]
      );
    } else {
      setSelectedIds([itemId]);
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const selectedNames = selectedIds.map(id => {
        const item = items.find(i => i.id === id);
        return item?.name || 'Unknown';
      }).join(', ');

      logger.info('CollectionSelectorModal', 'submit_start', `Adding to ${collectionType}`, {
        selectedIds,
        selectedNames,
        photoCount: selectedPhotosCount
      });

      // Return single ID for single select, array for multi-select
      const result = isMultiSelect ? selectedIds : selectedIds[0];
      await onConfirm(result);

      logger.info('CollectionSelectorModal', 'submit_complete', `Added to ${collectionType} successfully`, {
        selectedIds,
        photoCount: selectedPhotosCount
      });
    } catch (error) {
      logger.error('CollectionSelectorModal', 'submit_failed', `Failed to add to ${collectionType}`, {
        selectedIds,
        error: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemCreated = (newItem) => {
    if (!newItem || !newItem.id || !newItem.name) {
      logger.warn('CollectionSelectorModal', 'invalid_item_created', 'Invalid item data received', { newItem });
      return;
    }
    setItems(prev => [...prev, newItem]);
    setSelectedIds(prev => [...prev, newItem.id]);
    logger.info('CollectionSelectorModal', 'item_created_and_selected', 'New item created and selected', {
      id: newItem.id,
      name: newItem.name
    });
  };

  const handleClose = () => {
    if (!isSubmitting) {
      logger.debug('CollectionSelectorModal', 'modal_closed', 'Modal closed by user');
      onClose();
    }
  };

  if (!isOpen) return null;

  const selectedItems = items.filter(item => item && item.id && selectedIds.includes(item.id));
  const hasSelection = selectedIds.length > 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h2 className={styles.title}>{labels.title}</h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className={styles.closeButton}
            >
              x
            </button>
          </div>
          <p className={styles.subtitle}>{labels.subtitle}</p>
        </div>

        {/* Selected Items Display (multi-select only) */}
        {isMultiSelect && selectedItems.length > 0 && (
          <div className={styles.selectedSection}>
            <div className={styles.selectedLabel}>
              {labels.selectedLabel} ({selectedItems.length}):
            </div>
            <div className={styles.selectedChips}>
              {selectedItems.map(item => (
                <span key={item.id} className={styles.selectedChip}>
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className={styles.searchSection}>
          <input
            type="text"
            placeholder={labels.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isSubmitting}
            className={styles.searchInput}
          />
        </div>

        {/* Item List */}
        <div className={styles.listContainer}>
          {isLoading ? (
            <div className={styles.emptyState}>{labels.loadingMessage}</div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              {searchTerm ? labels.emptySearchMessage : labels.emptyMessage}
            </div>
          ) : isMultiSelect ? (
            // Multi-select: horizontal chip layout with checkboxes
            <div className={styles.chipGrid}>
              {filteredItems.map(item => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`${styles.chipItem} ${isSelected ? styles.chipItemSelected : ''}`}
                    style={{ opacity: isSubmitting ? 0.6 : 1 }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => !isSubmitting && handleItemToggle(item.id)}
                      disabled={isSubmitting}
                      className={styles.checkbox}
                    />
                    <span>{item.name} ({item.photoCount || 0})</span>
                  </label>
                );
              })}
            </div>
          ) : (
            // Single-select: vertical list layout
            filteredItems.map(item => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => !isSubmitting && handleItemToggle(item.id)}
                  className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''}`}
                  style={{ opacity: isSubmitting ? 0.6 : 1 }}
                >
                  <div className={styles.listItemName}>{item.name}</div>
                  <div className={styles.listItemMeta}>
                    {item.photoCount || 0} photos
                    {item.description && (
                      <span className={styles.listItemDescription}> - {item.description}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create New Item Section (tags only) */}
        {allowCreate && (
          <div className={styles.createSection}>
            <div className={styles.createLabel}>Or Create New Tag:</div>
            <TagInput onTagCreated={handleItemCreated} placeholder="New tag name..." />
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className={styles.cancelButton}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasSelection || isSubmitting}
            className={styles.confirmButton}
          >
            {isSubmitting ? labels.confirmingButton : labels.confirmButton}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectionSelectorModal;
