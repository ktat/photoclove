import React from "react";
import { useTranslation } from 'react-i18next';
import { logger } from "../../../services/LoggerService.js";

/**
 * FilterTab Component
 *
 * Handles photo filtering operations (star rating, comments, tags, extensions)
 * Extracted from DirectoryMenu.jsx to reduce file size
 *
 * @param {Object} props
 * @param {Object} props.viewModeObj - View mode object with mode checking methods
 * @param {Object} props.filterState - Filter state group
 * @param {number} props.filterState.starFilter - Star rating filter value (0-5)
 * @param {Function} props.filterState.setStarFilter - Setter for star filter
 * @param {boolean} props.filterState.hasCommentFilter - Comment filter enabled state
 * @param {Function} props.filterState.setHasCommentFilter - Setter for comment filter
 * @param {boolean} props.filterState.hasTagFilter - Tag filter enabled state
 * @param {Function} props.filterState.setHasTagFilter - Setter for tag filter
 * @param {string} props.filterState.extensionFilter - File extension filter (comma-separated or "all")
 * @param {Function} props.filterState.setExtensionFilter - Setter for extension filter
 * @param {Object} props.tabClass - Tab CSS classes
 */
function FilterTab({ viewModeObj, filterState, tabClass }) {
    const { t } = useTranslation(['directoryMenu']);
    const {
        starFilter,
        setStarFilter,
        hasCommentFilter,
        setHasCommentFilter,
        hasTagFilter,
        setHasTagFilter,
        extensionFilter,
        setExtensionFilter
    } = filterState;

    return (
        <div id="tab-filter" className={tabClass['filter'] ? "tab-active" : "tab"}>
            <ul>
                <li>
                    {t('directoryMenu:filter.stars')}:
                    {[0, 1, 2, 3, 4, 5].map((v, i) => {
                        return <span key={i} onClick={() => {
                            logger.debug('DirectoryMenu', 'filter_changed', 'User changed star filter', {
                                filterType: 'starFilter',
                                newValue: v,
                                previousValue: starFilter
                            });
                            setStarFilter(v);
                        }}>{starFilter >= v ? " ★" + i : " ☆" + i}</span>
                    })}
                </li>
                <li>
                    <input type="checkbox" value="1" id="filter-has-comment-check"
                        onChange={(e) => {
                            logger.debug('DirectoryMenu', 'filter_changed', 'User changed comment filter', {
                                filterType: 'hasCommentFilter',
                                newValue: e.target.checked,
                                previousValue: hasCommentFilter
                            });
                            setHasCommentFilter(e.target.checked);
                        }}
                    />
                    <label className="checkbox checkbox-normal" htmlFor="filter-has-comment-check">{t('directoryMenu:filter.hasComment')}</label>
                </li>
                <li>
                    {t('directoryMenu:filter.extensions')}:
                    <div style={{ marginTop: '5px' }}>
                        {/* Image Extensions Group */}
                        <div style={{ marginBottom: '10px' }}>
                            <div>
                                <input
                                    type="checkbox"
                                    id="filter-extension-image-group-check"
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');
                                        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];

                                        let newFilters;
                                        if (checked) {
                                            // Add all image extensions
                                            newFilters = [...currentFilters.filter(f => !imageExtensions.includes(f)), ...imageExtensions];
                                        } else {
                                            // Remove all image extensions
                                            newFilters = currentFilters.filter(f => !imageExtensions.includes(f));
                                        }

                                        const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                        setExtensionFilter(filterString);
                                    }}
                                    checked={extensionFilter !== "all" && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].some(ext => extensionFilter.split(',').includes(ext))}
                                />
                                <label className="checkbox checkbox-normal" htmlFor="filter-extension-image-group-check"><strong>{t('directoryMenu:filter.image')}</strong></label>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', marginLeft: '20px' }}>
                                {[
                                    { value: 'jpeg', label: 'jpeg(jpg)', extensions: ['jpg', 'jpeg'] },
                                    { value: 'png', label: 'png', extensions: ['png'] },
                                    { value: 'gif', label: 'gif', extensions: ['gif'] },
                                    { value: 'bmp', label: 'bmp', extensions: ['bmp'] },
                                    { value: 'tiff', label: 'tiff', extensions: ['tiff'] }
                                ].map(item => (
                                    <div key={item.value}>
                                        <input
                                            type="checkbox"
                                            value={item.value}
                                            id={`filter-extension-${item.value}-check`}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');

                                                let newFilters;
                                                if (checked) {
                                                    // Add all extensions for this item
                                                    newFilters = [...currentFilters, ...item.extensions];
                                                } else {
                                                    // Remove all extensions for this item
                                                    newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                                }

                                                const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                                setExtensionFilter(filterString);
                                            }}
                                            checked={extensionFilter !== "all" && item.extensions.some(ext => extensionFilter.split(',').includes(ext))}
                                        />
                                        <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${item.value}-check`}>{item.label}</label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Movie Extensions Group */}
                        <div>
                            <div>
                                <input
                                    type="checkbox"
                                    id="filter-extension-movie-group-check"
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');
                                        const movieExtensions = ['mp4', 'webm'];

                                        let newFilters;
                                        if (checked) {
                                            // Add all movie extensions
                                            newFilters = [...currentFilters.filter(f => !movieExtensions.includes(f)), ...movieExtensions];
                                        } else {
                                            // Remove all movie extensions
                                            newFilters = currentFilters.filter(f => !movieExtensions.includes(f));
                                        }

                                        const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                        setExtensionFilter(filterString);
                                    }}
                                    checked={extensionFilter !== "all" && ['mp4', 'webm'].some(ext => extensionFilter.split(',').includes(ext))}
                                />
                                <label className="checkbox checkbox-normal" htmlFor="filter-extension-movie-group-check"><strong>{t('directoryMenu:filter.movie')}</strong></label>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', marginLeft: '20px' }}>
                                {[
                                    { value: 'mp4', label: 'mp4', extensions: ['mp4'] },
                                    { value: 'webm', label: 'webm', extensions: ['webm'] }
                                ].map(item => (
                                    <div key={item.value}>
                                        <input
                                            type="checkbox"
                                            value={item.value}
                                            id={`filter-extension-${item.value}-check`}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');

                                                let newFilters;
                                                if (checked) {
                                                    // Add all extensions for this item
                                                    newFilters = [...currentFilters, ...item.extensions];
                                                } else {
                                                    // Remove all extensions for this item
                                                    newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                                }

                                                const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                                setExtensionFilter(filterString);
                                            }}
                                            checked={extensionFilter !== "all" && item.extensions.some(ext => extensionFilter.split(',').includes(ext))}
                                        />
                                        <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${item.value}-check`}>{item.label}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </li>
            </ul>
        </div>
    );
}

export default FilterTab;
