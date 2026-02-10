/**
 * ImportState - Import functionality state management entity
 * Centralizes all import-related state and operations
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { logger } from '../services/LoggerService.js';

export class ImportState {
    constructor() {
        this.currentImportPath = '';
        this.importPaths = [];
        this.directories = [];
        this.importFilter = '';
        this.importProgress = null;
        this.isImporting = false;
        this.selectedPhotos = [];

        // Quick View: target file to auto-open in PhotoViewer after photos load
        this.targetFile = null;

        // Cached show_importer response to avoid duplicate backend calls
        this._cachedImporterData = null;
        this._cachedImporterPath = null;
        this._cachedImporterFilter = null;

        // Event callbacks
        this.onDirectoryChange = null;
        this.onImportPhotos = null;
        this.onImportFilterChange = null;
        this.onProgressUpdate = null;
        
        // Event listeners
        this.unlistenProgress = null;
        this.unlistenImportFinish = null;
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Normalize relative paths to absolute paths
     */
    normalizePath(path) {
        if (!path) return '';
        
        // If path is already absolute, return as-is
        if (path.startsWith('/')) {
            // Handle relative path segments like /../ and /./
            const parts = path.split('/').filter(part => part !== '');
            const normalized = [];
            
            for (const part of parts) {
                if (part === '..') {
                    if (normalized.length > 0) {
                        normalized.pop();
                    }
                } else if (part !== '.') {
                    normalized.push(part);
                }
            }
            
            return '/' + normalized.join('/');
        }
        
        // For relative paths, combine with current directory
        return this.normalizePath(this.currentImportPath + '/' + path);
    }

    /**
     * Get parent directory of current path
     */
    getParentDirectory() {
        if (!this.currentImportPath || this.currentImportPath === '/') {
            return '/';
        }
        
        const parts = this.currentImportPath.split('/').filter(part => part !== '');
        if (parts.length === 0) {
            return '/';
        }
        
        parts.pop(); // Remove last directory
        return parts.length === 0 ? '/' : '/' + parts.join('/');
    }

    /**
     * Setup event listeners for import progress
     */
    async setupEventListeners() {
        try {
            // Listen for import_progress events from JobQueue
            this.unlistenProgress = await listen('import_progress', (event) => {
                const [jobUnitId, currentFile, progress] = event.payload;
                
                logger.info('ImportState', 'import_progress_event', 'Received import progress event', {
                    jobUnitId,
                    currentFile,
                    progress: Math.round(progress)
                });
                
                this.importProgress = {
                    now_importing: progress < 100,
                    progress: Math.round(progress),
                    current_file: currentFile,
                    job_unit_id: jobUnitId,
                    num: 100, // Percentage based
                    num_per_sec: 0 // Will calculate if needed
                };
                
                // Trigger callback if set
                if (this.onProgressUpdate) {
                    this.onProgressUpdate(this.importProgress);
                }
            });
            
            // Listen for import finish event
            this.unlistenImportFinish = await listen('import', (event) => {
                if (event.payload === 'finish') {
                    logger.info('ImportState', 'import_finish_event', 'Import finished');
                    
                    this.isImporting = false;
                    this.importProgress = {
                        now_importing: false,
                        progress: 100,
                        current_file: '',
                        start_time: { secs_since_epoch: Date.now() / 1000 }
                    };
                    
                    // Trigger callback if set
                    if (this.onProgressUpdate) {
                        this.onProgressUpdate(this.importProgress);
                    }
                }
            });
            
            logger.info('ImportState', 'event_listeners_setup', 'Event listeners setup successfully');
            
        } catch (error) {
            logger.error('ImportState', 'event_listeners_setup_failed', 'Failed to setup event listeners', {
                error: error.message
            });
        }
    }

    /**
     * Cleanup event listeners
     */
    cleanup() {
        if (this.unlistenProgress) {
            this.unlistenProgress();
            this.unlistenProgress = null;
        }
        if (this.unlistenImportFinish) {
            this.unlistenImportFinish();
            this.unlistenImportFinish = null;
        }
        
        logger.info('ImportState', 'cleanup', 'Event listeners cleaned up');
    }

    /**
     * Initialize import state with initial data
     */
    async initialize(initialPath) {
        try {
            logger.info('ImportState', 'initialize', 'Initializing import state', { initialPath });

            if (initialPath) {
                // CLI Quick View mode: go directly to the specified path
                // If initialPath is a file, store it for auto-open and use parent directory
                if (this._isFilePath(initialPath)) {
                    this.targetFile = initialPath;
                    logger.info('ImportState', 'target_file_detected', 'Initial path is a file, will auto-open in viewer', {
                        targetFile: initialPath
                    });
                }
                await this.changeDirectory(initialPath);
                // Use resolved currentImportPath (parent dir if file was passed)
                this.importPaths = [this.currentImportPath];
            } else {
                // Normal mode: get initial import paths using show_importer with empty path
                const result = await invoke('show_importer', {
                    pathStr: "",
                    page: 1,
                    num: 1
                });
                const data = JSON.parse(result);

                this.importPaths = data.paths || [];
                if (this.importPaths.length > 0) {
                    await this.changeDirectory(this.importPaths[0]);
                }
            }

            logger.info('ImportState', 'initialized', 'Import state initialized', {
                pathsCount: this.importPaths.length,
                currentPath: this.currentImportPath,
                initialPath
            });

        } catch (error) {
            logger.error('ImportState', 'initialize_failed', 'Failed to initialize import state', {
                error: error.message,
                initialPath
            });
            throw error;
        }
    }

    /**
     * Change current directory and load its contents
     */
    async changeDirectory(newPath) {
        try {
            logger.info('ImportState', 'change_directory', 'Changing import directory', {
                fromPath: this.currentImportPath,
                toPath: newPath
            });

            // Load directory contents with pagination (reduced from 1000 to 100 for performance)
            const result = await invoke('show_importer', {
                pathStr: newPath,
                page: 1,
                num: 100,  // Reduced to prevent loading too many full-size images at once
                dateStr: this.importFilter
            });
            
            const importerData = JSON.parse(result);

            // Use the normalized path from the API response if available, otherwise normalize the input path
            const normalizedPath = importerData.dirs_files?.dir?.path || this.normalizePath(newPath);
            this.currentImportPath = normalizedPath;
            this.directories = importerData.dirs_files?.dirs?.dirs || [];

            // Cache full response to avoid duplicate show_importer call from fetchImportPhotos
            this._cachedImporterData = importerData;
            this._cachedImporterPath = normalizedPath;
            this._cachedImporterFilter = this.importFilter;

            // Debug: Log full structure for troubleshooting
            logger.debug('ImportState', 'directory_structure_debug', 'Full directory structure from show_importer', {
                rawImporterData: importerData,
                dirsFilesStructure: importerData.dirs_files,
                extractedDirectories: this.directories,
                directoryCount: this.directories.length
            });
            
            // Trigger callback if set
            if (this.onDirectoryChange) {
                this.onDirectoryChange(this);
            }
            
            logger.info('ImportState', 'directory_changed', 'Directory changed successfully', {
                inputPath: newPath,
                normalizedPath: normalizedPath,
                parentDirectory: this.getParentDirectory(),
                isRoot: normalizedPath === '/',
                directoriesCount: this.directories.length,
                directoryNames: this.directories.map(d => d.name || d.path || d)
            });

        } catch (error) {
            logger.error('ImportState', 'change_directory_failed', 'Failed to change directory', {
                path: newPath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Update import filter (date filter)
     */
    async updateImportFilter(newFilter) {
        try {
            logger.info('ImportState', 'update_filter', 'Updating import filter', {
                oldFilter: this.importFilter,
                newFilter
            });

            this.importFilter = newFilter;
            
            // Reload current directory with new filter
            if (this.currentImportPath) {
                await this.changeDirectory(this.currentImportPath);
            }
            
            // Trigger callback if set
            if (this.onImportFilterChange) {
                this.onImportFilterChange(this);
            }

        } catch (error) {
            logger.error('ImportState', 'update_filter_failed', 'Failed to update import filter', {
                filter: newFilter,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Import selected photos using JobQueue system
     */
    async importPhotos(photoSelection) {
        try {
            const count = photoSelection.length;
            logger.info('ImportState', 'import_photos_start', 'Starting photo import', {
                photoCount: count,
                currentPath: this.currentImportPath
            });

            this.isImporting = true;
            this.selectedPhotos = photoSelection;
            
            // Initialize progress tracking
            this.importProgress = {
                now_importing: true,
                progress: 0,
                current_file: '',
                job_unit_id: null,
                num: 0,
                num_per_sec: 0,
                start_time: { secs_since_epoch: Date.now() / 1000 }
            };
            
            // Convert photo selection to file paths array
            const filePaths = photoSelection.map(photo => {
                // Handle both formats: direct strings or photo objects with file.path
                if (typeof photo === 'string') {
                    return photo;
                } else if (photo.file && photo.file.path) {
                    return photo.file.path;
                } else if (photo.path) {
                    return photo.path;
                } else {
                    logger.warn('ImportState', 'invalid_photo_format', 'Invalid photo format in selection', { photo });
                    return null;
                }
            }).filter(path => path !== null);

            logger.debug('ImportState', 'prepared_file_paths', 'Prepared file paths for import', {
                originalCount: photoSelection.length,
                processedCount: filePaths.length,
                filePaths: filePaths.slice(0, 5) // Log first 5 for debugging
            });
            
            // Start import process via JobQueue - returns job_unit_id
            const jobUnitId = await invoke('import_photos', {
                files: filePaths
            });

            // Store job unit ID for progress tracking
            this.importProgress.job_unit_id = jobUnitId;
            
            logger.info('ImportState', 'import_jobs_submitted', 'Import jobs submitted to queue', {
                photoCount: count,
                jobUnitId: jobUnitId
            });

            // Trigger callback if set
            if (this.onImportPhotos) {
                this.onImportPhotos(this, { job_unit_id: jobUnitId });
            }

            // Note: Don't set isImporting = false here as the job is still processing
            // The import_progress and import events will handle completion
            
            return { job_unit_id: jobUnitId };

        } catch (error) {
            this.isImporting = false;
            this.importProgress = null;
            logger.error('ImportState', 'import_photos_failed', 'Failed to start import', {
                photoCount: photoSelection.length,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Update import progress
     */
    updateProgress(progressData) {
        this.importProgress = progressData;
        
        if (this.onProgressUpdate) {
            this.onProgressUpdate(this);
        }
    }

    /**
     * Consume cached show_importer response if it matches the requested path/filter.
     * Returns cached data and clears the cache (one-time use).
     */
    consumeCachedImporterData(path, filter) {
        if (
            this._cachedImporterData &&
            this._cachedImporterPath === path &&
            this._cachedImporterFilter === (filter || '')
        ) {
            const data = this._cachedImporterData;
            this._cachedImporterData = null;
            this._cachedImporterPath = null;
            this._cachedImporterFilter = null;
            logger.debug('ImportState', 'cache_hit', 'Using cached show_importer response');
            return data;
        }
        return null;
    }

    /**
     * Get current state as plain object (for props passing)
     */
    getState() {
        return {
            currentImportPath: this.currentImportPath,
            importPaths: this.importPaths,
            directories: this.directories,
            importFilter: this.importFilter,
            importProgress: this.importProgress,
            isImporting: this.isImporting,
            selectedPhotos: this.selectedPhotos
        };
    }

    /**
     * Get available operations based on current state
     */
    getAvailableOperations() {
        const operations = [];
        
        if (this.selectedPhotos.length > 0) {
            operations.push({
                id: 'import_selected',
                label: `Import ${this.selectedPhotos.length} Selected Photos`,
                action: () => this.importPhotos(this.selectedPhotos)
            });
        }
        
        if (this.currentImportPath) {
            operations.push({
                id: 'select_all_directory',
                label: 'Select All in This Directory',
                action: () => this.selectAllInDirectory()
            });
        }
        
        operations.push({
            id: 'unselect_all',
            label: 'Unselect All',
            action: () => this.clearSelection()
        });
        
        return operations;
    }

    /**
     * Select all photos in current directory
     */
    selectAllInDirectory() {
        // This would need to be implemented with PhotosList integration
        logger.info('ImportState', 'select_all_directory', 'Selecting all photos in directory', {
            currentPath: this.currentImportPath
        });
    }

    /**
     * Clear photo selection
     */
    clearSelection() {
        this.selectedPhotos = [];
        logger.info('ImportState', 'clear_selection', 'Cleared photo selection');
    }

    /**
     * Check if a path looks like a file (has an image extension)
     */
    _isFilePath(path) {
        if (!path) return false;
        return /\.(jpe?g|png|gif|webp|heic|heif|cr2|cr3|nef|arw|dng|raf|orf|rw2|3fr|tiff?)$/i.test(path);
    }

    /**
     * Factory method to create initialized ImportState
     */
    static async create(initialPath) {
        const importState = new ImportState();
        await importState.initialize(initialPath);
        return importState;
    }
}