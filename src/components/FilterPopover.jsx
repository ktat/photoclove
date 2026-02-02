import React, { useState, useRef, useEffect, useCallback } from 'react';
import { logger } from '../services/LoggerService.js';

// Reusable toggle switch component
const ToggleSwitch = ({ label, checked, onChange, filterType }) => (
    <div style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>{label}</span>
            <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '44px',
                height: '24px',
                cursor: 'pointer'
            }}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                        logger.debug('FilterPopover', 'filter_changed', `User changed ${filterType} filter`, {
                            filterType,
                            newValue: e.target.checked,
                            previousValue: checked
                        });
                        onChange(e.target.checked);
                    }}
                    style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-bg-muted)',
                    borderRadius: 'var(--radius-xl)',
                    transition: 'background-color 0.2s'
                }}>
                    <span style={{
                        position: 'absolute',
                        left: checked ? '22px' : '2px',
                        top: '2px',
                        width: '20px',
                        height: '20px',
                        backgroundColor: 'var(--color-bg-elevated)',
                        borderRadius: '50%',
                        transition: 'left 0.2s'
                    }}></span>
                </span>
            </label>
        </div>
    </div>
);

// Extension filter configuration
const EXTENSION_OPTIONS = [
    { value: 'jpg', label: 'JPG', extensions: ['jpg', 'jpeg'] },
    { value: 'png', label: 'PNG', extensions: ['png'] },
    { value: 'gif', label: 'GIF', extensions: ['gif'] },
    { value: 'bmp', label: 'BMP', extensions: ['bmp'] },
    { value: 'tiff', label: 'TIFF', extensions: ['tiff'] },
    { value: 'mp4', label: 'MP4', extensions: ['mp4'] },
    { value: 'webm', label: 'WebM', extensions: ['webm'] }
];

