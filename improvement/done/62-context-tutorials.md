# Context-Aware Tutorials

## Overview
Implement context-aware tutorial tooltips for the Selection tab to help users understand what operations are available based on their current mode (date/search view vs album view). Show different tutorials for first-time users in each context.

## Problem
PhotoClove's Selection tab functionality changes based on context (date view vs album view), but users have no guidance about what operations are available or how to use them. First-time users especially need help understanding the workflow.

## Implementation Plan

### 1. Tutorial Trigger System
Detect first-time selections in different contexts:
- First selection in date/search mode
- First selection in album view mode
- Track tutorial completion per context

### 2. Context-Aware Tutorial Content
Different tutorial messages based on current view mode:

**Date/Search Mode Tutorial:**
```
"Selected [X] photos. You can now:
• 📚 Create Album - Make a new album with these photos
• 📚 Add to Album - Add to an existing album  
• ⬆️ Upload to Google Photos - Sync with Google
• 🗑️ Delete Files - Permanently remove files"
```

**Album Mode Tutorial:**
```
"Selected [X] photos from this album. You can now:
• 📚 Create Album - Make a new album with these photos
• 📚 Add to Album - Add to a different album
• ❌ Remove from Album - Remove from current album (keeps files)
• ⬆️ Upload to Google Photos - Sync with Google  
• 🗑️ Delete Files - Permanently remove files"
```

### 3. Tutorial UI Component
Create tooltip overlay that appears near the Selection dropdown:
- Animated appearance
- Clear, concise messaging
- Dismissible with "Got it" button
- Option to "Don't show again"

### 4. Tutorial State Management
Track tutorial state in localStorage:
```javascript
const tutorialState = {
  selectionTutorial: {
    dateMode: { shown: false, dismissed: false },
    albumMode: { shown: false, dismissed: false }
  }
};
```

### 5. Progressive Disclosure
Show tutorials progressively:
- Basic selection tutorial first
- Advanced features (like album operations) in subsequent selections
- Contextual hints for new features

## Files to Create
- `src/components/TutorialTooltip.jsx` - Reusable tutorial tooltip component
- `src/hooks/useTutorial.js` - Tutorial state management hook

## Files to Modify
- `src/App/PhotosList/DirectoryMenu.jsx` - Add tutorial triggers and display
- `src/services/TutorialService.js` - Tutorial tracking service (create if needed)

## Implementation Details

### TutorialTooltip.jsx
```jsx
import React, { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

const TutorialTooltip = ({ 
  isVisible, 
  content, 
  targetElement, 
  onDismiss, 
  onDontShowAgain,
  tutorialId 
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isVisible && targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 10,
        left: rect.left
      });
    }
  }, [isVisible, targetElement]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    logger.info('TutorialTooltip', 'tutorial_dismissed', 'User dismissed tutorial', { tutorialId });
    onDismiss();
  };

  const handleDontShowAgain = () => {
    logger.info('TutorialTooltip', 'tutorial_disabled', 'User disabled tutorial', { tutorialId });
    onDontShowAgain();
  };

  return (
    <div style={{
      position: 'fixed',
      top: position.top,
      left: position.left,
      backgroundColor: '#1E3A8A',
      color: 'white',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      zIndex: 10000,
      maxWidth: '320px',
      fontSize: '14px',
      lineHeight: '1.4',
      animation: 'tutorialFadeIn 0.3s ease-out'
    }}>
      {/* Content */}
      <div style={{ marginBottom: '12px' }}>
        {content}
      </div>

      {/* Action Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        justifyContent: 'flex-end',
        borderTop: '1px solid #3B82F6',
        paddingTop: '12px',
        marginTop: '12px'
      }}>
        <button
          onClick={handleDontShowAgain}
          style={{
            background: 'transparent',
            border: '1px solid #60A5FA',
            color: '#60A5FA',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Don't show again
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: '#3B82F6',
            border: 'none',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Got it! 👍
        </button>
      </div>

      {/* Arrow pointing to target */}
      <div style={{
        position: 'absolute',
        top: '-8px',
        left: '20px',
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderBottom: '8px solid #1E3A8A'
      }} />

      <style jsx>{`
        @keyframes tutorialFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default TutorialTooltip;
```

### useTutorial.js Hook
```javascript
import { useState, useEffect } from 'react';
import { logger } from '../services/LoggerService.js';

const TUTORIAL_STORAGE_KEY = 'photoclove_tutorials';

