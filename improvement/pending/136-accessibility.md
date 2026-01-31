# Improvement #136: Accessibility Improvements

## Goal
Improve accessibility (a11y) of PhotoClove to make it usable for people with disabilities and ensure WCAG 2.1 Level AA compliance.

## Background
- Current implementation may lack proper ARIA labels
- Keyboard navigation may be incomplete
- Screen reader support may be inadequate
- Color contrast may not meet WCAG standards

## Current Accessibility Issues

### 1. Missing ARIA Labels
- Photos may not have descriptive labels
- Interactive elements may not announce their purpose
- Dynamic content changes may not be announced

### 2. Incomplete Keyboard Navigation
- May not be fully keyboard navigable
- Focus management may be inconsistent
- Tab order may be illogical
- Keyboard shortcuts may be missing or inconsistent

### 3. Poor Screen Reader Support
- Image descriptions may be missing
- State changes may not be announced
- Error messages may not be read
- Loading states may not be communicated

### 4. Color Contrast Issues
- Text may not meet 4.5:1 contrast ratio
- Interactive elements may not be visually distinct
- Focus indicators may be too subtle

### 5. Missing Focus Indicators
- Keyboard focus may not be visible
- Custom components may lose focus indicators
- Focus trap in modals may be missing

## Implementation Plan

### Step 1: Add ARIA Labels and Roles

#### PhotosList Component
```javascript
// PhotosList.jsx
<main
  role="main"
  aria-label="Photo Gallery"
>
  <header role="banner">
    <h1>{viewTitle}</h1>
  </header>

  <div
    role="region"
    aria-label="Photo grid"
    aria-live="polite"
    aria-busy={isLoading}
  >
    {/* photo grid */}
  </div>
</main>
```

#### PhotoCard Component
```javascript
// PhotoCard.jsx
<article
  role="article"
  aria-label={`Photo: ${photo.name}, taken on ${photo.date}`}
>
  <button
    onClick={handleClick}
    aria-pressed={isSelected}
    aria-label={`${isSelected ? 'Deselect' : 'Select'} photo ${photo.name}`}
  >
    <img
      src={photo.thumbnail}
      alt={`${photo.name}, taken on ${formatDate(photo.date)}, ${photo.star ? `rated ${photo.star} stars` : 'unrated'}`}
    />
  </button>

  {isSelected && (
    <div aria-label="Selected" role="img">
      <CheckIcon aria-hidden="true" />
    </div>
  )}
</article>
```

#### Search Component
```javascript
<form role="search" aria-label="Search photos">
  <label htmlFor="search-input">Search photos</label>
  <input
    id="search-input"
    type="search"
    aria-describedby="search-help"
    aria-invalid={hasError}
  />
  <span id="search-help">
    Search by file name, date, or tags
  </span>
  {hasError && (
    <div role="alert" aria-live="assertive">
      {errorMessage}
    </div>
  )}
</form>
```

### Step 2: Implement Keyboard Navigation

#### Global Keyboard Shortcuts
```javascript
// useKeyboardShortcuts.js
const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Navigation
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'Escape') closePhotoDisplay();

      // Selection (with Ctrl/Cmd)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }

      // Actions
      if (e.key === 'Delete') deleteSelected();
      if (e.key === ' ') {
        e.preventDefault();
        toggleSelection();
      }

      // Star rating (1-5 keys)
      if (/^[1-5]$/.test(e.key)) {
        setStarRating(parseInt(e.key));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [/* dependencies */]);
};
```

#### Focus Management
```javascript
// PhotoDetailPanel.jsx
const PhotoDetailPanel = ({ photo, onClose }) => {
  const closeButtonRef = useRef();

  // Focus close button when panel opens
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Focus trap
  const { trapRef } = useFocusTrap();

  return (
    <div ref={trapRef} role="dialog" aria-modal="true">
      <button
        ref={closeButtonRef}
        onClick={onClose}
        aria-label="Close photo details"
      >
        <CloseIcon aria-hidden="true" />
      </button>
      {/* photo details */}
    </div>
  );
};
```

