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

            <h2 className={styles['section-title']}>{t('preferences:general.folders')}</h2>
            <div className={styles['setting-group']}>
                <PickFolderSingle
                    label={t('common:button.import') + ':'}
                    folder={config.import_to}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, import_to: folder }))}
                />
                <PickFolderSingle
                    label={t('common:navigation.trash') + ':'}
                    folder={config.trash_path}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, trash_path: folder }))}
                />
                <PickFolderSingle
                    label={t('common:button.download') + ':'}
                    folder={config.download_dir}
                    setFunc={(folder) => setConfig(prev => ({ ...prev, download_dir: folder }))}
                />
            </div>

            <h2 className={styles['section-title']}>{t('preferences:general.importSource')}</h2>
            <div className={classNames(styles['setting-group'], styles['folder-list'])}>
                {config.export_from.map((v, i) => (
                    <PickFolderSingle
                        key={i}
                        label={i === 0 ? t('preferences:general.importSource') + ':' : ''}
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
                        + {t('common:button.add')}
                    </button>
                </div>
            </div>

            <h2 className={styles['section-title']}>{t('preferences:general.sharing')}</h2>
            <div className={styles['setting-group']}>
                <div className={styles['setting-row']}>
                    <label className={styles['setting-label']}>{t('preferences:general.customWatermark')}</label>
                    <input
                        type="text"
                        className={styles['setting-input']}
                        value={config.custom_watermark || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, custom_watermark: e.target.value }))}
                        placeholder={t('preferences:general.customWatermarkPlaceholder')}
                        maxLength={50}
                    />
                </div>
                <p className={styles['setting-description']}>
                    {t('preferences:general.customWatermarkDescription')}
                </p>
                <div className={styles['setting-row']}>
                    <label className={styles['setting-label']}>{t('preferences:general.copyright')}</label>
                    <input
                        type="text"
                        className={styles['setting-input']}
                        value={config.copyright || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, copyright: e.target.value }))}
                        placeholder={t('preferences:general.copyrightPlaceholder')}
                        maxLength={100}
                    />
                </div>
                <p className={styles['setting-description']}>
                    {t('preferences:general.copyrightDescription')}
                </p>
            </div>
        </div>
    );
};

export default GeneralTab;
