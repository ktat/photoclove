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
    extensionFilter,
    setExtensionFilter
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
        if (!anchorRef?.current) return { top: 0, right: 0 };
        const rect = anchorRef.current.getBoundingClientRect();
        return {
            top: rect.bottom + 5,
            right: window.innerWidth - rect.right
        };
    };
    
    const position = getPosition();
    
    return (
        <div 
            ref={popoverRef}
            style={{
                position: 'absolute',
                top: `${position.top}px`,
                right: `${position.right}px`,
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                padding: '16px',
                minWidth: '320px',
                maxWidth: '400px',
                zIndex: 1000,
                color: 'var(--text)'
            }}
        >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>Filters</h3>
            
            {/* Star Filter */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Stars:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
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
                                fontSize: '18px',
                                color: starFilter >= v ? '#ffd700' : '#666'
                            }}
                        >
                            {starFilter >= v ? "★" : "☆"}{v}
                        </span>
                    ))}
                </div>
            </div>
            
            {/* Comment Filter */}
            <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
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
                        style={{ marginRight: '8px' }}
                    />
                    <span>Has comment</span>
                </label>
            </div>
            
            {/* Extension Filter */}
            <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Extensions:
                </label>
                
                {/* Image Extensions Group */}
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', cursor: 'pointer' }}>
                        <input 
                            type="checkbox"
                            onChange={(e) => {
                                const checked = e.target.checked;
                                const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');
                                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
                                
                                let newFilters;
                                if (checked) {
                                    newFilters = [...currentFilters.filter(f => !imageExtensions.includes(f)), ...imageExtensions];
                                } else {
                                    newFilters = currentFilters.filter(f => !imageExtensions.includes(f));
                                }
                                
                                const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                setExtensionFilter(filterString);
                            }}
                            checked={extensionFilter !== "all" && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].some(ext => extensionFilter.split(',').includes(ext))}
                            style={{ marginRight: '8px' }}
                        />
                        <strong>Image</strong>
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: '24px' }}>
                        {[
                            { value: 'jpeg', label: 'jpeg(jpg)', extensions: ['jpg', 'jpeg'] },
                            { value: 'png', label: 'png', extensions: ['png'] },
                            { value: 'gif', label: 'gif', extensions: ['gif'] },
                            { value: 'bmp', label: 'bmp', extensions: ['bmp'] },
                            { value: 'tiff', label: 'tiff', extensions: ['tiff'] }
                        ].map(item => (
                            <label key={item.value} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox"
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');
                                        
                                        let newFilters;
                                        if (checked) {
                                            newFilters = [...currentFilters, ...item.extensions];
                                        } else {
                                            newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                        }
                                        
                                        const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                        setExtensionFilter(filterString);
                                    }}
                                    checked={extensionFilter !== "all" && item.extensions.some(ext => extensionFilter.split(',').includes(ext))}
                                    style={{ marginRight: '4px' }}
                                />
                                <span style={{ fontSize: '14px' }}>{item.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                
                {/* Movie Extensions Group */}
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', cursor: 'pointer' }}>
                        <input 
                            type="checkbox"
                            onChange={(e) => {
                                const checked = e.target.checked;
                                const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');
                                const movieExtensions = ['mp4', 'webm'];
                                
                                let newFilters;
                                if (checked) {
                                    newFilters = [...currentFilters.filter(f => !movieExtensions.includes(f)), ...movieExtensions];
                                } else {
                                    newFilters = currentFilters.filter(f => !movieExtensions.includes(f));
                                }
                                
                                const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                setExtensionFilter(filterString);
                            }}
                            checked={extensionFilter !== "all" && ['mp4', 'webm'].some(ext => extensionFilter.split(',').includes(ext))}
                            style={{ marginRight: '8px' }}
                        />
                        <strong>Movie</strong>
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: '24px' }}>
                        {[
                            { value: 'mp4', label: 'mp4', extensions: ['mp4'] },
                            { value: 'webm', label: 'webm', extensions: ['webm'] }
                        ].map(item => (
                            <label key={item.value} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox"
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        const currentFilters = extensionFilter === "all" ? [] : extensionFilter.split(',').filter(f => f.trim() !== '');
                                        
                                        let newFilters;
                                        if (checked) {
                                            newFilters = [...currentFilters, ...item.extensions];
                                        } else {
                                            newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                        }
                                        
                                        const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                        setExtensionFilter(filterString);
                                    }}
                                    checked={extensionFilter !== "all" && item.extensions.some(ext => extensionFilter.split(',').includes(ext))}
                                    style={{ marginRight: '4px' }}
                                />
                                <span style={{ fontSize: '14px' }}>{item.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Active Filters Summary */}
            {(starFilter > 0 || hasCommentFilter || extensionFilter !== "all") && (
                <div style={{ 
                    marginTop: '16px', 
                    paddingTop: '16px', 
                    borderTop: '1px solid var(--border)',
                    fontSize: '12px',
                    color: '#999'
                }}>
                    <strong>Active filters:</strong>
                    {starFilter > 0 && <span style={{ marginLeft: '8px' }}>★{starFilter}+</span>}
                    {hasCommentFilter && <span style={{ marginLeft: '8px' }}>Has comment</span>}
                    {extensionFilter !== "all" && <span style={{ marginLeft: '8px' }}>Extensions: {extensionFilter}</span>}
                </div>
            )}
        </div>
    );
};

export default FilterPopover;