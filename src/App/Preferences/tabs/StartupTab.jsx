import React from 'react';
import { useTranslation } from 'react-i18next';
import StartupImageManager from '../../../components/StartupImageManager.jsx';
import styles from '../Preferences.module.css';

const StartupTab = ({ config, setConfig }) => {
    const { t } = useTranslation('preferences');

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>{t('startup.startupBehavior')}</h2>
            <StartupImageManager config={config} setConfig={setConfig} />
        </div>
    );
};

export default StartupTab;
