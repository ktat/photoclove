import React from "react";
import { useTranslation } from 'react-i18next';
import { logger } from "../../../services/LoggerService.js";
import {
    EXTENSION_GROUPS,
    groupExtensions,
    setExtensions,
    setOther,
    extensionsChecked,
    otherChecked
} from "../../../utils/extensionFilters.js";

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
                        {EXTENSION_GROUPS.map(group => {
                            const groupExts = groupExtensions(group);
                            const groupLabel = group.labelKey ? t(group.labelKey) : group.label;
                            return (
                                <div key={group.key} style={{ marginBottom: '10px' }}>
                                    <div>
                                        <input
                                            type="checkbox"
                                            id={`filter-extension-${group.key}-group-check`}
                                            onChange={(e) => setExtensionFilter(setExtensions(extensionFilter, groupExts, e.target.checked))}
                                            checked={extensionsChecked(extensionFilter, groupExts)}
                                        />
                                        <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${group.key}-group-check`}><strong>{groupLabel}</strong></label>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', marginLeft: '20px' }}>
                                        {group.items.map(item => (
                                            <div key={item.value}>
                                                <input
                                                    type="checkbox"
                                                    value={item.value}
                                                    id={`filter-extension-${item.value}-check`}
                                                    onChange={(e) => setExtensionFilter(setExtensions(extensionFilter, item.extensions, e.target.checked))}
                                                    checked={extensionsChecked(extensionFilter, item.extensions)}
                                                />
                                                <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${item.value}-check`}>{item.label}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Other: everything not in a known group */}
                        <div>
                            <input
                                type="checkbox"
                                id="filter-extension-other-check"
                                onChange={(e) => setExtensionFilter(setOther(extensionFilter, e.target.checked))}
                                checked={otherChecked(extensionFilter)}
                            />
                            <label className="checkbox checkbox-normal" htmlFor="filter-extension-other-check"><strong>{t('directoryMenu:filter.other', 'Other')}</strong></label>
                        </div>
                    </div>
                </li>
            </ul>
        </div>
    );
}

export default FilterTab;
