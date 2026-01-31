import React from 'react';
import { message } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import styles from '../Preferences.module.css';

const AdvancedTab = ({ config, setConfig, useCount }) => {
    const { t } = useTranslation(['preferences', 'common']);

    return (
        <div className={styles['preferences-section']}>
            {/* Performance Section */}
            <h2 className={styles['section-title']}>⚡ {t('preferences:performance.parallelProcessing')}</h2>
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

            <h2 className={styles['section-title']}>📊 Display</h2>
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

            <h2 className={styles['section-title']}>🖼️ Photo Viewer</h2>
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

            {/* Logging Section */}
            <h2 className={styles['section-title']}>📝 {t('preferences:tabs.logging')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="logging-enabled-check"
                        checked={config.logging_enabled || false}
                        onChange={(e) => setConfig(prev => ({ ...prev, logging_enabled: e.target.checked }))}
                    />
                    <label htmlFor="logging-enabled-check">
                        {t('preferences:logging.logLevel')}
                    </label>
                </div>
                <div className={styles['setting-row']}>
                    <label>{t('preferences:logging.logLevel')}:</label>
                    <select
                        value={config.logging_level || 'info'}
                        onChange={(e) => setConfig(prev => ({ ...prev, logging_level: e.target.value }))}
                        disabled={!config.logging_enabled}
                    >
                        <option value="debug">{t('preferences:logging.logLevelDebug')}</option>
                        <option value="info">{t('preferences:logging.logLevelInfo')}</option>
                        <option value="warn">{t('preferences:logging.logLevelWarn')}</option>
                        <option value="error">{t('preferences:logging.logLevelError')}</option>
                    </select>
                </div>
            </div>

            {/* Google Photos Section */}
            <h2 className={styles['section-title']}>📤 Google Photos</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="google-auth-auto-reauth-check"
                        checked={config.google_auth_auto_reauth || false}
                        onChange={(e) => setConfig(prev => ({ ...prev, google_auth_auto_reauth: e.target.checked }))}
                    />
                    <label htmlFor="google-auth-auto-reauth-check">
                        🔄 Automatically prompt for Google Photos re-authentication on startup
                    </label>
                </div>
            </div>

            {/* Tutorial Section */}
            <h2 className={styles['section-title']}>📚 {t('preferences:tabs.advanced')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="preference-check"
                        value="1"
                        onChange={(e) => setConfig(prev => ({ ...prev, use_count: e.target.checked ? 0 : useCount }))}
                    />
                    <label htmlFor="preference-check">
                        👋 {t('preferences:advanced.showWelcomeTutorial')}
                    </label>
                </div>
                <div className={styles['setting-row']}>
                    <label>💡 {t('preferences:advanced.resetTutorials')}:</label>
                    <button
                        className={styles['btn-secondary']}
                        onClick={() => {
                            localStorage.removeItem('photoclove_tutorials');
                            message(t('preferences:advanced.resetTutorialsDescription'));
                        }}
                    >
                        🔄 {t('common:button.reset')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdvancedTab;
