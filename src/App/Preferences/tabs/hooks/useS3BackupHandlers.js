import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../../../../services/LoggerService.js";

/**
 * Hook for S3 backup handler functions
 */
export function useS3BackupHandlers({
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
}) {
    const handleTestConnection = useCallback(async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
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
                backupThumbnails: s3Config.backup_thumbnails,
                maxFileSizeMb: s3Config.max_file_size_mb
            });

            const result = await invoke("test_s3_connection");
            const data = JSON.parse(result);
            setTestResult({ success: data.success, message: data.message });

            if (data.success) {
                setStatusMessage({ type: 'success', text: t('s3Backup.connectionSuccess') });
                addFooterMessage?.("s3_test", t('s3Backup.connectionSuccess'));
            } else {
                setStatusMessage({ type: 'error', text: `${t('s3Backup.connectionFailed')}: ${data.message}` });
                addFooterMessage?.("s3_test_error", `${t('s3Backup.connectionFailed')}: ${data.message}`);
            }
        } catch (error) {
            setTestResult({ success: false, message: error.toString() });
            setStatusMessage({ type: 'error', text: `${t('s3Backup.connectionFailed')}: ${error}` });
            addFooterMessage?.("s3_test_error", `${t('s3Backup.connectionFailed')}: ${error}`);
            logger.error('S3BackupTab', 'test_connection_error', 'Connection test failed', { error });
        } finally {
            setIsTesting(false);
        }
    }, [s3Config, t, addFooterMessage, setTestResult, setIsTesting, setStatusMessage]);

    const handleFullSync = useCallback(async () => {
        if (!window.confirm(t('s3Backup.fullSyncConfirm'))) {
            return;
        }

        setIsSyncing(true);
        try {
            const result = await invoke("enqueue_s3_full_sync");
            const data = JSON.parse(result);
            setStatusMessage({ type: 'success', text: t('s3Backup.syncStarted', { count: data.to_sync }) });
            addFooterMessage?.("s3_sync", t('s3Backup.syncStarted', { count: data.to_sync }));
        } catch (error) {
            setStatusMessage({ type: 'error', text: `${t('s3Backup.syncFailed')}: ${error}` });
            addFooterMessage?.("s3_sync_error", `${t('s3Backup.syncFailed')}: ${error}`);
            logger.error('S3BackupTab', 'full_sync_error', 'Failed to start full sync', { error });
        } finally {
            setIsSyncing(false);
        }
    }, [t, addFooterMessage, setIsSyncing, setStatusMessage]);

    const handleSaveCredentials = useCallback(async () => {
        if (!accessKeyId || !secretAccessKey) {
            setStatusMessage({ type: 'error', text: t('s3Backup.credentialsRequired') });
            addFooterMessage?.("s3_credentials_error", t('s3Backup.credentialsRequired'));
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

            const result = await invoke("get_s3_credentials_preview", { provider: s3Config.storage_type });
            const data = JSON.parse(result);
            setCredentialsPreview(data.access_key_preview);

            setStatusMessage({ type: 'success', text: t('s3Backup.credentialsSaved', { provider: selectedProvider.label }) });
            addFooterMessage?.("s3_credentials", t('s3Backup.credentialsSaved', { provider: selectedProvider.label }));
            logger.info('S3BackupTab', 'credentials_saved', 'S3 credentials saved to keyring', { provider: s3Config.storage_type });
        } catch (error) {
            setStatusMessage({ type: 'error', text: `${t('s3Backup.credentialsSaveFailed')}: ${error}` });
            addFooterMessage?.("s3_credentials_error", `${t('s3Backup.credentialsSaveFailed')}: ${error}`);
            logger.error('S3BackupTab', 'credentials_save_error', 'Failed to save credentials', { error });
        }
    }, [accessKeyId, secretAccessKey, s3Config.storage_type, selectedProvider, t, addFooterMessage,
        setHasStoredCredentials, setAccessKeyId, setSecretAccessKey, setCredentialsPreview, setStatusMessage]);

    const handleDeleteCredentials = useCallback(async () => {
        if (!window.confirm(t('s3Backup.deleteCredentialsConfirm', { provider: selectedProvider.label }))) {
            return;
        }

        try {
            await invoke("delete_s3_credentials", { provider: s3Config.storage_type });
            setHasStoredCredentials(false);
            setCredentialsPreview(null);
            setStatusMessage({ type: 'success', text: t('s3Backup.credentialsDeleted', { provider: selectedProvider.label }) });
            addFooterMessage?.("s3_credentials", t('s3Backup.credentialsDeleted', { provider: selectedProvider.label }));
            logger.info('S3BackupTab', 'credentials_deleted', 'S3 credentials deleted from keyring', { provider: s3Config.storage_type });
        } catch (error) {
            setStatusMessage({ type: 'error', text: `${t('s3Backup.credentialsDeleteFailed')}: ${error}` });
            addFooterMessage?.("s3_credentials_error", `${t('s3Backup.credentialsDeleteFailed')}: ${error}`);
            logger.error('S3BackupTab', 'credentials_delete_error', 'Failed to delete credentials', { error });
        }
    }, [s3Config.storage_type, selectedProvider, t, addFooterMessage,
        setHasStoredCredentials, setCredentialsPreview, setStatusMessage]);

    return {
        handleTestConnection,
        handleFullSync,
        handleSaveCredentials,
        handleDeleteCredentials
    };
}
