import React from 'react';
import styles from '../Preferences.module.css';

const PerformanceTab = ({ config, setConfig }) => {
    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>Parallel Processing</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>Import Parallel:</label>
                    <input
                        value={config.copy_parallel || ''}
                        type="number"
                        step="1"
                        onChange={(e) => setConfig(prev => ({ ...prev, copy_parallel: e.target.value }))}
                    />
                </div>
                <div className={styles['setting-row']}>
                    <label>Thumbnail Parallel:</label>
                    <input
                        value={config.thumbnail_parallel || ''}
                        type="number"
                        step="1"
                        onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_parallel: e.target.value }))}
                    />
                </div>
            </div>

            <h2 className={styles['section-title']}>Display</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>Max Photos Per Fetch:</label>
                    <input
                        value={config.max_photos_per_fetch || ''}
                        type="number"
                        step="100"
                        min="100"
                        onChange={(e) => setConfig(prev => ({ ...prev, max_photos_per_fetch: e.target.value }))}
                    />
                </div>
            </div>

            <h2 className={styles['section-title']}>Photo Viewer</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="progressive-image-loading-check"
                        checked={config.progressive_image_loading || false}
                        onChange={(e) => setConfig(prev => ({ ...prev, progressive_image_loading: e.target.checked }))}
                    />
                    <label htmlFor="progressive-image-loading-check">
                        Progressive image loading (show thumbnail first during navigation)
                    </label>
                </div>
                <p className={styles['setting-description']}>
                    When enabled, shows thumbnail immediately while navigating photos, then loads full image after navigation stops. Improves responsiveness during rapid navigation.
                </p>
            </div>
        </div>
    );
};

export default PerformanceTab;
