# PhotoClove Improvement Plans

This directory contains improvement plans for refactoring, optimization, and enhancement of the PhotoClove codebase.

## Active Improvements

### High Priority (Critical & Blocking Issues)

- **#85** - Fix Import Mode Thumbnail Scrolling Issue (Continuation)
  - **Status**: WIP - Images disappearing on scroll
  - **Priority**: Critical
  - **Blocks**: Import mode functionality
  - **Related**: #83 (done)

- **#84** - Refactor PhotosList.jsx - Phase 1 (Extract Photo Actions)
  - **Current**: 1,902 lines (2nd largest JavaScript file)
  - **Target**: ~1,200 lines
  - **Priority**: High
  - **Effort**: Medium
  - **Impact**: Core component cleanup, enables other refactorings

### Refactoring (Large Files > 1000 lines)

- **#86** - Refactor lib.rs - Extract Command Modules
  - **Current**: 2,906 lines with 75 commands
  - **Target**: ~200-300 lines main file + 8 command modules
  - **Effort**: Large
  - **Impact**: Much better organization, reduced merge conflicts

- **#87** - Refactor meta_db/sqlite.rs - Split Repository Methods
  - **Current**: 3,829 lines (largest file!)
  - **Target**: ~200 lines main + 7 repository modules
  - **Effort**: Very Large
  - **Impact**: Cleaner architecture, better testability

- **#88** - Refactor PhotoEditor.jsx - Extract Utilities and Components
  - **Current**: 1,292 lines
  - **Target**: ~300-400 lines main + 6 modules
  - **Effort**: Medium
  - **Impact**: Reusable utilities, better separation of concerns

- **#89** - Refactor DirectoryMenu.jsx - Extract Menu Components
  - **Current**: 966 lines
  - **Target**: ~200-300 lines main + 5 modules
  - **Effort**: Medium
  - **Impact**: Better modularity

- **#90** - Refactor PhotosListMini.jsx - Extract Photo Display Logic
  - **Current**: 833 lines
  - **Target**: ~200-300 lines main + 5 modules
  - **Effort**: Medium
  - **Impact**: Cleaner photo viewer component

### Infrastructure & Quality

- **#91** - Add Performance Monitoring and Optimization
  - **Priority**: High
  - **Effort**: Large
  - **Impact**: Better performance, data-driven optimization

- **#93** - Comprehensive Test Coverage
  - **Current**: <10% coverage (2 test files)
  - **Target**: >80% coverage
  - **Effort**: Very Large
  - **Impact**: Confidence in refactoring, regression prevention

- **#94** - Improve Error Handling and User Feedback
  - **Priority**: High
  - **Effort**: Medium
  - **Impact**: Better UX, easier debugging

- **#95** - Documentation Improvement - Architecture and Developer Guide
  - **Priority**: Medium
  - **Effort**: Large
  - **Impact**: Easier onboarding, better maintainability

- **#96** - Accessibility (a11y) Improvements
  - **Priority**: Medium
  - **Effort**: Large
  - **Impact**: WCAG 2.1 AA compliance, better UX for all users

## Completed Improvements

See `improvement/done/` directory for completed improvements:
- **#83** - File size reduction (CSS refactoring)
- **#88** - PhotoEditor.jsx refactoring (1,292 → 980 lines)

## Implementation Order Recommendation

### Phase 1: Critical Fixes & High-Impact Refactoring (2-3 weeks)
1. **#85** - Fix import mode thumbnail scrolling (highest priority - blocking)
2. **#84** - Refactor PhotosList.jsx (high priority - core component)
3. **#94** - Improve error handling (prevents future issues)

### Phase 2: Backend Refactoring (3-4 weeks)
4. **#86** - Extract lib.rs command modules (breaks monolith)
5. **#87** - Split meta_db/sqlite.rs repositories (largest file)

### Phase 3: Frontend Refactoring (2-3 weeks)
6. **#88** - Extract PhotoEditor utilities
7. **#89** - Extract DirectoryMenu components
8. **#90** - Extract PhotosListMini components

### Phase 4: Infrastructure (2-3 weeks)
9. **#91** - Add performance monitoring
10. **#93** - Add comprehensive tests
11. **#95** - Improve documentation

### Phase 5: Polish (1-2 weeks)
12. **#96** - Accessibility improvements

## File Size Summary

### Current Large Files (Need Refactoring)
| File | Lines | Target | Priority | Status |
|------|-------|--------|----------|--------|
| src-tauri/src/repository/meta_db/sqlite.rs | 3,829 | ~200 | High | Pending |
| src-tauri/src/lib.rs | 2,906 | ~300 | High | Pending |
| src/App/PhotosList.jsx | 1,902 | ~1,200 | Medium | Pending |
| ~~src/App/PhotosList/PhotoOption/PhotoEditor.jsx~~ | ~~1,292~~ → 980 | ~400 | Medium | ✅ Done (#88) |
| src/App/PhotosList/DirectoryMenu.jsx | 966 | ~300 | Low | Pending |
| src/App/PhotosList/PhotosListMini.jsx | 833 | ~300 | Low | Pending |

### Total Lines to Refactor
- **Before**: 11,728 lines in 6 files
- **After**: 10,436 lines (PhotoEditor done: 980 + 561 utils)
- **Completed**: PhotoEditor.jsx (#88) - 24% reduction
- **Remaining**: ~2,400 lines in main files + ~50 focused modules
- **Target Reduction**: ~80% reduction in main file sizes

## Guidelines

### Before Starting an Improvement
1. Read the improvement plan carefully
2. Check for dependencies on other improvements
3. Create a feature branch: `improvement-XX-description`
4. Update the improvement plan if approach changes

### During Implementation
1. Follow coding conventions in docs/development/coding-conventions.md
2. Add tests for new code
3. Update documentation
4. Use structured logging (LoggerService)
5. Run `cargo check` for Rust changes
6. Run `npm run build` for JavaScript changes

### After Completion
1. Verify all tests pass
2. Update improvement plan with "Completed" status
3. Move plan to `improvement/done/XX-description.md`
4. Create PR with reference to improvement number
5. Update this README if needed

## Notes

- Keep existing functionality working during refactoring
- Refactoring should not change behavior (only structure)
- Write tests before refactoring when possible
- Large refactorings should be done in multiple PRs
- Document design decisions in improvement plans

## Contributing

See CONTRIBUTING.md for general contribution guidelines.

For improvement-specific questions, refer to the individual improvement plan files.
