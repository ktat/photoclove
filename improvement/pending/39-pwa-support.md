# Implement Progressive Web App (PWA) Support

## Problem
PhotoClove is currently desktop-only via Tauri, limiting accessibility and use cases:
- No mobile or tablet support for photo management
- Cannot access photos on-the-go from mobile devices
- Missing offline capabilities for viewing cached photos
- No push notifications for import completion
- Limited sharing capabilities compared to mobile apps

## Opportunity Analysis
PhotoClove has strong foundation for PWA conversion:
- React frontend already structured
- Local-first data approach with SQLite
- Modern build system with Vite
- Component-based architecture suitable for responsive design

## Proposed Solution

### 1. Create PWA-Compatible Web Version
Develop a web version alongside the desktop Tauri app with shared React components.

**Architecture Approach:**
- **Shared Components**: Reuse existing React components
- **Platform Abstraction**: Abstract Tauri calls behind a service layer
- **Progressive Enhancement**: Full features on desktop, core features on web
- **Responsive Design**: Adapt UI for mobile and tablet screens

**Files to create:**
- `src/services/platformService.js` - Abstract platform-specific calls
- `src/web/` - Web-specific components and configurations
- `public/manifest.json` - PWA manifest
- `public/sw.js` - Service worker

### 2. Implement Platform Abstraction Layer
Create an abstraction layer to handle differences between Tauri and web environments.

```js
// src/services/platformService.js
class PlatformService {
  constructor() {
    this.isTauri = window.__TAURI__ !== undefined;
    this.isWeb = !this.isTauri;
  }

  async invoke(command, args = {}) {
    if (this.isTauri) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke(command, args);
    } else {
      // Web API calls to backend service
      return this.webApiCall(command, args);
    }
  }

  async webApiCall(command, args) {
    const response = await fetch(`/api/${command}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }
    
    return response.text();
  }

  async openFile(path) {
    if (this.isTauri) {
      const { open } = await import('@tauri-apps/plugin-opener');
      return open(path);
    } else {
      // Web file handling (download, preview, etc.)
      window.open(`/api/file/${encodeURIComponent(path)}`);
    }
  }

  async selectDirectory() {
    if (this.isTauri) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      return open({ directory: true });
    } else {
      // Web Directory API (where supported) or fallback
      if ('showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker();
        return dirHandle.name;
      } else {
        throw new Error('Directory selection not supported in this browser');
      }
    }
  }
}

export const platformService = new PlatformService();
```

### 3. Create Web Backend Service
Develop a lightweight web server that provides similar APIs to Tauri commands.

**Technology Options:**
- **Node.js + Express**: Simple REST API server
- **Rust + Axum**: Reuse existing Rust code
- **Python + FastAPI**: Quick development option

**Example with Node.js:**
```js
// web-server/index.js
const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./photos.db');

app.use(express.json());
app.use(express.static('dist'));

// API endpoints that mirror Tauri commands
app.post('/api/get_photos_with_filter', (req, res) => {
  const { dateStr, page, sortValue, num, star, hasComment, extension } = req.body;
  
  db.all(
    `SELECT * FROM photos WHERE date = ? ORDER BY photo_date DESC LIMIT ? OFFSET ?`,
    [dateStr, num, (page - 1) * num],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ photos: rows, has_next: rows.length === num, has_prev: page > 1 });
      }
    }
  );
});