#### Tab Navigation
```javascript
// Ensure logical tab order
<div className={styles.toolbar}>
  <button tabIndex={0}>Select All</button>
  <button tabIndex={0}>Delete</button>
  <button tabIndex={0}>Add to Album</button>
</div>
```

### Step 3: Improve Screen Reader Support

#### Announce Dynamic Content Changes
```javascript
// useAnnounce.js
const useAnnounce = () => {
  const [message, setMessage] = useState('');

  const announce = (text, priority = 'polite') => {
    setMessage('');
    setTimeout(() => setMessage(text), 100);
  };

  return {
    announce,
    announcer: (
      <div
        role="status"
        aria-live={priority}
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    )
  };
};

// Usage in PhotosList
const { announce, announcer } = useAnnounce();

useEffect(() => {
  if (photos.length > 0) {
    announce(`Loaded ${photos.length} photos`);
  }
}, [photos]);

return (
  <>
    {announcer}
    {/* rest of component */}
  </>
);
```

#### Descriptive Alt Text
```javascript
// Generate descriptive alt text
const getPhotoAltText = (photo) => {
  const parts = [photo.name];

  if (photo.date) {
    parts.push(`taken on ${formatDate(photo.date)}`);
  }

  if (photo.star) {
    parts.push(`rated ${photo.star} out of 5 stars`);
  }

  if (photo.tags?.length > 0) {
    parts.push(`tagged: ${photo.tags.join(', ')}`);
  }

  return parts.join(', ');
};
```

#### Loading States
```javascript
{isLoading ? (
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading photos"
  >
    <Spinner aria-hidden="true" />
    <span className="sr-only">Loading photos...</span>
  </div>
) : (
  <PhotosGrid photos={photos} />
)}
```

### Step 4: Ensure Color Contrast

#### Check Current Contrast Ratios
Use browser DevTools or online tools to verify:
- Normal text: 4.5:1 minimum
- Large text (18pt+): 3:1 minimum
- Interactive elements: 3:1 minimum

#### Fix Low Contrast Issues
```css
/* Before (low contrast) */
.photo-card {
  background: #1f2937; /* dark gray */
  color: #6b7280; /* medium gray - may not meet 4.5:1 */
}

/* After (sufficient contrast) */
.photo-card {
  background: #1f2937; /* dark gray */
  color: #e4e4e4; /* light gray - meets 4.5:1 */
}
```

#### Use CSS Variables for Consistent Contrast
```css
:root {
  --bg: #1f2937;
  --bg-elevated: #374151;
  --text: #f9fafb; /* High contrast */
  --text-secondary: #d1d5db; /* Medium contrast, still meets 4.5:1 */
  --border: #4b5563;
  --accent: #3b82f6;
}
```

### Step 5: Add Focus Indicators

#### Visible Focus Styles
```css
/* Global focus indicator */
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Custom focus for specific elements */
.photo-card:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 4px;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

#### Skip to Main Content
```javascript
// App.jsx
<>
  <a href="#main-content" className="skip-link">
    Skip to main content
  </a>

  <SideNav />

  <main id="main-content" tabIndex={-1}>
    <PhotosList />
  </main>
</>
```

```css
/* Skip link visible only on focus */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--accent);
  color: white;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

### Step 6: Implement Focus Trap for Modals

```javascript
// useFocusTrap.js
const useFocusTrap = () => {
  const trapRef = useRef();

  useEffect(() => {
    if (!trapRef.current) return;

    const focusableElements = trapRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    trapRef.current.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => {
      trapRef.current?.removeEventListener('keydown', handleTab);
    };
  }, []);

  return { trapRef };
};
```

### Step 7: Add Landmark Regions

```javascript
// App structure with landmarks
<div className="app">
  <header role="banner">
    <nav aria-label="Main navigation">
      {/* main nav */}
    </nav>
  </header>

  <aside role="complementary" aria-label="Sidebar">
    {/* sidebar */}
  </aside>

  <main role="main" aria-label="Photo gallery">
    <PhotosList />
  </main>

  <footer role="contentinfo">
    {/* footer */}
  </footer>
</div>
```

## Testing Strategy

### Automated Testing Tools

