import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUI } from '../../context/UIContext.jsx';
import { VIEW_MODES, supportsBurstGrouping } from '../../constants/viewModes.js';
import styles from './PhotosToolbar.module.css';

/**
 * PhotosToolbar Component
 * Extracted from PhotosList.jsx to reduce component complexity
 * Handles icon size, sorting, and filter controls
 */
function PhotosToolbar({
    iconSize,
    setIconSize,
    sortOfPhotos,
    setSort,
    showFilterPopover,
    setShowFilterPopover,
    filterButtonRef,
    starFilter,
    hasCommentFilter,
    hasTagFilter,
    extensionFilter,
    hasActiveFilters,
    onStartSlideshow,
    photosCount = 0
}) {
    const { t } = useTranslation('common');
    // Determine mode from viewMode
    const { viewMode, burstModeEnabled, toggleBurstMode } = useUI();
    const isImportMode = viewMode === VIEW_MODES.IMPORT;
    const showBurstToggle = supportsBurstGrouping(viewMode);

    // Calculate active filter count (mode-aware)
    const activeFilterCount = isImportMode
        ? [extensionFilter !== "all"].filter(Boolean).length  // Import mode: only extension filter
        : [starFilter > 0, hasCommentFilter, hasTagFilter, extensionFilter !== "all"].filter(Boolean).length;  // Normal mode: all filters

    return (
        <div className="photo-operation">
            {showBurstToggle && (
                <button
                    className={burstModeEnabled ? styles.burstButtonActive : styles.burstButton}
                    onClick={toggleBurstMode}
                    title={burstModeEnabled ? t('toolbar.burstShowAll') : t('toolbar.burstGroup')}
                >
                    {burstModeEnabled ? t('toolbar.burstOn') : t('toolbar.burst')}
                </button>
            )}
            {t('toolbar.icon')}:<select
                name="icon_size"
                value={iconSize}
                onChange={(e) => setIconSize(parseInt(e.target.value))}
            >
                <option value={50}>{t('toolbar.iconSmall')}</option>
                <option value={100}>{t('toolbar.iconNormal')}</option>
                <option value={200}>{t('toolbar.iconLarge')}</option>
                <option value={300}>{t('toolbar.iconHuge')}</option>
            </select>

            {t('button.sort')}:<select
                name="sort"
                value={sortOfPhotos}
                onChange={(e) => setSort(parseInt(e.target.value))}
            >
                {!isImportMode && <option value={0}>{t('toolbar.sortShotTimeDesc')}</option>}
                {!isImportMode && <option value={1}>{t('toolbar.sortShotTimeAsc')}</option>}
                <option value={2}>{t('toolbar.sortAddedTimeDesc')}</option>
                <option value={3}>{t('toolbar.sortAddedTimeAsc')}</option>
                {!isImportMode && <option value={4}>{t('toolbar.sortStarDesc')}</option>}
                {!isImportMode && <option value={5}>{t('toolbar.sortStarAsc')}</option>}
                <option value={6}>{t('toolbar.sortFileNameDesc')}</option>
                <option value={7}>{t('toolbar.sortFileNameAsc')}</option>
            </select>

            <button
                ref={filterButtonRef}
                onClick={() => setShowFilterPopover(!showFilterPopover)}
                className={hasActiveFilters ? styles.filterButtonActive : styles.filterButton}
                title={t('toolbar.filterPhotos')}
            >
                <span className={styles.filterIcon}>⚙️</span>
                {t('button.filter')}
                {hasActiveFilters && (
                    <span className={styles.filterBadge}>
                        {activeFilterCount}
                    </span>
                )}
            </button>

            {!isImportMode && photosCount > 0 && onStartSlideshow && (
                <button
                    onClick={onStartSlideshow}
                    className={styles.slideshowIconButton}
                    title={t('toolbar.slideshow') + ' (F5)'}
                >
                    📽
                </button>
            )}
            {/* Num selector removed - not needed with infinite scroll */}
        </div>
    );
}

export default PhotosToolbar;