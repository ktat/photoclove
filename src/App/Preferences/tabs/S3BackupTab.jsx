import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../services/LoggerService.js";
import styles from '../Preferences.module.css';

// Storage provider options
const STORAGE_PROVIDERS = [
    { id: 'aws_s3', label: 'Amazon S3', hasEndpoint: false },
    { id: 'wasabi', label: 'Wasabi', hasEndpoint: false },
    { id: 'minio', label: 'MinIO', hasEndpoint: true },
    { id: 'cloudflare_r2', label: 'Cloudflare R2', hasEndpoint: true },
    { id: 'digitalocean', label: 'DigitalOcean Spaces', hasEndpoint: false },
    { id: 'idrive_e2', label: 'iDrive e2', hasEndpoint: false },
    { id: 'custom', label: 'Other (Custom Endpoint)', hasEndpoint: true }
];

// Common AWS regions
// Source: https://docs.aws.amazon.com/general/latest/gr/s3.html
const AWS_REGIONS = [
    { id: 'us-east-1', label: 'US East (N. Virginia)' },
    { id: 'us-east-2', label: 'US East (Ohio)' },
    { id: 'us-west-1', label: 'US West (N. California)' },
    { id: 'us-west-2', label: 'US West (Oregon)' },
    { id: 'eu-west-1', label: 'EU (Ireland)' },
    { id: 'eu-west-2', label: 'EU (London)' },
    { id: 'eu-central-1', label: 'EU (Frankfurt)' },
    { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { id: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
    { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { id: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { id: 'sa-east-1', label: 'South America (São Paulo)' }
];

// Wasabi regions (15 regions as of 2026)
// Source: https://docs.wasabi.com/docs/service-urls-for-wasabis-storage-regions
// Source: https://wasabi.com/company/storage-regions
const WASABI_REGIONS = [
    { id: 'us-east-1', label: 'US East (N. Virginia)' },
    { id: 'us-east-2', label: 'US East (N. Virginia-2)' },
    { id: 'us-central-1', label: 'US Central (Texas)' },
    { id: 'us-west-2', label: 'US West (San Jose)' },
    { id: 'ca-central-1', label: 'Canada (Toronto)' },
    { id: 'eu-central-1', label: 'EU Central (Amsterdam)' },
    { id: 'eu-central-2', label: 'EU Central (Frankfurt)' },
    { id: 'eu-west-1', label: 'EU West (London)' },
    { id: 'eu-west-2', label: 'EU West (Paris)' },
    { id: 'eu-west-3', label: 'EU West (London-2)' },
    { id: 'eu-south-1', label: 'EU South (Milan)' },
    { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { id: 'ap-northeast-2', label: 'Asia Pacific (Osaka)' },
    { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' }
];

// DigitalOcean Spaces regions (13 regions as of 2026)
// Source: https://docs.digitalocean.com/products/spaces/details/availability/
const DIGITALOCEAN_REGIONS = [
    { id: 'nyc1', label: 'New York 1' },
    { id: 'nyc2', label: 'New York 2' },
    { id: 'nyc3', label: 'New York 3' },
    { id: 'sfo2', label: 'San Francisco 2' },
    { id: 'sfo3', label: 'San Francisco 3' },
    { id: 'ams3', label: 'Amsterdam 3' },
    { id: 'sgp1', label: 'Singapore 1' },
    { id: 'lon1', label: 'London 1' },
    { id: 'fra1', label: 'Frankfurt 1' },
    { id: 'tor1', label: 'Toronto 1' },
    { id: 'blr1', label: 'Bangalore 1' },
    { id: 'syd1', label: 'Sydney 1' },
    { id: 'atl1', label: 'Atlanta 1' }
];

// iDrive e2 regions (16 regions as of 2026)
// Source: https://www.idrive.com/s3-storage-e2/e2-endpoint-urls
// Source: https://www.idrive.com/s3-storage-e2/locations
const IDRIVE_E2_REGIONS = [
    { id: 'us-east-1', label: 'US East (Virginia)' },
    { id: 'us-southeast-1', label: 'US Southeast (Miami)' },
    { id: 'us-central-1', label: 'US Central (Dallas)' },
    { id: 'us-midwest-1', label: 'US Midwest (Chicago)' },
    { id: 'us-southwest-1', label: 'US Southwest (Phoenix)' },
    { id: 'us-west-1', label: 'US West (Oregon)' },
    { id: 'us-west-2', label: 'US West (Los Angeles)' },
    { id: 'us-west-3', label: 'US West (San Jose)' },
    { id: 'ca-east-1', label: 'Canada (Montreal)' },
    { id: 'eu-west-1', label: 'EU West (Ireland)' },
    { id: 'eu-west-2', label: 'EU West (London)' },
    { id: 'eu-west-3', label: 'EU West (London-2)' },
    { id: 'eu-west-4', label: 'EU West (Paris)' },
    { id: 'eu-central-1', label: 'EU Central (Frankfurt-2)' },
    { id: 'eu-central-2', label: 'EU Central (Frankfurt)' },
    { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' }
];

// Max file size options
const MAX_FILE_SIZE_OPTIONS = [
    { value: null, label: 'No limit' },
    { value: 50, label: '50 MB' },
    { value: 100, label: '100 MB' },
    { value: 200, label: '200 MB' },
    { value: 500, label: '500 MB' }
];

// Helper functions to parse and build bucket URI
function parseBucketUri(bucketUri) {
    if (!bucketUri || !bucketUri.startsWith('s3://')) {
        return { bucketName: '', prefix: '' };
    }

    const path = bucketUri.replace('s3://', '');
    const parts = path.split('/');
    const bucketName = parts[0] || '';
    const prefix = parts.slice(1).filter(p => p).join('/');

    return { bucketName, prefix };
}

function buildBucketUri(bucketName, prefix) {
    if (!bucketName) return '';

    const cleanPrefix = prefix ? prefix.replace(/^\/+|\/+$/g, '') : '';
    return cleanPrefix ? `s3://${bucketName}/${cleanPrefix}/` : `s3://${bucketName}/`;
}

function S3BackupTab({ config, setConfig, addFooterMessage }) {
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
        max_file_size_mb: null,
        last_sync_at: null
    };

    // Parse bucket URI into bucket name and prefix
    const { bucketName, prefix } = parseBucketUri(s3Config.bucket_uri);

    // Check if current region is in the predefined list, if not, set as custom region
    useEffect(() => {
        let regions;
        switch (s3Config.storage_type) {
            case 'aws_s3':
                regions = AWS_REGIONS;
                break;
            case 'wasabi':
                regions = WASABI_REGIONS;
                break;
            case 'digitalocean':
                regions = DIGITALOCEAN_REGIONS;
                break;
            case 'idrive_e2':
                regions = IDRIVE_E2_REGIONS;
                break;
            default:
                regions = AWS_REGIONS;
        }

        const regionExists = regions.some(r => r.id === s3Config.region);
        if (!regionExists && s3Config.region) {
            // If region is not in the list, set it as custom region
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
    }, [s3Config.storage_type]); // Re-check when provider changes

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
                // AWS S3: default to AWS credentials
                updates = { ...updates, auth_method: updates.auth_method || 'aws_credentials' };
            } else {
                // S3-compatible (iDrive e2, etc.): use access key
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

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            // Save config first
            await invoke("save_s3_config", {
                enabled: s3Config.enabled,
                storageType: s3Config.storage_type,
                bucketUri: s3Config.bucket_uri,
                region: s3Config.region,
                authMethod: s3Config.auth_method,
                profile: s3Config.profile,
                customEndpoint: s3Config.custom_endpoint,
                autoSync: s3Config.auto_sync,
                backupDb: s3Config.backup_db,
                maxFileSizeMb: s3Config.max_file_size_mb
            });

            const result = await invoke("test_s3_connection");
            const data = JSON.parse(result);
            setTestResult({ success: data.success, message: data.message });

            if (data.success) {
                setStatusMessage({ type: 'success', text: 'S3 connection successful' });
                addFooterMessage?.("s3_test", "S3 connection successful");
            } else {
                setStatusMessage({ type: 'error', text: `Connection failed: ${data.message}` });
                addFooterMessage?.("s3_test_error", `S3 connection failed: ${data.message}`);
            }
        } catch (error) {
            setTestResult({ success: false, message: error.toString() });
            setStatusMessage({ type: 'error', text: `Connection failed: ${error}` });
            addFooterMessage?.("s3_test_error", `S3 connection failed: ${error}`);
            logger.error('S3BackupTab', 'test_connection_error', 'Connection test failed', { error });
        } finally {
            setIsTesting(false);
        }
    };

    const handleFullSync = async () => {
        if (!window.confirm("This will sync all unsynced photos to S3. Continue?")) {
            return;
        }

        setIsSyncing(true);
        try {
            const result = await invoke("enqueue_s3_full_sync");
            const data = JSON.parse(result);
            setStatusMessage({ type: 'success', text: `Sync started: ${data.to_sync} photos to upload` });
            addFooterMessage?.("s3_sync", `Sync started: ${data.to_sync} photos to upload`);
        } catch (error) {
            setStatusMessage({ type: 'error', text: `Failed to start sync: ${error}` });
            addFooterMessage?.("s3_sync_error", `Failed to start sync: ${error}`);
            logger.error('S3BackupTab', 'full_sync_error', 'Failed to start full sync', { error });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveCredentials = async () => {
        if (!accessKeyId || !secretAccessKey) {
            setStatusMessage({ type: 'error', text: 'Please enter both Access Key ID and Secret Access Key' });
            addFooterMessage?.("s3_credentials_error", "Please enter both Access Key ID and Secret Access Key");
            return;
        }

        try {
            await invoke("store_s3_credentials", {
                provider: s3Config.storage_type,
                accessKeyId,
                secretAccessKey
            });
            setHasStoredCredentials(true);
            setAccessKeyId('');
            setSecretAccessKey('');

            // Refresh preview for current provider
            const result = await invoke("get_s3_credentials_preview", { provider: s3Config.storage_type });
            const data = JSON.parse(result);
            setCredentialsPreview(data.access_key_preview);

            setStatusMessage({ type: 'success', text: `Credentials saved securely for ${selectedProvider.label}` });
            addFooterMessage?.("s3_credentials", `Credentials saved for ${selectedProvider.label}`);
            logger.info('S3BackupTab', 'credentials_saved', 'S3 credentials saved to keyring', { provider: s3Config.storage_type });
        } catch (error) {
            setStatusMessage({ type: 'error', text: `Failed to save credentials: ${error}` });
            addFooterMessage?.("s3_credentials_error", `Failed to save credentials: ${error}`);
            logger.error('S3BackupTab', 'credentials_save_error', 'Failed to save credentials', { error });
        }
    };

    const handleDeleteCredentials = async () => {
        if (!window.confirm(`Delete stored credentials for ${selectedProvider.label}? You'll need to re-enter them.`)) {
            return;
        }

        try {
            await invoke("delete_s3_credentials", { provider: s3Config.storage_type });
            setHasStoredCredentials(false);
            setCredentialsPreview(null);
            setStatusMessage({ type: 'success', text: `Credentials deleted for ${selectedProvider.label}` });
            addFooterMessage?.("s3_credentials", `Credentials deleted for ${selectedProvider.label}`);
            logger.info('S3BackupTab', 'credentials_deleted', 'S3 credentials deleted from keyring', { provider: s3Config.storage_type });
        } catch (error) {
            setStatusMessage({ type: 'error', text: `Failed to delete credentials: ${error}` });
            addFooterMessage?.("s3_credentials_error", `Failed to delete credentials: ${error}`);
            logger.error('S3BackupTab', 'credentials_delete_error', 'Failed to delete credentials', { error });
        }
    };

    const selectedProvider = STORAGE_PROVIDERS.find(p => p.id === s3Config.storage_type) || STORAGE_PROVIDERS[0];
    const showEndpointField = selectedProvider.hasEndpoint || s3Config.storage_type === 'custom';
    const showProfileSelector = s3Config.storage_type === 'aws_s3' && s3Config.auth_method === 'aws_credentials';
    const needsAccessKey = s3Config.storage_type !== 'aws_s3' || s3Config.auth_method === 'access_key';

    return (
        <div className={styles['preferences-section']}>
            <h2 className={styles['section-title']}>S3 Backup</h2>
            <p className={styles['setting-description']} style={{ marginBottom: 'var(--space-4)' }}>
                Backup photos to Amazon S3 or S3-compatible storage services.
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
                    <label htmlFor="s3-enabled">Enable S3 Backup</label>
                </div>
            </div>

            {s3Config.enabled && (
                <>
                    {/* Storage Provider */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Storage Provider</h3>
                        <div className={styles['setting-row']}>
                            <label>Provider</label>
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
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Storage Settings</h3>

                        {showEndpointField && (
                            <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                                <label>Endpoint URL</label>
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
                            <label>Bucket Name</label>
                            <input
                                type="text"
                                value={bucketName}
                                onChange={(e) => updateBucketName(e.target.value)}
                                placeholder="my-bucket"
                                style={{ width: '300px' }}
                            />
                        </div>

                        <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                            <label>Prefix (optional)</label>
                            <div style={{ width: '300px' }}>
                                <input
                                    type="text"
                                    value={prefix}
                                    onChange={(e) => updatePrefix(e.target.value)}
                                    placeholder="photos/backup"
                                    style={{ width: '100%' }}
                                />
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                    Optional path prefix. Leave empty to use bucket root.
                                </div>
                            </div>
                        </div>

                        <div className={styles['setting-row']}>
                            <label>Region</label>
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
                                    {(() => {
                                        let regions;
                                        switch (s3Config.storage_type) {
                                            case 'aws_s3':
                                                regions = AWS_REGIONS;
                                                break;
                                            case 'wasabi':
                                                regions = WASABI_REGIONS;
                                                break;
                                            case 'digitalocean':
                                                regions = DIGITALOCEAN_REGIONS;
                                                break;
                                            case 'idrive_e2':
                                                regions = IDRIVE_E2_REGIONS;
                                                break;
                                            default:
                                                // MinIO, Cloudflare R2, Custom use AWS region codes
                                                regions = AWS_REGIONS;
                                        }
                                        return regions.map(region => (
                                            <option key={region.id} value={region.id}>{region.label}</option>
                                        ));
                                    })()}
                                </select>
                                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                    Or enter custom region code:
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
                                    Use this if your region is not listed above
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Authentication */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Authentication</h3>

                        {s3Config.storage_type === 'aws_s3' && (
                            <div style={{ marginBottom: 'var(--space-3)' }}>
                                <div className={styles['setting-item']}>
                                    <input
                                        type="radio"
                                        id="auth-aws-credentials"
                                        name="auth-method"
                                        checked={s3Config.auth_method === 'aws_credentials'}
                                        onChange={() => updateS3Config({ auth_method: 'aws_credentials' })}
                                    />
                                    <label htmlFor="auth-aws-credentials">Use AWS CLI credentials (~/.aws/credentials)</label>
                                </div>
                                <div className={styles['setting-item']}>
                                    <input
                                        type="radio"
                                        id="auth-iam-role"
                                        name="auth-method"
                                        checked={s3Config.auth_method === 'iam_role'}
                                        onChange={() => updateS3Config({ auth_method: 'iam_role' })}
                                    />
                                    <label htmlFor="auth-iam-role">Use IAM Role (EC2/ECS)</label>
                                </div>
                                <div className={styles['setting-item']}>
                                    <input
                                        type="radio"
                                        id="auth-access-key"
                                        name="auth-method"
                                        checked={s3Config.auth_method === 'access_key'}
                                        onChange={() => updateS3Config({ auth_method: 'access_key' })}
                                    />
                                    <label htmlFor="auth-access-key">Enter Access Key manually</label>
                                </div>
                            </div>
                        )}

                        {showProfileSelector && (
                            <div className={styles['setting-row']}>
                                <label>AWS Profile</label>
                                <select
                                    value={s3Config.profile || 'default'}
                                    onChange={(e) => updateS3Config({ profile: e.target.value === 'default' ? null : e.target.value })}
                                    style={{ width: '200px' }}
                                >
                                    {awsProfiles.map(profile => (
                                        <option key={profile} value={profile}>{profile}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {needsAccessKey && (
                            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
                                <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                                    Access Key Credentials ({selectedProvider.label})
                                </h4>

                                {hasStoredCredentials ? (
                                    <div>
                                        <div style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                            <strong style={{ color: 'var(--color-success)' }}>✓ Credentials stored securely</strong>
                                            {credentialsPreview && (
                                                <div style={{ marginTop: 'var(--space-1)' }}>
                                                    Access Key: <code style={{ fontSize: 'var(--font-size-xs)' }}>{credentialsPreview}</code>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleDeleteCredentials}
                                            style={{
                                                padding: 'var(--space-2) var(--space-3)',
                                                background: 'var(--color-danger)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                cursor: 'pointer',
                                                fontSize: 'var(--font-size-sm)'
                                            }}
                                        >
                                            Delete Credentials
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                                            <label>Access Key ID</label>
                                            <div style={{ width: '300px' }}>
                                                <input
                                                    type="text"
                                                    value={accessKeyId}
                                                    onChange={(e) => setAccessKeyId(e.target.value)}
                                                    placeholder="Enter your Access Key ID"
                                                    style={{ width: '100%' }}
                                                />
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                                    Example: AKIAIOSFODNN7EXAMPLE
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles['setting-row']} style={{ marginBottom: 'var(--space-3)' }}>
                                            <label>Secret Access Key</label>
                                            <div style={{ width: '300px' }}>
                                                <input
                                                    type="password"
                                                    value={secretAccessKey}
                                                    onChange={(e) => setSecretAccessKey(e.target.value)}
                                                    placeholder="Enter your Secret Access Key"
                                                    style={{ width: '100%' }}
                                                />
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                                    Will be stored securely and masked after saving
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSaveCredentials}
                                            disabled={!accessKeyId || !secretAccessKey}
                                            style={{
                                                padding: 'var(--space-2) var(--space-4)',
                                                background: (!accessKeyId || !secretAccessKey) ? 'var(--color-bg-muted)' : 'var(--color-primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                cursor: (!accessKeyId || !secretAccessKey) ? 'not-allowed' : 'pointer',
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 500
                                            }}
                                        >
                                            Save Credentials
                                        </button>
                                        <p style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                            Credentials are stored securely in your system's keyring
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sync Options */}
                    <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Sync Options</h3>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-auto-sync"
                                checked={s3Config.auto_sync}
                                onChange={(e) => updateS3Config({ auto_sync: e.target.checked })}
                            />
                            <label htmlFor="s3-auto-sync">Auto sync on import</label>
                        </div>

                        <div className={styles['setting-item']}>
                            <input
                                type="checkbox"
                                id="s3-backup-db"
                                checked={s3Config.backup_db}
                                onChange={(e) => updateS3Config({ backup_db: e.target.checked })}
                            />
                            <label htmlFor="s3-backup-db">Backup database (metadata, tags, edits)</label>
                        </div>

                        <div className={styles['setting-row']} style={{ marginTop: 'var(--space-3)' }}>
                            <label>Max file size</label>
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
                                    Files larger than this will be skipped
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sync Status */}
                    {syncStats && (
                        <div className={styles['setting-group']} style={{ marginTop: 'var(--space-4)' }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-base)' }}>Sync Status</h3>
                            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                                <span>Total: <strong>{syncStats.total_photos}</strong></span>
                                <span>Synced: <strong style={{ color: 'var(--color-success)' }}>{syncStats.synced}</strong></span>
                                <span>Pending: <strong style={{ color: 'var(--color-warning)' }}>{syncStats.not_synced}</strong></span>
                            </div>
                            {syncStats.last_sync_at && (
                                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                    Last sync: {new Date(syncStats.last_sync_at).toLocaleString()}
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
                            {isTesting ? 'Testing...' : 'Test Connection'}
                        </button>

                        <button
                            onClick={handleFullSync}
                            disabled={isSyncing || !s3Config.bucket_uri}
                            style={primaryButtonStyle(isSyncing)}
                        >
                            {isSyncing ? 'Syncing...' : 'Full Sync'}
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
                    Enable S3 Backup to configure cloud storage settings.
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
