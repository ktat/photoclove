/**
 * BaseRightPanel - Configurable right panel with tab system
 * Supports different tab configurations for different contexts (photos, search, etc.)
 * Maintains vertical tab layout, animations, and state management
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

const BaseRightPanel = ({
  context = 'photos', // 'photos', 'search', etc.
  tabs = [],
  currentPhoto = null,
  showSideMenu = false,
  setShowSideMenu = null,
  defaultActiveTab = null,
  onTabChange = null,
  className = '',
  style = {},
  ...props
}) => {
  // State
  const [activeTab, setActiveTab] = useState(defaultActiveTab || (tabs.length > 0 ? tabs[0].id : null));
  const [isAnimating, setIsAnimating] = useState(false);
  const [tabContentHeight, setTabContentHeight] = useState('auto');
  
  // Refs
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const dummyFocusRef = useRef(null);
  
  // Initialize active tab
  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(defaultActiveTab || tabs[0].id);
    }
  }, [tabs, activeTab, defaultActiveTab]);
  
  // Handle tab change
  const handleTabChange = useCallback((tabId) => {
    if (tabId === activeTab) return;
    
    setIsAnimating(true);
    setActiveTab(tabId);
    
    // Call callback if provided
    if (onTabChange) {
      onTabChange(tabId, tabs.find(tab => tab.id === tabId));
    }
    
    // Reset animation state
    setTimeout(() => {
      setIsAnimating(false);
    }, 200);
  }, [activeTab, onTabChange, tabs]);
  
  // Handle panel toggle
  const handleTogglePanel = useCallback(() => {
    if (setShowSideMenu) {
      setShowSideMenu(!showSideMenu);
    }
  }, [showSideMenu, setShowSideMenu]);
  
  // Handle close panel
  const handleClosePanel = useCallback(() => {
    if (setShowSideMenu) {
      setShowSideMenu(false);
    }
  }, [setShowSideMenu]);
  
  // Focus management
  useEffect(() => {
    if (showSideMenu && dummyFocusRef.current) {
      dummyFocusRef.current.focus();
    }
  }, [showSideMenu]);
  
  // Get current tab component
  const getCurrentTabComponent = useCallback(() => {
    const currentTab = tabs.find(tab => tab.id === activeTab);
    if (!currentTab || !currentTab.component) return null;
    
    const TabComponent = currentTab.component;
    return (
      <TabComponent
        photo={currentPhoto}
        context={context}
        isActive={true}
        {...currentTab.props}
      />
    );
  }, [activeTab, tabs, currentPhoto, context]);
  
  // Panel classes
  const panelClasses = [
    'base-right-panel',
    `context-${context}`,
    showSideMenu ? 'menu-open' : 'menu-closed',
    isAnimating ? 'animating' : '',
    className
  ].filter(Boolean).join(' ');
  
  // Panel styles
  const panelStyles = {
    position: 'fixed',
    right: 0,
    top: 0,
    height: '100vh',
    width: showSideMenu ? '400px' : '0px',
    backgroundColor: '#2a2a2a',
    borderLeft: showSideMenu ? '1px solid #444' : 'none',
    transition: 'width 0.3s ease, border 0.3s ease',
    overflow: 'hidden',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'row',
    ...style
  };
  
  // Tab button styles
  const getTabButtonStyles = (tabId) => ({
    writing: 'vertical-rl',
    textOrientation: 'mixed',
    transform: 'rotate(180deg)',
    padding: '10px 5px',
    backgroundColor: activeTab === tabId ? '#4a9eff' : '#3a3a3a',
    color: activeTab === tabId ? '#fff' : '#ccc',
    border: 'none',
    borderBottom: '1px solid #444',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '12px',
    fontWeight: activeTab === tabId ? 'bold' : 'normal',
    minHeight: '80px',
    width: '30px'
  });
  
  // Content area styles
  const contentStyles = {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    height: tabContentHeight
  };
  
  if (tabs.length === 0) {
    return null;
  }
  
  return (
    <>
      {/* Tab buttons - always visible */}
      <div 
        className="tab-buttons-container"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          width: '30px',
          height: '100vh',
          backgroundColor: '#3a3a3a',
          borderLeft: '1px solid #444',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            style={getTabButtonStyles(tab.id)}
            onClick={() => {
              handleTabChange(tab.id);
              if (!showSideMenu) {
                handleTogglePanel();
              }
            }}
            title={tab.label}
          >
            {tab.label}
          </button>
        ))}
        
        {/* Close button when panel is open */}
        {showSideMenu && (
          <button
            className="close-button"
            style={{
              position: 'absolute',
              top: '10px',
              right: '40px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '5px',
              zIndex: 1002
            }}
            onClick={handleClosePanel}
            title="Close panel"
          >
            ×
          </button>
        )}
      </div>
      
      {/* Panel content */}
      <div 
        ref={panelRef}
        className={panelClasses}
        style={panelStyles}
        {...props}
      >
        {/* Dummy element for focus management */}
        <div
          ref={dummyFocusRef}
          className="dummy-for-focus"
          tabIndex={-1}
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px'
          }}
        />
        
        {/* Tab content area */}
        <div 
          ref={contentRef}
          className="tab-content"
          style={contentStyles}
        >
          {showSideMenu && (
            <>
              {/* Tab header */}
              <div className="tab-header" style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#fff' }}>
                  {tabs.find(tab => tab.id === activeTab)?.label || 'Panel'}
                </h3>
              </div>
              
              {/* Current tab component */}
              <div className={`tab-content-body ${isAnimating ? 'transitioning' : ''}`}>
                {getCurrentTabComponent()}
              </div>
              
              {/* Context info */}
              {currentPhoto && (
                <div className="context-info" style={{ 
                  marginTop: '20px',
                  paddingTop: '20px',
                  borderTop: '1px solid #444',
                  fontSize: '12px',
                  color: '#888'
                }}>
                  <div>Context: {context}</div>
                  <div>Photo: {currentPhoto.file?.name || 'Unknown'}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

// Example tab components that can be used with BaseRightPanel
export const PhotoInfoTab = ({ photo, context }) => (
  <div className="photo-info-tab">
    <h4>Photo Information</h4>
    {photo ? (
      <div>
        <p><strong>Name:</strong> {photo.file?.name}</p>
        <p><strong>Path:</strong> {photo.file?.path}</p>
        {photo.star_rating > 0 && (
          <p><strong>Rating:</strong> {'★'.repeat(photo.star_rating)}</p>
        )}
        {photo.comment && (
          <p><strong>Comment:</strong> {photo.comment}</p>
        )}
        {photo.date_taken && (
          <p><strong>Date:</strong> {new Date(photo.date_taken).toLocaleDateString()}</p>
        )}
        {photo.camera_make && (
          <p><strong>Camera:</strong> {photo.camera_make} {photo.camera_model}</p>
        )}
      </div>
    ) : (
      <p>No photo selected</p>
    )}
  </div>
);

export const PhotoEditorTab = ({ photo, context }) => (
  <div className="photo-editor-tab">
    <h4>Photo Editor</h4>
    {photo ? (
      <div>
        <p>Editor tools for: {photo.file?.name}</p>
        <div style={{ marginTop: '20px' }}>
          <button style={{ marginRight: '10px', marginBottom: '10px' }}>Rotate</button>
          <button style={{ marginRight: '10px', marginBottom: '10px' }}>Crop</button>
          <button style={{ marginRight: '10px', marginBottom: '10px' }}>Adjust</button>
          <button style={{ marginRight: '10px', marginBottom: '10px' }}>Filters</button>
        </div>
      </div>
    ) : (
      <p>No photo selected</p>
    )}
  </div>
);

export const SearchToolsTab = ({ photo, context }) => (
  <div className="search-tools-tab">
    <h4>Search Tools</h4>
    <div style={{ marginBottom: '20px' }}>
      <h5>Filters</h5>
      <div>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <input type="checkbox" style={{ marginRight: '8px' }} />
          Images only
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <input type="checkbox" style={{ marginRight: '8px' }} />
          Videos only
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <input type="checkbox" style={{ marginRight: '8px' }} />
          Rated photos
        </label>
      </div>
    </div>
    
    <div style={{ marginBottom: '20px' }}>
      <h5>Sort by</h5>
      <select style={{ width: '100%', padding: '5px' }}>
        <option value="relevance">Relevance</option>
        <option value="date">Date</option>
        <option value="name">Name</option>
        <option value="rating">Rating</option>
      </select>
    </div>
    
    <div>
      <h5>Saved Searches</h5>
      <p style={{ color: '#888', fontSize: '12px' }}>Recent searches will appear here</p>
    </div>
  </div>
);

export default BaseRightPanel;