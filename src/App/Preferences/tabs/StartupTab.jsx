import React from 'react';
import StartupImageManager from '../../../components/StartupImageManager.jsx';
import styles from '../Preferences.module.css';

const StartupTab = ({ config, setConfig }) => {
    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>Startup Image Settings</h2>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                Choose what images are displayed when the application starts.
            </p>
            <StartupImageManager config={config} setConfig={setConfig} />
        </div>
    );
};

export default StartupTab;
