import { describe, it, expect } from 'vitest';
import { ViewMode } from '../domain/ViewMode.js';
import { VIEW_MODES } from '../constants/viewModes.js';

describe('ViewMode.getUnifiedPhotoParams()', () => {
    const mockAppConfig = { max_photos_per_fetch: 500 };

    describe('DATE mode', () => {
        it('should generate correct params for date mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.DATE, { date: '2023-12-25' });
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig, { sort_value: 1 });
            
            expect(params).toEqual({
                type: "search",
                search_type: "date",
                query: "2023-12-25",
                sort_value: 1,
                page: 1,
                limit: 500,
                offset: 0,
                star: -1,
                has_comment: false,
                extension: "all"
            });
        });

        it('should handle missing date', () => {
            const viewMode = new ViewMode(VIEW_MODES.DATE, {});
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("date");
            expect(params.query).toBeUndefined();
        });
    });

    describe('RECENT mode', () => {
        it('should generate correct params for recent mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("recent");
            expect(params.limit).toBe(500);
            expect(params.type).toBe("search");
        });

        it('should use default limit when appConfig is null', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams(null);
            
            expect(params.limit).toBe(1000);
        });
    });

    describe('ALBUM mode', () => {
        it('should generate correct params for album mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM, { albumId: 123 });
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("album_photos");
            expect(params.params).toEqual({ album_id: 123 });
            expect(params.type).toBe("search");
        });

        it('should handle missing albumId', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM, {});
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.params).toEqual({ album_id: undefined });
        });
    });

    describe('ALBUM_LIST mode', () => {
        it('should generate correct params for album list mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM_LIST);
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("all_albums");
            expect(params.type).toBe("search");
        });
    });

    describe('TAG mode', () => {
        it('should generate correct params for tag mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG, { tagId: 456 });
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("tag");
            expect(params.query).toBe("456");
        });

        it('should handle non-numeric tagId', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG, { tagId: "test-tag" });
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.query).toBe("test-tag");
        });

        it('should handle missing tagId', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG, {});
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.query).toBeUndefined();
        });
    });

    describe('TAG_LIST mode', () => {
        it('should generate correct params for tag list mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG_LIST);
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("all_tags_with_count");
            expect(params.type).toBe("search");
        });
    });

    describe('SEARCH mode', () => {
        it('should generate correct params for search mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.SEARCH, { 
                searchQuery: "vacation",
                searchParams: { location: "beach" }
            });
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("search");
            expect(params.query).toBe("vacation");
            expect(params.params).toEqual({ location: "beach" });
        });

        it('should handle missing search data', () => {
            const viewMode = new ViewMode(VIEW_MODES.SEARCH, {});
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("search");
            expect(params.query).toBeUndefined();
            expect(params.params).toBeUndefined();
        });
    });

    describe('ADVANCED_SEARCH mode', () => {
        it('should generate correct params for advanced search mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ADVANCED_SEARCH, { 
                searchQuery: "family",
                searchParams: { year: 2023, rating: 5 }
            });
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("search");
            expect(params.query).toBe("family");
            expect(params.params).toEqual({ year: 2023, rating: 5 });
        });
    });

    describe('TRASH mode', () => {
        it('should generate correct params for trash mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.TRASH);
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params.search_type).toBe("trash");
            expect(params.type).toBe("search");
        });
    });

    describe('Error handling', () => {
        it('should throw error for unsupported mode', () => {
            // This test requires bypassing the constructor validation
            // We'll test with HOME mode since it's not supported in getUnifiedPhotoParams
            const viewMode = new ViewMode(VIEW_MODES.HOME);
            
            expect(() => {
                viewMode.getUnifiedPhotoParams(mockAppConfig);
            }).toThrow('No photo params defined for mode: home');
        });
    });

    describe('Additional parameters', () => {
        it('should merge additional parameters correctly', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig, {
                sort_value: 2,
                star: 5,
                has_comment: true,
                extension: "jpg",
                page: 3,
                offset: 100
            });
            
            expect(params.sort_value).toBe(2);
            expect(params.star).toBe(5);
            expect(params.has_comment).toBe(true);
            expect(params.extension).toBe("jpg");
            expect(params.page).toBe(3);
            expect(params.offset).toBe(100);
        });

        it('should override base params with additional params', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig, {
                limit: 250
            });
            
            expect(params.limit).toBe(250); // Should override config limit
        });

        it('should use defaults when additional params are missing', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig, {});
            
            expect(params.sort_value).toBe(0);
            expect(params.page).toBe(1);
            expect(params.offset).toBe(0);
            expect(params.star).toBe(-1);
            expect(params.has_comment).toBe(false);
            expect(params.extension).toBe("all");
        });
    });

    describe('Config defaults', () => {
        it('should use default limit when config is missing', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams(null);
            
            expect(params.limit).toBe(1000);
        });

        it('should use config limit when available', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams({ max_photos_per_fetch: 250 });
            
            expect(params.limit).toBe(250);
        });

        it('should fallback to default when config limit is undefined', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams({ max_photos_per_fetch: undefined });
            
            expect(params.limit).toBe(1000);
        });

        it('should handle config with other properties but no limit', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams({ other_setting: true });
            
            expect(params.limit).toBe(1000);
        });
    });

    describe('Base parameter structure', () => {
        it('should always include required base parameters', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(params).toHaveProperty('type');
            expect(params).toHaveProperty('sort_value');
            expect(params).toHaveProperty('page');
            expect(params).toHaveProperty('limit');
            expect(params).toHaveProperty('offset');
            expect(params).toHaveProperty('star');
            expect(params).toHaveProperty('has_comment');
            expect(params).toHaveProperty('extension');
            expect(params).toHaveProperty('search_type');
        });

        it('should have correct base parameter types', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            const params = viewMode.getUnifiedPhotoParams(mockAppConfig);
            
            expect(typeof params.type).toBe('string');
            expect(typeof params.sort_value).toBe('number');
            expect(typeof params.page).toBe('number');
            expect(typeof params.limit).toBe('number');
            expect(typeof params.offset).toBe('number');
            expect(typeof params.star).toBe('number');
            expect(typeof params.has_comment).toBe('boolean');
            expect(typeof params.extension).toBe('string');
            expect(typeof params.search_type).toBe('string');
        });
    });
});