export const useTutorial = () => {
  const [tutorialState, setTutorialState] = useState({
    selectionTutorial: {
      dateMode: { shown: false, dismissed: false },
      albumMode: { shown: false, dismissed: false }
    }
  });

  // Load tutorial state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (saved) {
        const parsedState = JSON.parse(saved);
        setTutorialState(prev => ({ ...prev, ...parsedState }));
      }
    } catch (error) {
      logger.warn('useTutorial', 'load_failed', 'Failed to load tutorial state', { error: error.message });
    }
  }, []);

  // Save tutorial state to localStorage
  const saveTutorialState = (newState) => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(newState));
      setTutorialState(newState);
    } catch (error) {
      logger.error('useTutorial', 'save_failed', 'Failed to save tutorial state', { error: error.message });
    }
  };

  // Check if tutorial should be shown
  const shouldShowTutorial = (tutorialType, context) => {
    const contextState = tutorialState[tutorialType]?.[context];
    return contextState && !contextState.shown && !contextState.dismissed;
  };

  // Mark tutorial as shown
  const markTutorialShown = (tutorialType, context) => {
    const newState = {
      ...tutorialState,
      [tutorialType]: {
        ...tutorialState[tutorialType],
        [context]: {
          ...tutorialState[tutorialType][context],
          shown: true
        }
      }
    };
    saveTutorialState(newState);
    
    logger.info('useTutorial', 'tutorial_shown', 'Tutorial marked as shown', { tutorialType, context });
  };

  // Dismiss tutorial
  const dismissTutorial = (tutorialType, context) => {
    const newState = {
      ...tutorialState,
      [tutorialType]: {
        ...tutorialState[tutorialType],
        [context]: {
          ...tutorialState[tutorialType][context],
          shown: true,
          dismissed: false
        }
      }
    };
    saveTutorialState(newState);
  };

  // Permanently disable tutorial
  const disableTutorial = (tutorialType, context) => {
    const newState = {
      ...tutorialState,
      [tutorialType]: {
        ...tutorialState[tutorialType],
        [context]: {
          ...tutorialState[tutorialType][context],
          shown: true,
          dismissed: true
        }
      }
    };
    saveTutorialState(newState);
  };

  // Reset all tutorials (for testing/debugging)
  const resetTutorials = () => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setTutorialState({
      selectionTutorial: {
        dateMode: { shown: false, dismissed: false },
        albumMode: { shown: false, dismissed: false }
      }
    });
  };

  return {
    shouldShowTutorial,
    markTutorialShown,
    dismissTutorial,
    disableTutorial,
    resetTutorials
  };
};
```

### DirectoryMenu Integration
```javascript
import { useTutorial } from '../../hooks/useTutorial.js';
import TutorialTooltip from '../../components/TutorialTooltip.jsx';

function DirectoryMenu(props) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialContent, setTutorialContent] = useState('');
  const dropdownRef = useRef(null);
  
  const {
    shouldShowTutorial,
    markTutorialShown,
    dismissTutorial,
    disableTutorial
  } = useTutorial();

  // Detect when photos are first selected
  useEffect(() => {
    if (props.photoSelection.length > 0) {
      const context = props.albumId ? 'albumMode' : 'dateMode';
      
      if (shouldShowTutorial('selectionTutorial', context)) {
        setTutorialContent(getTutorialContent(context, props.photoSelection.length));
        setShowTutorial(true);
        markTutorialShown('selectionTutorial', context);
      }
    } else {
      setShowTutorial(false);
    }
  }, [props.photoSelection.length, props.albumId]);

  const getTutorialContent = (context, photoCount) => {
    const photoText = `${photoCount} photo${photoCount !== 1 ? 's' : ''}`;
    
    if (context === 'albumMode') {
      return (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            💡 Selected {photoText} from this album
          </div>
          <div>You can now:</div>
          <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
            <li>📚 Create Album - Make a new album</li>
            <li>📚 Add to Album - Add to a different album</li>
            <li>❌ Remove from Album - Remove from current album</li>
            <li>⬆️ Upload to Google Photos - Sync with Google</li>
            <li>🗑️ Delete Files - Permanently remove files</li>
          </ul>
        </div>
      );
    } else {
      return (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            💡 Selected {photoText}
          </div>
          <div>You can now:</div>
          <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
            <li>📚 Create Album - Make a new album</li>
            <li>📚 Add to Album - Add to existing album</li>
            <li>⬆️ Upload to Google Photos - Sync with Google</li>
            <li>🗑️ Delete Files - Permanently remove files</li>
          </ul>
        </div>
      );
    }
  };

  const handleTutorialDismiss = () => {
    setShowTutorial(false);
    const context = props.albumId ? 'albumMode' : 'dateMode';
    dismissTutorial('selectionTutorial', context);
  };

  const handleTutorialDisable = () => {
    setShowTutorial(false);
    const context = props.albumId ? 'albumMode' : 'dateMode';
    disableTutorial('selectionTutorial', context);
  };

  return (
    <div id="directory-maintenance">
      {/* Existing DirectoryMenu content */}
      
      <div id="tab-selection" className={props.tabClass['selection'] ? "tab-active" : "tab"}>
        {/* Selection content */}
        <div className="operation">
          <select ref={dropdownRef} onChange={(e) => doOperation(e)}>
            {/* Dropdown options */}
          </select>
        </div>
      </div>

      {/* Tutorial Tooltip */}
      <TutorialTooltip
        isVisible={showTutorial}
        content={tutorialContent}
        targetElement={dropdownRef.current}
        onDismiss={handleTutorialDismiss}
        onDontShowAgain={handleTutorialDisable}
        tutorialId={`selection_${props.albumId ? 'album' : 'date'}`}
      />
    </div>
  );
}
```

## User Experience Flow

### First Selection in Date Mode
1. User selects first photo in date/search view
2. Opens Selection tab
3. Tutorial tooltip appears pointing to dropdown
4. Shows operations available in date mode
5. User can dismiss or disable future tutorials

### First Selection in Album Mode  
1. User viewing album, selects first photo
2. Opens Selection tab  
3. Different tutorial appears with album-specific options
4. Highlights "Remove from Album" as album-specific feature
5. User understands context difference

### Progressive Learning
- Tutorial appears only once per context
- Users can re-enable in Preferences if needed
- Clear visual cues help users understand current mode

## Success Criteria
- Tutorials appear appropriately for first-time selections
- Different content shown for different contexts
- Tutorial state persists across sessions
- Users can dismiss or disable tutorials
- Tutorial UI is non-intrusive but informative

## Future Enhancements
- Interactive tutorial mode with guided steps
- Context-sensitive help system
- Video tutorials for complex workflows
- Onboarding wizard for new users

keep context