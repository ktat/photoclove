import React, { useState, useRef, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

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
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                padding: '12px 16px',
                minWidth: '280px',
                maxWidth: '350px',
                zIndex: 10000,
                color: 'var(--text)'
            }}
        >
            {/* Star Filter - Hide in import mode */}
            {!isImportMode && (
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '14px', color: 'var(--text)', minWidth: '50px' }}>Stars</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
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
                                        fontSize: '16px',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        backgroundColor: starFilter === v ? 'var(--accent)' : 'transparent',
                                        color: starFilter >= v ? '#ffd700' : '#666',
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
            
            {/* Comment Filter - Switch Style - Hide in import mode */}
            {!isImportMode && (
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '14px', color: 'var(--text)' }}>Has Comment</span>
                        <label style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '44px',
                            height: '24px',
                            cursor: 'pointer'
                        }}>
                            <input
                                type="checkbox"
                                checked={hasCommentFilter}
                                onChange={(e) => {
                                    logger.debug('FilterPopover', 'filter_changed', 'User changed comment filter', {
                                        filterType: 'hasCommentFilter',
                                        newValue: e.target.checked,
                                        previousValue: hasCommentFilter
                                    });
                                    setHasCommentFilter(e.target.checked);
                                }}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: hasCommentFilter ? 'var(--accent)' : '#374151',
                                borderRadius: '24px',
                                transition: 'background-color 0.2s'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    left: hasCommentFilter ? '22px' : '2px',
                                    top: '2px',
                                    width: '20px',
                                    height: '20px',
                                    backgroundColor: 'white',
                                    borderRadius: '50%',
                                    transition: 'left 0.2s'
                                }}></span>
                            </span>
                        </label>
                    </div>
                </div>
            )}
            
            {/* Tag Filter - Switch Style - Hide in import mode */}
            {!isImportMode && (
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '14px', color: 'var(--text)' }}>Has Tag</span>
                        <label style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '44px',
                            height: '24px',
                            cursor: 'pointer'
                        }}>
                            <input
                                type="checkbox"
                                checked={hasTagFilter}
                                onChange={(e) => {
                                    logger.debug('FilterPopover', 'filter_changed', 'User changed tag filter', {
                                        filterType: 'hasTagFilter',
                                        newValue: e.target.checked,
                                        previousValue: hasTagFilter
                                    });
                                    setHasTagFilter(e.target.checked);
                                }}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: hasTagFilter ? 'var(--accent)' : '#374151',
                                borderRadius: '24px',
                                transition: 'background-color 0.2s'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    left: hasTagFilter ? '22px' : '2px',
                                    top: '2px',
                                    width: '20px',
                                    height: '20px',
                                    backgroundColor: 'white',
                                    borderRadius: '50%',
                                    transition: 'left 0.2s'
                                }}></span>
                            </span>
                        </label>
                    </div>
                </div>
            )}
            
            {/* Extension Filter */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text)', minWidth: '70px' }}>Extensions</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        {/* All Extensions */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                                type="checkbox"
                                id="extension-filter-all"
                                checked={extensionFilter === "all"}
                                onChange={(e) => {
                                    setExtensionFilter("all");
                                }}
                                style={{ display: 'none' }}
                            />
                            <label 
                                className="checkbox checkbox-normal" 
                                htmlFor="extension-filter-all"
                                style={{ marginRight: '8px' }}
                            ></label>
                            <span style={{ fontSize: '14px', cursor: 'pointer' }} onClick={() => setExtensionFilter("all")}>All</span>
                        </div>
                        
                        {/* Individual Extensions */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                            {[
                                { value: 'jpg', label: 'JPG', extensions: ['jpg', 'jpeg'] },
                                { value: 'png', label: 'PNG', extensions: ['png'] },
                                { value: 'gif', label: 'GIF', extensions: ['gif'] },
                                { value: 'bmp', label: 'BMP', extensions: ['bmp'] },
                                { value: 'tiff', label: 'TIFF', extensions: ['tiff'] },
                                { value: 'mp4', label: 'MP4', extensions: ['mp4'] },
                                { value: 'webm', label: 'WebM', extensions: ['webm'] }
                            ].map((item, idx) => (
                                <div key={item.value} style={{ display: 'flex', alignItems: 'center' }}>
                                    <input 
                                        type="checkbox"
                                        id={`extension-filter-${item.value}`}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');
                                            
                                            let newFilters;
                                            if (checked) {
                                                newFilters = [...currentFilters, ...item.extensions];
                                            } else {
                                                newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                            }
                                            
                                            const filterString = newFilters.length === 0 ? "all" : [...new Set(newFilters)].join(',');
                                            setExtensionFilter(filterString);
                                        }}
                                        checked={extensionFilter !== "all" && item.extensions.some(ext => extensionFilter.split(',').includes(ext))}
                                        style={{ display: 'none' }}
                                    />
                                    <label 
                                        className="checkbox checkbox-normal" 
                                        htmlFor={`extension-filter-${item.value}`}
                                        style={{ marginRight: '6px' }}
                                    ></label>
                                    <span 
                                        style={{ fontSize: '13px', cursor: 'pointer' }} 
                                        onClick={() => {
                                            const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');
                                            const isCurrentlyChecked = extensionFilter !== "all" && item.extensions.some(ext => extensionFilter.split(',').includes(ext));
                                            
                                            let newFilters;
                                            if (!isCurrentlyChecked) {
                                                newFilters = [...currentFilters, ...item.extensions];
                                            } else {
                                                newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                            }
                                            
                                            const filterString = newFilters.length === 0 ? "all" : [...new Set(newFilters)].join(',');
                                            setExtensionFilter(filterString);
                                        }}
                                    >{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Clear Filters Button */}
            {((!isImportMode && (starFilter > 0 || hasCommentFilter || hasTagFilter)) || extensionFilter !== 'all') && (
                <div style={{ 
                    marginTop: '16px', 
                    paddingTop: '12px', 
                    borderTop: '1px solid var(--border)',
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
                            padding: '8px 16px',
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: 'var(--text)',
                            fontSize: '14px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--accent)'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--bg-elevated)'}
                    >
                        Clear All Filters
                    </button>
                </div>
            )}
        </div>
    );
};

export default FilterPopover;