#### 1. axe DevTools (Browser Extension)
- Install axe DevTools extension
- Run accessibility audit on each page
- Fix all critical and serious issues

#### 2. Lighthouse (Chrome DevTools)
- Run Lighthouse accessibility audit
- Target score: 90+ (ideally 100)

#### 3. WAVE (Web Accessibility Evaluation Tool)
- Use WAVE browser extension
- Check for errors, alerts, and contrast issues

### Manual Testing

#### 1. Keyboard Navigation Testing
- [ ] Unplug mouse
- [ ] Navigate entire app with keyboard only
- [ ] Tab through all interactive elements
- [ ] Use arrow keys for navigation
- [ ] Test keyboard shortcuts
- [ ] Ensure all features accessible via keyboard

#### 2. Screen Reader Testing
- [ ] Test with NVDA (Windows, free)
- [ ] Test with JAWS (Windows, trial available)
- [ ] Test with VoiceOver (macOS, built-in)
- [ ] Verify all content is announced
- [ ] Verify dynamic changes are announced
- [ ] Verify images have meaningful alt text

#### 3. Zoom and Text Resize
- [ ] Zoom to 200% (browser zoom)
- [ ] Verify layout doesn't break
- [ ] Verify all text is readable
- [ ] Verify no horizontal scrolling (if possible)

#### 4. Color Contrast
- [ ] Use color contrast checker tool
- [ ] Verify all text meets 4.5:1 ratio
- [ ] Verify interactive elements are distinguishable
- [ ] Test in high contrast mode (Windows)

### WCAG 2.1 Level AA Checklist

#### Perceivable
- [ ] 1.1.1 Non-text Content: All images have alt text
- [ ] 1.3.1 Info and Relationships: Proper heading structure
- [ ] 1.3.2 Meaningful Sequence: Logical reading order
- [ ] 1.4.3 Contrast (Minimum): 4.5:1 for text
- [ ] 1.4.11 Non-text Contrast: 3:1 for UI components

#### Operable
- [ ] 2.1.1 Keyboard: All functionality via keyboard
- [ ] 2.1.2 No Keyboard Trap: Focus not trapped
- [ ] 2.4.3 Focus Order: Logical tab order
- [ ] 2.4.7 Focus Visible: Visible focus indicator

#### Understandable
- [ ] 3.1.1 Language of Page: Lang attribute set
- [ ] 3.2.1 On Focus: No context change on focus
- [ ] 3.3.1 Error Identification: Errors clearly identified
- [ ] 3.3.2 Labels or Instructions: Form fields labeled

#### Robust
- [ ] 4.1.2 Name, Role, Value: Proper ARIA usage
- [ ] 4.1.3 Status Messages: Dynamic content announced

## Expected Results

### Accessibility Score
- **Before**: Lighthouse score 60-70
- **After**: Lighthouse score 95-100

### Keyboard Navigation
- **Before**: Incomplete, inconsistent
- **After**: Full keyboard navigation, logical tab order

### Screen Reader Support
- **Before**: Minimal announcements
- **After**: Comprehensive screen reader support

### WCAG Compliance
- **Before**: Level A partial
- **After**: Level AA compliant

## Success Criteria
- [ ] Lighthouse accessibility score 95+
- [ ] Zero critical axe DevTools issues
- [ ] Full keyboard navigation support
- [ ] Screen reader announces all content correctly
- [ ] All color contrast ratios meet WCAG AA
- [ ] Focus indicators visible on all interactive elements
- [ ] ARIA labels and roles correctly implemented
- [ ] Keyboard shortcuts documented and functional
- [ ] Focus management works in modals/dialogs
- [ ] All images have descriptive alt text

## Related Work
- Can be implemented alongside other improvements
- Particularly important for production release
- Improves UX for all users, not just those with disabilities

## Notes
- Accessibility is not optional - it's a requirement
- Start with automated testing, then manual testing
- Test with actual screen readers, not just automated tools
- Involve users with disabilities in testing if possible
- Accessibility benefits everyone: better UX, better SEO, better code quality
- Consider creating an accessibility statement page
- Document keyboard shortcuts in help/settings
