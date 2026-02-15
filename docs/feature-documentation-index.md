# PhotoClove Documentation Index

This index helps you quickly navigate to the right documentation for PhotoClove development and usage.

## Quick Navigation

### For Developers
- **[Feature Quick Reference](feature-quick-reference.md)** - Find documentation by feature/component
- **[API Reference](api-reference.md)** - Backend commands and implementation guides
- **[Source Tree Structure](source-tree.md)** - Complete codebase organization and file locations
- **[Troubleshooting Guide](guides/troubleshooting-guide.md)** - Debug common issues

### Architecture & Design
- **[System Architecture](architecture.md)** - Overall system design and components
- **[Screen Transition Diagram](screen-transition-diagram.md)** - Visual navigation flow
- **[Component Structure](component-structure.md)** - React component hierarchy and HTML structure overview
  - **[Main Screens HTML](html-structure/main-screens.md)** - Welcome, Home, Photo Grid, Full-Screen Display
  - **[Photo Editor & Info HTML](html-structure/photo-editor.md)** - PhotoEditor and PhotoInfo panels
  - **[Sidebar Panels HTML](html-structure/sidebar-panels.md)** - DirectoryMenu and Log Viewer
  - **[Import & Preferences HTML](html-structure/import-preferences.md)** - Import, Preferences, Job Queue
  - **[CSS Reference](css-reference.md)** - Complete CSS class reference
- **[Database Schema](database-schema.md)** - SQLite table structure

### Specialized Topics
- **[State Management Guide](guides/state-management-guide.md)** - React state architecture
- **[OAuth Token Management](guides/oauth-token-management.md)** - Google authentication
- **[Configuration Guide](guides/configuration.md)** - Application settings and preferences
- **[Terms and Source Mapping](terms.md)** - Feature names to file mapping
- **[PhotosList Modes](photoslist-modes-operations.md)** - Photo view modes
- **[CSS Design System](css-reference.md)** - CSS variables, themes, and styling guidelines
- **[AI Auto-Tagging](../improvement/179-ai-auto-tagging-update.md)** - AI-powered photo tagging with multiple models
- **[S3 Backup](guides/configuration.md#s3-backup-settings)** - Cloud backup to S3-compatible storage
- **[Recovery Queue](feature-quick-reference.md#recovery-queue)** - Failed operation tracking and retry
- **[Burst Photo Grouping](feature-quick-reference.md#burst-photo-grouping)** - Group photos taken in rapid succession
- **[Achievements System](feature-quick-reference.md#achievements-system)** - Gamification with unlockable achievements
- **[Photography Insights](feature-quick-reference.md#photography-insights-dashboard)** - Analytics and statistics dashboard
- **[Slideshow Mode](feature-quick-reference.md#slideshow-mode)** - Photo presentation with background music
- **[Internationalization](feature-quick-reference.md#internationalization-i18n)** - Multi-language support (7 languages)
- **[HEIC/HEIF/AVIF Support](feature-quick-reference.md#heicheifavif-format-support)** - iPhone/modern camera format support with libheif-rs
- **[RAW File Support](feature-quick-reference.md#raw-file-support)** - RAW format support (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, 3FR)
- **[Custom React Dialogs](feature-quick-reference.md#custom-react-dialogs)** - Native dialog replacement with custom React components
- **[Relative Path Storage](feature-quick-reference.md#relative-path-storage)** - Cross-OS NAS support with relative paths in DB
- **[Notification Center](feature-quick-reference.md#notification-center)** - Notification bell with center modal
- **[Share & Collage](feature-quick-reference.md#-share-tab-photo-sharing--collage)** - Photo sharing with watermarks, collage creation, and PNG metadata

### Development Workflows
- **[Feature Sequences](feature-sequences.md)** - Frontend/backend interaction flows

## Documentation Organization

- **Root level**: Core architecture and reference documents
- **`guides/`**: Step-by-step guides and tutorials

This structure provides focused, specialized documents organized by purpose for efficient development and maintenance.