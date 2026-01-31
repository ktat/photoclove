import React from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import PickFolderSingle from '../../../FolderPicker.jsx';
import { supportedLanguages, changeLanguage } from '../../../i18n';
import styles from '../Preferences.module.css';

const GeneralTab = ({ config, setConfig, additionalExportFrom, setAdditionalExportFrom }) => {
    const { t, i18n } = useTranslation(['preferences', 'common']);

    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        changeLanguage(newLang);
    };

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>{t('preferences:general.language')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label className={styles['setting-label']}>{t('preferences:general.language')}</label>
                    <select
                        className={styles['setting-select']}
                        value={i18n.language}
                        onChange={handleLanguageChange}
                    >
                        {supportedLanguages.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                                {lang.flag} {lang.name}
                            </option>
                        ))}
                    </select>
                </div>
                <p className={styles['setting-description']}>
                    {t('preferences:general.languageDescription')}
                </p>
            </div>

            <h2 className={styles['section-title']}>Path Settings</h2>
            <div className={styles['setting-group']}>
                <PickFolderSingle
                    label="Data Path:"
                    folder={config.data_path}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, data_path: folder }))}
                />
                <PickFolderSingle
                    label="Trash Path:"
                    folder={config.trash_path}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, trash_path: folder }))}
                />
                <PickFolderSingle
                    label="Download Directory:"
                    folder={config.download_dir}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, download_dir: folder }))}
                />
                <PickFolderSingle
                    label="Import To:"
                    folder={config.import_to}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, import_to: folder }))}
                />
            </div>

            <h2 className={styles['section-title']}>Export From</h2>
            <div className={classNames(styles['setting-group'], styles['folder-list'])}>
                {config.export_from.map((v, i) => (
                    <PickFolderSingle
                        key={i}
                        label={i === 0 ? "Export From:" : ""}
                        folder={config.export_from[i]}
                        setFunc={(folder) => {
                            setConfig(prev => ({
                                ...prev,
                                export_from: prev.export_from.map((item, idx) =>
                                    idx === i ? folder : item
                                )
                            }))
                        }}
                    />
                ))}
                <div className={styles['add-export-path']}>
                    <button
                        className={styles['btn-secondary']}
                        onClick={() => setAdditionalExportFrom(additionalExportFrom + 1)}
                    >
                        + Add Path
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeneralTab;
