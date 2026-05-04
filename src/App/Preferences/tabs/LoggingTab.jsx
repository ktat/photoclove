import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Preferences.module.css';

const LoggingTab = ({ config, setConfig }) => {
    const { t } = useTranslation(['preferences', 'common']);

    return (
        <div className={styles['preferences-section']}>
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
                        {t('preferences:logging.enableLogging')}
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
        </div>
    );
};

export default LoggingTab;