describe('ViewMode.getModeTitle()', () => {
    describe('Static titles', () => {
        it('should return correct title for ALBUM_LIST mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM_LIST);
            expect(viewMode.getModeTitle()).toBe('Albums');
        });

        it('should return correct title for TAG_LIST mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG_LIST);
            expect(viewMode.getModeTitle()).toBe('Tags');
        });

        it('should return correct title for TRASH mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.TRASH);
            expect(viewMode.getModeTitle()).toBe('Trash');
        });

        it('should return correct title for SEARCH mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.SEARCH);
            expect(viewMode.getModeTitle()).toBe('Search Results');
        });

        it('should return correct title for ADVANCED_SEARCH mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ADVANCED_SEARCH);
            expect(viewMode.getModeTitle()).toBe('Advanced Search');
        });

        it('should return correct title for RECENT mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            expect(viewMode.getModeTitle()).toBe('Recent Photos');
        });

        it('should return correct title for HOME mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.HOME);
            expect(viewMode.getModeTitle()).toBe('Home');
        });

        it('should return correct title for IMPORT mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.IMPORT);
            expect(viewMode.getModeTitle()).toBe('Import');
        });

        it('should return correct title for PREFERENCES mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.PREFERENCES);
            expect(viewMode.getModeTitle()).toBe('Preferences');
        });

        it('should return correct title for JOB_QUEUE mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.JOB_QUEUE);
            expect(viewMode.getModeTitle()).toBe('Job Queue');
        });

        it('should return correct title for LOGIN mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.LOGIN);
            expect(viewMode.getModeTitle()).toBe('Login');
        });
    });

    describe('Dynamic titles', () => {
        it('should return date for DATE mode when date is provided', () => {
            const viewMode = new ViewMode(VIEW_MODES.DATE, { date: '2023-12-25' });
            expect(viewMode.getModeTitle()).toBe('2023-12-25');
        });

        it('should return fallback for DATE mode when date is missing', () => {
            const viewMode = new ViewMode(VIEW_MODES.DATE);
            expect(viewMode.getModeTitle()).toBe('Photos');
        });

        it('should return album name for ALBUM mode when provided', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM, { albumName: 'Vacation 2023' });
            expect(viewMode.getModeTitle()).toBe('Vacation 2023');
        });

        it('should return fallback for ALBUM mode when name is missing', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM);
            expect(viewMode.getModeTitle()).toBe('Album');
        });

        it('should return tag name for TAG mode when provided', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG, { tagName: 'Landscape' });
            expect(viewMode.getModeTitle()).toBe('Landscape');
        });

        it('should return fallback for TAG mode when name is missing', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG);
            expect(viewMode.getModeTitle()).toBe('Tag');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty string data gracefully', () => {
            const viewMode = new ViewMode(VIEW_MODES.DATE, { date: '' });
            expect(viewMode.getModeTitle()).toBe('Photos');
        });

        it('should handle null data gracefully', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM, { albumName: null });
            expect(viewMode.getModeTitle()).toBe('Album');
        });

        it('should handle undefined data gracefully', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG, { tagName: undefined });
            expect(viewMode.getModeTitle()).toBe('Tag');
        });

        it('should return default title for fallback case', () => {
            // Test the default case by examining HOME mode which uses default
            const viewMode = new ViewMode(VIEW_MODES.HOME);
            // HOME mode should return 'Home' not 'Photos' based on implementation
            expect(viewMode.getModeTitle()).toBe('Home');
        });
    });

    describe('Data consistency', () => {
        it('should return consistent titles for same mode and data', () => {
            const viewMode1 = new ViewMode(VIEW_MODES.DATE, { date: '2023-12-25' });
            const viewMode2 = new ViewMode(VIEW_MODES.DATE, { date: '2023-12-25' });
            
            expect(viewMode1.getModeTitle()).toBe(viewMode2.getModeTitle());
        });

        it('should return different titles for different data', () => {
            const viewMode1 = new ViewMode(VIEW_MODES.DATE, { date: '2023-12-25' });
            const viewMode2 = new ViewMode(VIEW_MODES.DATE, { date: '2023-12-26' });
            
            expect(viewMode1.getModeTitle()).not.toBe(viewMode2.getModeTitle());
        });

        it('should handle special characters in dynamic titles', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM, { albumName: 'Summer \'23 & Friends!' });
            expect(viewMode.getModeTitle()).toBe('Summer \'23 & Friends!');
        });

        it('should handle unicode characters in dynamic titles', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG, { tagName: '風景写真 🌸' });
            expect(viewMode.getModeTitle()).toBe('風景写真 🌸');
        });
    });
});