// Extension filter component
const ExtensionFilter = ({ extensionFilter, setExtensionFilter }) => {
    // Helper to toggle extension filter
    const toggleExtension = (extensions, forceAdd = null) => {
        const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');
        const isChecked = forceAdd !== null ? !forceAdd : extensions.some(ext => currentFilters.includes(ext));

        const newFilters = isChecked
            ? currentFilters.filter(f => !extensions.includes(f))
            : [...currentFilters, ...extensions];

        setExtensionFilter(newFilters.length === 0 ? "all" : [...new Set(newFilters)].join(','));
    };

    const isExtensionChecked = (extensions) =>
        extensionFilter !== "all" && extensions.some(ext => extensionFilter.split(',').includes(ext));

    return (
        <div style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', minWidth: '70px' }}>Extensions</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
                    {/* All Extensions */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            id="extension-filter-all"
                            checked={extensionFilter === "all"}
                            onChange={() => setExtensionFilter("all")}
                            style={{ display: 'none' }}
                        />
                        <label className="checkbox checkbox-normal" htmlFor="extension-filter-all" style={{ marginRight: 'var(--space-2)' }}></label>
                        <span style={{ fontSize: 'var(--font-size-base)', cursor: 'pointer' }} onClick={() => setExtensionFilter("all")}>All</span>
                    </div>

                    {/* Individual Extensions */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
                        {EXTENSION_OPTIONS.map((item) => (
                            <div key={item.value} style={{ display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="checkbox"
                                    id={`extension-filter-${item.value}`}
                                    onChange={(e) => toggleExtension(item.extensions, e.target.checked)}
                                    checked={isExtensionChecked(item.extensions)}
                                    style={{ display: 'none' }}
                                />
                                <label className="checkbox checkbox-normal" htmlFor={`extension-filter-${item.value}`} style={{ marginRight: 'var(--space-2)' }}></label>
                                <span style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer' }} onClick={() => toggleExtension(item.extensions)}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FilterPopover = ({
    isOpen,
    onClose,
    anchorRef,
    starFilter,
    setStarFilter,
    hasCommentFilter,
    setHasCommentFilter,
    hasTagFilter,
    setHasTagFilter,
    extensionFilter,
    setExtensionFilter,
    isImportMode
}) => {
    const popoverRef = useRef(null);
    
    // Handle clicks outside the popover
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target) && 
                anchorRef?.current && !anchorRef.current.contains(event.target)) {
                onClose();
            }
        };
        
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen, onClose, anchorRef]);
    
    if (!isOpen) return null;
    
    // Calculate position based on anchor element
    const getPosition = () => {
        if (!anchorRef?.current) return { top: 60, right: 0 };
        const rect = anchorRef.current.getBoundingClientRect();
        
        // Use fixed top position to ensure it's below the toolbar
        const topPosition = 60;
        // Align right edge of popover with right edge of button
        const rightPosition = window.innerWidth - rect.right;
        
        return {
            top: topPosition,
            right: rightPosition
        };
    };
    
    const position = getPosition();
    
    return (
        <div 
            ref={popoverRef}
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                right: `${position.right}px`,
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                padding: 'var(--space-3) var(--space-4)',
                minWidth: '280px',
                maxWidth: '350px',
                zIndex: 10000,
                color: 'var(--color-text-primary)'
            }}
        >
            {/* Star Filter - Hide in import mode */}
            {!isImportMode && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', minWidth: '50px' }}>Stars</span>
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                            {[0, 1, 2, 3, 4, 5].map((v) => (
                                <span
                                    key={v}
                                    onClick={() => {
                                        logger.debug('FilterPopover', 'filter_changed', 'User changed star filter', {
                                            filterType: 'starFilter',
                                            newValue: v,
                                            previousValue: starFilter
                                        });
                                        setStarFilter(v);
                                    }}
                                    style={{
                                        cursor: 'pointer',
                                        fontSize: 'var(--font-size-lg)',
                                        padding: '2px 4px',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: starFilter === v ? 'var(--color-bg-surface)' : 'transparent',
                                        border: starFilter === v ? '1px solid var(--color-primary)' : '1px solid transparent',
                                        color: starFilter >= v ? 'var(--color-warning)' : 'var(--color-text-muted)',
                                        transition: 'all 0.2s'
                                    }}
                                    title={v === 0 ? 'Show all' : `${v} stars or more`}
                                >
                                    {v === 0 ? 'All' : `★${v}+`}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Comment Filter - Hide in import mode */}
            {!isImportMode && (
                <ToggleSwitch
                    label="Has Comment"
                    checked={hasCommentFilter}
                    onChange={setHasCommentFilter}
                    filterType="hasCommentFilter"
                />
            )}

            {/* Tag Filter - Hide in import mode */}
            {!isImportMode && (
                <ToggleSwitch
                    label="Has Tag"
                    checked={hasTagFilter}
                    onChange={setHasTagFilter}
                    filterType="hasTagFilter"
                />
            )}
            
            {/* Extension Filter */}
            <ExtensionFilter extensionFilter={extensionFilter} setExtensionFilter={setExtensionFilter} />
            
            {/* Clear Filters Button */}
            {((!isImportMode && (starFilter > 0 || hasCommentFilter || hasTagFilter)) || extensionFilter !== 'all') && (
                <div style={{ 
                    marginTop: 'var(--space-4)', 
                    paddingTop: 'var(--space-3)', 
                    borderTop: '1px solid var(--color-border-default)',
                    textAlign: 'center'
                }}>
                    <button
                        onClick={() => {
                            logger.debug('FilterPopover', 'clear_filters', 'User cleared all filters');
                            if (!isImportMode) {
                                setStarFilter(0);
                                setHasCommentFilter(false);
                                setHasTagFilter(false);
                            }
                            setExtensionFilter('all');
                        }}
                        style={{
                            padding: 'var(--space-2) var(--space-4)',
                            backgroundColor: 'var(--color-bg-elevated)',
                            border: '1px solid var(--color-border-default)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--color-text-primary)',
                            fontSize: 'var(--font-size-base)',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-bg-elevated)'}
                    >
                        Clear All Filters
                    </button>
                </div>
            )}
        </div>
    );
};

export default FilterPopover;