app.post('/api/get_dates', (req, res) => {
  db.all(
    `SELECT DISTINCT date FROM photos ORDER BY date DESC`,
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

// File serving with appropriate headers
app.get('/api/file/:path(*)', (req, res) => {
  const filePath = decodeURIComponent(req.params.path);
  const fullPath = path.resolve(filePath);
  
  // Security check - ensure path is within allowed directories
  if (isPathAllowed(fullPath)) {
    res.sendFile(fullPath);
  } else {
    res.status(403).json({ error: 'Access denied' });
  }
});
```

### 4. Implement Service Worker for Offline Support
Add offline capabilities for viewing cached photos and metadata.

```js
// public/sw.js
const CACHE_NAME = 'photoclove-v1';
const STATIC_CACHE = 'photoclove-static-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // CSS and JS bundles will be added by build process
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Handle API calls
  if (request.url.includes('/api/')) {
    event.respondWith(
      caches.open(CACHE_NAME)
        .then(cache => {
          return fetch(request)
            .then(response => {
              // Cache successful API responses
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => {
              // Fallback to cache when offline
              return cache.match(request);
            });
        })
    );
  }
  
  // Handle static assets
  else {
    event.respondWith(
      caches.match(request)
        .then(response => response || fetch(request))
    );
  }
});
```

### 5. Add Mobile-Responsive UI Components
Create mobile-optimized versions of key components.

**Files to create:**
- `src/components/mobile/MobilePhotoGrid.jsx`
- `src/components/mobile/MobileNavigation.jsx`
- `src/components/mobile/TouchGestures.jsx`

```jsx
// src/components/mobile/MobilePhotoGrid.jsx
const MobilePhotoGrid = ({ photos, onPhotoSelect }) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      // Handle swipe left (next photo)
    }
    if (isRightSwipe) {
      // Handle swipe right (previous photo)
    }
  };

  return (
    <div 
      className="mobile-photo-grid"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {photos.map((photo, index) => (
        <div key={photo.file.path} className="mobile-photo-item">
          <img 
            src={photo.thumbnailUrl} 
            alt={photo.file.name}
            onClick={() => onPhotoSelect(photo, index)}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
};
```

### 6. Implement Push Notifications
Add notifications for completed operations and updates.

```js
// src/services/notificationService.js
class NotificationService {
  constructor() {
    this.registration = null;
  }

  async initialize() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      
      if ('Notification' in window) {
        await this.requestPermission();
      }
    }
  }

  async requestPermission() {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async showNotification(title, options = {}) {
    if (this.registration && Notification.permission === 'granted') {
      await this.registration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        ...options,
      });
    }
  }

  async notifyImportComplete(count) {
    await this.showNotification('Import Complete', {
      body: `Successfully imported ${count} photos`,
      tag: 'import-complete',
      actions: [
        { action: 'view', title: 'View Photos' },
        { action: 'close', title: 'Close' },
      ],
    });
  }
}

export const notificationService = new NotificationService();
```

## Implementation Plan

### Phase 1: Platform Abstraction (3 days)
1. Create platform service abstraction layer
2. Update existing components to use platform service
3. Test compatibility with Tauri version
4. Create web-specific API interfaces

### Phase 2: Web Backend (4 days)
1. Implement Node.js/Express API server
2. Create database access layer for web
3. Implement file serving with security
4. Add authentication and session management

### Phase 3: PWA Infrastructure (2 days)
1. Create PWA manifest and service worker
2. Implement offline caching strategy
3. Add installation prompts
4. Test offline functionality

### Phase 4: Mobile UI (3 days)
1. Create responsive design system
2. Implement touch gestures and mobile navigation
3. Optimize for mobile performance
4. Add mobile-specific components

### Phase 5: Advanced Features (2 days)
1. Implement push notifications
2. Add background sync capabilities
3. Create share targets
4. Add mobile-specific features

## Benefits
- **Accessibility**: Access photos from any device
- **Offline Capability**: View cached photos without internet
- **Mobile Experience**: Native-like mobile photo management
- **Installation**: Add to home screen like native app
- **Push Notifications**: Stay informed of background operations
- **Sharing**: Better integration with mobile sharing systems

## Technical Considerations

### Security
- Implement proper authentication for web access
- Secure file access with path validation
- Use HTTPS for all communications
- Implement CORS policies

### Performance
- Optimize for mobile networks with image compression
- Implement intelligent caching strategies
- Use lazy loading and virtual scrolling
- Minimize bundle size for faster loading

### Browser Support
- Target modern browsers with ES6+ support
- Provide graceful degradation for older browsers
- Handle browser-specific APIs (File System Access, etc.)
- Test across major mobile browsers

## Files to Create
- `src/services/platformService.js`
- `src/web/` directory with web-specific components
- `web-server/` directory with Node.js backend
- `public/manifest.json`
- `public/sw.js`
- Mobile-optimized component variants

## Files to Modify
- All components using Tauri APIs
- Build configuration for web deployment
- Package.json with web build scripts
- Vite config for PWA support

## Implementation Priority
**PRIORITY 7 - MEDIUM** - Expands platform reach but requires significant development effort

## Estimated Effort
High (14 days)
- Platform abstraction: 3 days
- Web backend: 4 days
- PWA infrastructure: 2 days
- Mobile UI: 3 days
- Advanced features: 2 days