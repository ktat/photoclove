import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from 'react-i18next';
import { logger } from "../../../services/LoggerService.js";
import styles from '../Preferences.module.css';
import {
    STORAGE_PROVIDERS,
    MAX_FILE_SIZE_OPTIONS,
    getRegionsForStorageType,
    parseBucketUri,
    buildBucketUri
} from './S3Constants.js';
import { useS3BackupHandlers } from './hooks/useS3BackupHandlers.js';
import S3AuthenticationSection from './S3AuthenticationSection.jsx';

function S3BackupTab({ config, setConfig, addFooterMessage }) {
    const { t } = useTranslation('preferences');
    const [awsProfiles, setAwsProfiles] = useState(['default']);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [syncStats, setSyncStats] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [accessKeyId, setAccessKeyId] = useState('');
    const [secretAccessKey, setSecretAccessKey] = useState('');
    const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
    const [credentialsPreview, setCredentialsPreview] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const [customRegion, setCustomRegion] = useState('');

    // Get S3 config with defaults
    const s3Config = config.s3 || {
        enabled: false,
        storage_type: 'aws_s3',
        bucket_uri: '',
        region: 'ap-northeast-1',
        auth_method: 'aws_credentials',
        profile: null,
        custom_endpoint: null,
        auto_sync: false,
        backup_db: true,
        backup_thumbnails: true,
        max_file_size_mb: null,
        last_sync_at: null
    };

    // Parse bucket URI into bucket name and prefix
    const { bucketName, prefix } = parseBucketUri(s3Config.bucket_uri);

    // Check if current region is in the predefined list, if not, set as custom region
    useEffect(() => {
        const regions = getRegionsForStorageType(s3Config.storage_type);
        const regionExists = regions.some(r => r.id === s3Config.region);
        if (!regionExists && s3Config.region) {
            setCustomRegion(s3Config.region);
        } else {
            setCustomRegion('');
        }
    }, [s3Config.storage_type, s3Config.region]);

    // Load AWS profiles on mount
    useEffect(() => {
        const loadProfiles = async () => {
            try {
                const result = await invoke("list_aws_profiles");
                const profiles = JSON.parse(result);
                setAwsProfiles(profiles);
                logger.debug('S3BackupTab', 'profiles_loaded', 'AWS profiles loaded', { count: profiles.length });
            } catch (error) {
                logger.error('S3BackupTab', 'profiles_load_error', 'Failed to load AWS profiles', { error });
            }
        };
        loadProfiles();
    }, []);

    // Check if credentials are stored for the current provider
    useEffect(() => {
        const checkCredentials = async () => {
            try {
                const result = await invoke("get_s3_credentials_preview", { provider: s3Config.storage_type });
                const data = JSON.parse(result);
                setHasStoredCredentials(data.has_credentials);
                setCredentialsPreview(data.access_key_preview);
            } catch (error) {
                logger.error('S3BackupTab', 'check_credentials_error', 'Failed to check credentials', { error });
            }
        };
        checkCredentials();
    }, [s3Config.storage_type]);

    // Load sync stats when enabled
    useEffect(() => {
        if (s3Config.enabled) {
            loadSyncStats();
        }
    }, [s3Config.enabled]);

    const loadSyncStats = async () => {
        try {
            const result = await invoke("get_s3_sync_stats");
            const stats = JSON.parse(result);
            setSyncStats(stats);
        } catch (error) {
            logger.error('S3BackupTab', 'sync_stats_error', 'Failed to load sync stats', { error });
        }
    };

    const updateS3Config = (updates) => {
        // Auto-set auth_method when storage_type changes
        if (updates.storage_type) {
            if (updates.storage_type === 'aws_s3') {
                updates = { ...updates, auth_method: updates.auth_method || 'aws_credentials' };
            } else {
                updates = { ...updates, auth_method: 'access_key' };
            }
        }

        setConfig(prev => ({
            ...prev,
            s3: { ...s3Config, ...updates }
        }));
    };

    const updateBucketName = (newBucketName) => {
        const bucket_uri = buildBucketUri(newBucketName, prefix);
        updateS3Config({ bucket_uri });
    };

    const updatePrefix = (newPrefix) => {
        const bucket_uri = buildBucketUri(bucketName, newPrefix);
        updateS3Config({ bucket_uri });
    };

    const selectedProvider = STORAGE_PROVIDERS.find(p => p.id === s3Config.storage_type) || STORAGE_PROVIDERS[0];

    // Handler functions from hook
    const { handleTestConnection, handleFullSync, handleSaveCredentials, handleDeleteCredentials } = useS3BackupHandlers({
        t,
        s3Config,
        addFooterMessage,
        setTestResult,
        setIsTesting,
        setStatusMessage,
        setIsSyncing,
        accessKeyId,
        secretAccessKey,
        setHasStoredCredentials,
        setAccessKeyId,
        setSecretAccessKey,
        setCredentialsPreview,
        selectedProvider
    });
    const showEndpointField = selectedProvider.hasEndpoint || s3Config.storage_type === 'custom';
    const showProfileSelector = s3Config.storage_type === 'aws_s3' && s3Config.auth_method === 'aws_credentials';
    const needsAccessKey = s3Config.storage_type !== 'aws_s3' || s3Config.auth_method === 'access_key';
    const regions = getRegionsForStorageType(s3Config.storage_type);

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>{t('s3Backup.title')}</h2>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                {t('s3Backup.description')}
            </p>

            {/* Main Toggle */}
            <div className={styles['setting-group']}>
                <div className={styles['setting-item']}>
                    <input
                        type="checkbox"
                        id="s3-enabled"
                        checked={s3Config.enabled}
                        onChange={(e) => updateS3Config({ enabled: e.target.checked })}
                    />
                    <label htmlFor="s3-enabled">{t('s3Backup.enable')}</label>
                </div>
            </div>

            {s3Config.enabled && (
                <>
                    {/* Storage Provider */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>{t('s3Backup.storageProvider')}</h3>
                        <div className={styles['setting-row']}>
                            <label>{t('s3Backup.provider')}</label>
                            <select
                                value={s3Config.storage_type}
                                onChange={(e) => updateS3Config({ storage_type: e.target.value })}
                                style={{ width: '200px' }}
                            >
                                {STORAGE_PROVIDERS.map(provider => (
                                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Storage Settings */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>{t('s3Backup.storageSettings')}</h3>

                        {showEndpointField && (
                            <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                                <label>{t('s3Backup.endpointUrl')}</label>
                                <input
                                    type="text"
                                    value={s3Config.custom_endpoint || ''}
                                    onChange={(e) => updateS3Config({ custom_endpoint: e.target.value || null })}
                                    placeholder="https://s3.example.com"
                                    style={{ width: '300px' }}
                                />
                            </div>
                        )}

                        <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                            <label>{t('s3Backup.bucketName')}</label>
                            <input
                                type="text"
                                value={bucketName}
                                onChange={(e) => updateBucketName(e.target.value)}
                                placeholder="my-bucket"
                                style={{ width: '300px' }}
                            />
                        </div>

                        <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                            <label>{t('s3Backup.prefix')}</label>
                            <div style={{ width: '300px' }}>
                                <input
                                    type="text"
                                    value={prefix}
                                    onChange={(e) => updatePrefix(e.target.value)}
                                    placeholder="photos/backup"
                                    style={{ width: '100%' }}
                                />
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                    {t('s3Backup.prefixDescription')}
                                </div>
                            </div>
                        </div>

                        <div className={styles['setting-row']}>
                            <label>{t('s3Backup.region')}</label>
                            <div style={{ width: '300px' }}>
                                <select
                                    value={customRegion ? '' : s3Config.region}
                                    onChange={(e) => {
                                        setCustomRegion('');
                                        updateS3Config({ region: e.target.value });
                                    }}
                                    disabled={customRegion !== ''}
                                    style={{ width: '100%', opacity: customRegion ? 0.6 : 1 }}
                                >
                                    {regions.map(region => (
                                        <option key={region.id} value={region.id}>{region.label}</option>
                                    ))}
                                </select>
                                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    {t('s3Backup.customRegionHint')}
                                </div>
                                <input
                                    type="text"
                                    value={customRegion}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setCustomRegion(value);
                                        if (value) {
                                            updateS3Config({ region: value });
                                        }
                                    }}
                                    placeholder="e.g., us-west-3, eu-south-2"
                                    style={{ width: '100%', marginTop: 'var(--space-1)' }}
                                />
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                    {t('s3Backup.customRegionDescription')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Authentication */}
                    <S3AuthenticationSection
                        t={t}
                        s3Config={s3Config}
                        updateS3Config={updateS3Config}
                        awsProfiles={awsProfiles}
                        showProfileSelector={showProfileSelector}
                        needsAccessKey={needsAccessKey}
                        selectedProvider={selectedProvider}
                        hasStoredCredentials={hasStoredCredentials}
                        credentialsPreview={credentialsPreview}
                        accessKeyId={accessKeyId}
                        setAccessKeyId={setAccessKeyId}
                        secretAccessKey={secretAccessKey}
                        setSecretAccessKey={setSecretAccessKey}
                        handleSaveCredentials={handleSaveCredentials}
                        handleDeleteCredentials={handleDeleteCredentials}
                    />

                    {/* Sync Options */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>{t('s3Backup.syncOptions')}</h3>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-auto-sync"
                                checked={s3Config.auto_sync}
                                onChange={(e) => updateS3Config({ auto_sync: e.target.checked })}
                            />
                            <label htmlFor="s3-auto-sync">{t('s3Backup.autoSync')}</label>
                        </div>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-backup-db"
                                checked={s3Config.backup_db}
                                onChange={(e) => updateS3Config({ backup_db: e.target.checked })}
                            />
                            <label htmlFor="s3-backup-db">{t('s3Backup.backupDatabase')}</label>
                        </div>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-backup-thumbnails"
                                checked={s3Config.backup_thumbnails}
                                onChange={(e) => updateS3Config({ backup_thumbnails: e.target.checked })}
                            />
                            <label htmlFor="s3-backup-thumbnails">{t('s3Backup.backupThumbnails')}</label>
                        </div>

                        <div className={styles['setting-row']} style={{ marginTop: 'var(--space-3)' }}>
                            <label>{t('s3Backup.maxFileSize')}</label>
                            <div style={{ width: '300px' }}>
                                <select
                                    value={s3Config.max_file_size_mb || ''}
                                    onChange={(e) => updateS3Config({ max_file_size_mb: e.target.value ? parseInt(e.target.value) : null })}
                                    style={{ width: '150px' }}
                                >
                                    {MAX_FILE_SIZE_OPTIONS.map(option => (
                                        <option key={option.value || 'none'} value={option.value || ''}>{option.label}</option>
                                    ))}
                                </select>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                    {t('s3Backup.maxFileSizeDescription')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sync Status */}
                    {syncStats && (
                        <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>{t('s3Backup.syncStatus')}</h3>
                            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                                <span>{t('s3Backup.total')}: <strong>{syncStats.total_photos}</strong></span>
                                <span>{t('s3Backup.synced')}: <strong style={{ color: 'var(--color-success)' }}>{syncStats.synced}</strong></span>
                                <span>{t('s3Backup.pending')}: <strong style={{ color: 'var(--color-warning)' }}>{syncStats.not_synced}</strong></span>
                            </div>
                            {syncStats.last_sync_at && (
                                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                    {t('s3Backup.lastSync')}: {new Date(syncStats.last_sync_at).toLocaleString()}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Test & Sync Buttons */}
                    <div style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting || !s3Config.bucket_uri}
                            style={buttonStyle(isTesting)}
                        >
                            {isTesting ? t('s3Backup.testing') : t('s3Backup.testConnection')}
                        </button>

                        <button
                            onClick={handleFullSync}
                            disabled={isSyncing || !s3Config.bucket_uri}
                            style={primaryButtonStyle(isSyncing)}
                        >
                            {isSyncing ? t('s3Backup.syncing') : t('s3Backup.fullSync')}
                        </button>
                    </div>

                    {/* Status Message */}
                    {statusMessage && (
                        <div style={{
                            marginTop: 'var(--space-3)',
                            padding: 'var(--space-3)',
                            background: statusMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            {statusMessage.text}
                        </div>
                    )}
                </>
            )}

            {!s3Config.enabled && (
                <p className={styles['setting-description']} style={{ fontStyle: 'italic', marginTop: 'var(--space-4)' }}>
                    {t('s3Backup.enableToConfig')}
                </p>
            )}
        </div>
    );
}

// Inline styles
const buttonStyle = (isDisabled) => ({
    padding: 'var(--space-2) var(--space-4)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--radius-sm)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1
});

const primaryButtonStyle = (isDisabled) => ({
    padding: 'var(--space-2) var(--space-4)',
    background: isDisabled ? 'var(--color-bg-muted)' : 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    fontWeight: 500
});

export default S3BackupTab;