describe('ViewMode.getModeConfig()', () => {
    describe('Album List mode configuration', () => {
        it('should enable create button for ALBUM_LIST mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM_LIST);
            const config = viewMode.getModeConfig();
            
            expect(config.showCreateButton).toBe(true);
            expect(config.allowSelection).toBe(false); // Not photoViewingMode
            expect(config.showSearchBar).toBe(false); // Not searchMode
            expect(config.showBulkOperations).toBe(true); // Is listMode
        });
    });

    describe('Tag List mode configuration', () => {
        it('should enable create button for TAG_LIST mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG_LIST);
            const config = viewMode.getModeConfig();
            
            expect(config.showCreateButton).toBe(true);
            expect(config.allowSelection).toBe(false); // Not photoViewingMode
            expect(config.showSearchBar).toBe(false); // Not searchMode
            expect(config.showBulkOperations).toBe(true); // Is listMode
        });
    });

    describe('Photo viewing modes configuration', () => {
        const photoViewingModes = [
            VIEW_MODES.DATE,
            VIEW_MODES.RECENT,
            VIEW_MODES.ALBUM,
            VIEW_MODES.TAG,
            VIEW_MODES.TRASH
        ];

        photoViewingModes.forEach(mode => {
            it(`should enable photo selection for ${mode} mode`, () => {
                const viewMode = new ViewMode(mode);
                const config = viewMode.getModeConfig();
                
                expect(config.allowSelection).toBe(true);
                expect(config.canViewMetadata).toBe(true);
                expect(config.enablePhotoNavigation).toBe(true);
                expect(config.showBulkOperations).toBe(true);
            });
        });
    });

    describe('Search modes configuration', () => {
        it('should enable search bar for SEARCH mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.SEARCH);
            const config = viewMode.getModeConfig();
            
            expect(config.showSearchBar).toBe(true);
            expect(config.allowSelection).toBe(true);
            expect(config.canViewMetadata).toBe(true);
            expect(config.enablePhotoNavigation).toBe(true);
        });

        it('should enable search bar for ADVANCED_SEARCH mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ADVANCED_SEARCH);
            const config = viewMode.getModeConfig();
            
            expect(config.showSearchBar).toBe(true);
            expect(config.allowSelection).toBe(true);
            expect(config.canViewMetadata).toBe(true);
            expect(config.enablePhotoNavigation).toBe(true);
        });
    });

    describe('Trash mode configuration', () => {
        it('should enable trash operations for TRASH mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.TRASH);
            const config = viewMode.getModeConfig();
            
            expect(config.showTrashOperations).toBe(true);
            expect(config.allowSelection).toBe(true);
            expect(config.canViewMetadata).toBe(true);
            expect(config.enablePhotoNavigation).toBe(true);
            expect(config.showBulkOperations).toBe(true);
        });
    });

    describe('Album mode configuration', () => {
        it('should enable album operations for ALBUM mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM);
            const config = viewMode.getModeConfig();
            
            expect(config.showAlbumOperations).toBe(true);
            expect(config.allowSelection).toBe(true);
            expect(config.canViewMetadata).toBe(true);
            expect(config.enablePhotoNavigation).toBe(true);
        });
    });

    describe('Import mode configuration', () => {
        it('should enable import operations for IMPORT mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.IMPORT);
            const config = viewMode.getModeConfig();
            
            expect(config.showImportOperations).toBe(true);
            expect(config.showBulkOperations).toBe(false); // Import is not photoViewingMode nor listMode
            expect(config.allowSelection).toBe(false); // Import is not photoViewingMode
            expect(config.canViewMetadata).toBe(false); // Import is not photoViewingMode
        });
    });

    describe('Non-interactive modes configuration', () => {
        const nonInteractiveModes = [
            { mode: VIEW_MODES.HOME, name: 'HOME' },
            { mode: VIEW_MODES.PREFERENCES, name: 'PREFERENCES' },
            { mode: VIEW_MODES.LOGIN, name: 'LOGIN' },
            { mode: VIEW_MODES.JOB_QUEUE, name: 'JOB_QUEUE' }
        ];

        nonInteractiveModes.forEach(({ mode, name }) => {
            it(`should disable most features for ${name} mode`, () => {
                const viewMode = new ViewMode(mode);
                const config = viewMode.getModeConfig();
                
                expect(config.allowSelection).toBe(false);
                expect(config.canViewMetadata).toBe(false);
                expect(config.enablePhotoNavigation).toBe(false);
                expect(config.showCreateButton).toBe(false);
                expect(config.showSearchBar).toBe(false);
                expect(config.showTrashOperations).toBe(false);
                expect(config.showAlbumOperations).toBe(false);
                expect(config.showImportOperations).toBe(false);
                expect(config.showBulkOperations).toBe(false);
            });
        });
    });

    describe('Configuration consistency', () => {
        it('should return object with all expected properties', () => {
            const viewMode = new ViewMode(VIEW_MODES.DATE);
            const config = viewMode.getModeConfig();
            
            expect(config).toHaveProperty('showCreateButton');
            expect(config).toHaveProperty('showSearchBar');
            expect(config).toHaveProperty('allowSelection');
            expect(config).toHaveProperty('canViewMetadata');
            expect(config).toHaveProperty('canEdit');
            expect(config).toHaveProperty('showTrashOperations');
            expect(config).toHaveProperty('showAlbumOperations');
            expect(config).toHaveProperty('showImportOperations');
            expect(config).toHaveProperty('enablePhotoNavigation');
            expect(config).toHaveProperty('showBulkOperations');
        });

        it('should return boolean values for all config properties', () => {
            const viewMode = new ViewMode(VIEW_MODES.DATE);
            const config = viewMode.getModeConfig();
            
            Object.values(config).forEach(value => {
                expect(typeof value).toBe('boolean');
            });
        });

        it('should return consistent structure for sample modes', () => {
            const sampleModes = [VIEW_MODES.DATE, VIEW_MODES.ALBUM_LIST, VIEW_MODES.TRASH];
            const expectedKeys = [
                'showCreateButton',
                'showSearchBar', 
                'allowSelection',
                'canViewMetadata',
                'canEdit',
                'showTrashOperations',
                'showAlbumOperations',
                'showImportOperations',
                'enablePhotoNavigation',
                'showBulkOperations'
            ];

            sampleModes.forEach(mode => {
                const viewMode = new ViewMode(mode);
                const config = viewMode.getModeConfig();
                
                expectedKeys.forEach(key => {
                    expect(config).toHaveProperty(key);
                    expect(typeof config[key]).toBe('boolean');
                });
            });
        });
    });

    describe('Mode combinations and logic', () => {
        it('should not show create button for photo viewing modes', () => {
            const photoModes = [VIEW_MODES.DATE, VIEW_MODES.RECENT, VIEW_MODES.ALBUM, VIEW_MODES.TAG, VIEW_MODES.TRASH];
            
            photoModes.forEach(mode => {
                const viewMode = new ViewMode(mode);
                const config = viewMode.getModeConfig();
                expect(config.showCreateButton).toBe(false);
            });
        });

        it('should show create button only for list modes', () => {
            const listModes = [VIEW_MODES.ALBUM_LIST, VIEW_MODES.TAG_LIST];
            
            listModes.forEach(mode => {
                const viewMode = new ViewMode(mode);
                const config = viewMode.getModeConfig();
                expect(config.showCreateButton).toBe(true);
            });
        });

        it('should show search bar only for search modes', () => {
            const searchModes = [VIEW_MODES.SEARCH, VIEW_MODES.ADVANCED_SEARCH];
            
            searchModes.forEach(mode => {
                const viewMode = new ViewMode(mode);
                const config = viewMode.getModeConfig();
                expect(config.showSearchBar).toBe(true);
            });
        });

        it('should show trash operations only for TRASH mode', () => {
            // Test TRASH mode shows trash operations
            const trashMode = new ViewMode(VIEW_MODES.TRASH);
            expect(trashMode.getModeConfig().showTrashOperations).toBe(true);
            
            // Test other modes don't show trash operations
            const otherModes = [VIEW_MODES.DATE, VIEW_MODES.ALBUM, VIEW_MODES.HOME];
            otherModes.forEach(mode => {
                const viewMode = new ViewMode(mode);
                expect(viewMode.getModeConfig().showTrashOperations).toBe(false);
            });
        });

        it('should show album operations only for ALBUM mode', () => {
            // Test ALBUM mode shows album operations
            const albumMode = new ViewMode(VIEW_MODES.ALBUM);
            expect(albumMode.getModeConfig().showAlbumOperations).toBe(true);
            
            // Test other modes don't show album operations
            const otherModes = [VIEW_MODES.DATE, VIEW_MODES.TRASH, VIEW_MODES.HOME];
            otherModes.forEach(mode => {
                const viewMode = new ViewMode(mode);
                expect(viewMode.getModeConfig().showAlbumOperations).toBe(false);
            });
        });

        it('should show import operations only for IMPORT mode', () => {
            // Test IMPORT mode shows import operations
            const importMode = new ViewMode(VIEW_MODES.IMPORT);
            expect(importMode.getModeConfig().showImportOperations).toBe(true);
            
            // Test other modes don't show import operations  
            const otherModes = [VIEW_MODES.DATE, VIEW_MODES.TRASH, VIEW_MODES.HOME];
            otherModes.forEach(mode => {
                const viewMode = new ViewMode(mode);
                expect(viewMode.getModeConfig().showImportOperations).toBe(false);
            });
        });
    });

    describe('Feature flag combinations', () => {
        it('should enable metadata and navigation together for photo viewing modes', () => {
            const photoViewingModes = [VIEW_MODES.DATE, VIEW_MODES.RECENT, VIEW_MODES.ALBUM, VIEW_MODES.TAG, VIEW_MODES.TRASH];
            
            photoViewingModes.forEach(mode => {
                const viewMode = new ViewMode(mode);
                const config = viewMode.getModeConfig();
                
                // These should be consistent
                expect(config.canViewMetadata).toBe(config.enablePhotoNavigation);
                expect(config.allowSelection).toBe(true);
            });
        });

        it('should disable selection when metadata is disabled', () => {
            const nonPhotoModes = [VIEW_MODES.HOME, VIEW_MODES.PREFERENCES, VIEW_MODES.LOGIN, VIEW_MODES.IMPORT];
            
            nonPhotoModes.forEach(mode => {
                const viewMode = new ViewMode(mode);
                const config = viewMode.getModeConfig();
                
                if (!config.canViewMetadata) {
                    expect(config.allowSelection).toBe(false);
                }
            });
        });
    });
});

