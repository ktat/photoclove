import React from 'react';
import styles from '../Preferences.module.css';

const LoggingTab = ({ config, setConfig }) => {
    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>Logging Configuration</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="logging-enabled-check"
                        checked={config.logging_enabled || false}
                        onChange={(e) => setConfig(prev => ({ ...prev, logging_enabled: e.target.checked }))}
                    />
                    <label htmlFor="logging-enabled-check">
                        Enable debug logging
                    </label>
                </div>
                <div className={styles['setting-row']}>
                    <label>Log Level:</label>
                    <select
                        value={config.logging_level || 'info'}
                        onChange={(e) => setConfig(prev => ({ ...prev, logging_level: e.target.value }))}
                        disabled={!config.logging_enabled}
                    >
                        <option value="debug">Debug</option>
                        <option value="info">Info</option>
                        <option value="warn">Warning</option>
                        <option value="error">Error</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default LoggingTab;
