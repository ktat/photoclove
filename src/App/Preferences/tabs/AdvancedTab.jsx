import React from 'react';
import { message } from '@tauri-apps/plugin-dialog';
import styles from '../Preferences.module.css';

const AdvancedTab = ({ config, setConfig, useCount }) => {
    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>Google Photos</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="google-auth-auto-reauth-check"
                        checked={config.google_auth_auto_reauth || false}
                        onChange={(e) => setConfig(prev => ({ ...prev, google_auth_auto_reauth: e.target.checked }))}
                    />
                    <label htmlFor="google-auth-auto-reauth-check">
                        Automatically prompt for Google Photos re-authentication on startup
                    </label>
                </div>
            </div>

            <h2 className={styles['section-title']}>Tutorial</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="preference-check"
                        value="1"
                        onChange={(e) => setConfig(prev => ({ ...prev, use_count: e.target.checked ? 0 : useCount }))}
                    />
                    <label htmlFor="preference-check">
                        Show Welcome tutorial again
                    </label>
                </div>
                <div className={styles['setting-row']}>
                    <label>Tab Instruction Tooltips:</label>
                    <button
                        className={styles['btn-secondary']}
                        onClick={() => {
                            localStorage.removeItem('photoclove_tutorials');
                            message("Tab instruction tooltips will be shown again.");
                        }}
                    >
                        Reset Tooltips
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdvancedTab;