describe('ViewMode.shouldShowSideMenuByDefault()', () => {
    describe('Modes that should show side menu by default', () => {
        it('should return true for SEARCH mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.SEARCH);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(true);
        });

        it('should return true for ADVANCED_SEARCH mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ADVANCED_SEARCH);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(true);
        });

        it('should return true for IMPORT mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.IMPORT);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(true);
        });
    });

    describe('Modes that should not show side menu by default', () => {
        it('should return false for DATE mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.DATE);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(false);
        });

        it('should return false for RECENT mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.RECENT);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(false);
        });

        it('should return false for ALBUM mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(false);
        });

        it('should return false for TAG mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(false);
        });

        it('should return false for TRASH mode (canEdit is false)', () => {
            const viewMode = new ViewMode(VIEW_MODES.TRASH);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(false);
        });

        it('should return false for ALBUM_LIST mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.ALBUM_LIST);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(false);
        });

        it('should return false for TAG_LIST mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.TAG_LIST);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(false);
        });

        it('should return false for HOME mode', () => {
            const viewMode = new ViewMode(VIEW_MODES.HOME);
            expect(viewMode.shouldShowSideMenuByDefault()).toBe(false);
        });
    });

    describe('Logic verification', () => {
        it('should respect canEdit permission', () => {
            // TRASH mode: isSearchMode is false, but canEdit is also false
            const trashMode = new ViewMode(VIEW_MODES.TRASH);
            expect(trashMode.getModeConfig().canEdit).toBe(false);
            expect(trashMode.shouldShowSideMenuByDefault()).toBe(false);
        });

        it('should only show for search and import modes when canEdit is true', () => {
            const modes = [
                { mode: VIEW_MODES.SEARCH, expected: true },
                { mode: VIEW_MODES.ADVANCED_SEARCH, expected: true },
                { mode: VIEW_MODES.IMPORT, expected: true },
                { mode: VIEW_MODES.DATE, expected: false },
                { mode: VIEW_MODES.RECENT, expected: false },
                { mode: VIEW_MODES.ALBUM, expected: false },
                { mode: VIEW_MODES.TAG, expected: false },
                { mode: VIEW_MODES.TRASH, expected: false },
            ];

            modes.forEach(({ mode, expected }) => {
                const viewMode = new ViewMode(mode);
                expect(viewMode.shouldShowSideMenuByDefault()).toBe(expected);
            });
        });
    });
});