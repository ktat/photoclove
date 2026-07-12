import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Preferences.module.css';

const PerformanceTab = ({ config, setConfig }) => {
    const { t } = useTranslation(['preferences']);

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>⚡ {t('preferences:performance.parallelProcessing')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>{t('preferences:performance.copyParallel')}:</label>
                    <input
                        value={config.copy_parallel || ''}
                        type="number"
                        step="1"
                        onChange={(e) => setConfig(prev => ({ ...prev, copy_parallel: e.target.value }))}
                    />
                </div>
                <div className={styles['setting-row']}>
                    <label>{t('preferences:performance.thumbnailParallel')}:</label>
                    <input
                        value={config.thumbnail_parallel || ''}
                        type="number"
                        step="1"
                        onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_parallel: e.target.value }))}
                    />
                </div>
            </div>

            <h2 className={styles['section-title']}>📊 {t('preferences:performance.display')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>{t('preferences:performance.maxPhotosPerFetch')}:</label>
                    <input
                        value={config.max_photos_per_fetch || ''}
                        type="number"
                        step="100"
                        min="100"
                        onChange={(e) => setConfig(prev => ({ ...prev, max_photos_per_fetch: e.target.value }))}
                    />
                </div>
            </div>

            <h2 className={styles['section-title']}>View Cache</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label>Cache Keys (max):</label>
                    <input
                        value={config.view_cache_max_keys ?? ''}
                        type="number"
                        step="1"
                        min="1"
                        onChange={(e) => setConfig(prev => ({ ...prev, view_cache_max_keys: Number(e.target.value) }))}
                    />
                </div>
                <div className={styles['setting-row']}>
                    <label>Total Photos (max):</label>
                    <input
                        value={config.view_cache_max_total_photos ?? ''}
                        type="number"
                        step="1000"
                        min="100"
                        onChange={(e) => setConfig(prev => ({ ...prev, view_cache_max_total_photos: Number(e.target.value) }))}
                    />
                </div>
                <p className={styles['setting-description']}>
                    Caches up to N view-mode snapshots (album/tag/search/etc.) so switching back is instant. Older snapshots are evicted when either limit is exceeded.
                </p>
            </div>

            <h2 className={styles['section-title']}>🖼️ {t('preferences:performance.photoViewer')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="progressive-image-loading-check"
                        checked={config.progressive_image_loading || false}
                        onChange={(e) => setConfig(prev => ({ ...prev, progressive_image_loading: e.target.checked }))}
                    />
                    <label htmlFor="progressive-image-loading-check">
                        {t('preferences:performance.progressiveLoading')}
                    </label>
                </div>
                <p className={styles['setting-description']}>
                    {t('preferences:performance.progressiveLoadingDescription')}
                </p>
            </div>
        </div>
    );
};

export default PerformanceTab;
