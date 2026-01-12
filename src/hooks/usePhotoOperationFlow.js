/**
 * usePhotoOperationFlow - Hook for common photo operation patterns
 *
 * Provides a standardized flow for photo operations:
 * Selection → Confirmation → Execution → UI Update
 */
import { useState, useCallback } from 'react';
import { logger } from '../services/LoggerService.js';

/**
 * Hook for managing photo operation flows with confirmation
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onSuccess - Callback when operation succeeds
 * @param {Function} options.onError - Callback when operation fails
 * @param {string} options.context - Component context for logging
 * @returns {Object} Operation flow management functions and state
 */
export function usePhotoOperationFlow(options = {}) {
    const {
        onSuccess,
        onError,
        context = 'PhotoOperation'
    } = options;

    const [isProcessing, setIsProcessing] = useState(false);
    const [confirmation, setConfirmation] = useState(null);
    const [progress, setProgress] = useState(null);

    /**
     * Internal function to perform the operation
     */
    const performOperation = useCallback(async (operation, photos, operationName) => {
        setIsProcessing(true);
        setProgress({ current: 0, total: photos.length });

        const startTime = Date.now();

        logger.info(context, `${operationName}_start`, `Starting ${operationName}`, {
            photoCount: photos.length
        });

        try {
            const result = await operation(photos, (current, total) => {
                setProgress({ current, total });
            });

            const duration = Date.now() - startTime;

            logger.info(context, `${operationName}_success`, `${operationName} completed successfully`, {
                photoCount: photos.length,
                duration
            });

            if (onSuccess) {
                onSuccess(result, photos);
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error(context, `${operationName}_failed`, `${operationName} failed`, {
                photoCount: photos.length,
                duration,
                error: error.toString()
            });

            if (onError) {
                onError(error, photos);
            }

            throw error;
        } finally {
            setIsProcessing(false);
            setProgress(null);
        }
    }, [context, onSuccess, onError]);

    /**
     * Execute an operation, optionally showing confirmation first
     *
     * @param {Function} operation - Async function to execute: (photos, onProgress) => Promise<result>
     * @param {Array} photos - Array of photo objects or paths
     * @param {Object} options - Execution options
     * @param {string} options.confirmMessage - If provided, show confirmation dialog first
     * @param {string} options.operationName - Name for logging purposes
     * @param {Object} options.confirmData - Additional data for confirmation dialog
     * @returns {Promise<any>} Operation result
     */
    const executeOperation = useCallback(async (
        operation,
        photos,
        executeOptions = {}
    ) => {
        const {
            confirmMessage,
            operationName = 'operation',
            confirmData = {}
        } = executeOptions;

        // If confirmation is required, set up the confirmation state
        if (confirmMessage) {
            return new Promise((resolve, reject) => {
                setConfirmation({
                    message: confirmMessage,
                    photoCount: photos.length,
                    operationName,
                    ...confirmData,
                    onConfirm: async () => {
                        setConfirmation(null);
                        try {
                            const result = await performOperation(operation, photos, operationName);
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }
                    },
                    onCancel: () => {
                        setConfirmation(null);
                        logger.info(context, `${operationName}_cancelled`, `User cancelled ${operationName}`, {
                            photoCount: photos.length
                        });
                        resolve(null);
                    }
                });
            });
        }

        // No confirmation required, execute directly
        return performOperation(operation, photos, operationName);
    }, [context, performOperation]);

    /**
     * Clear the confirmation dialog without executing
     */
    const clearConfirmation = useCallback(() => {
        setConfirmation(null);
    }, []);

    /**
     * Cancel any ongoing operation (if supported by the operation)
     */
    const cancelOperation = useCallback(() => {
        // This is a placeholder for future cancellation support
        // Individual operations need to support cancellation
        logger.info(context, 'operation_cancel_requested', 'Operation cancellation requested');
    }, [context]);

    return {
        // State
        isProcessing,
        confirmation,
        progress,

        // Actions
        executeOperation,
        clearConfirmation,
        cancelOperation
    };
}

/**
 * Create a batch operation function that works with usePhotoOperationFlow
 *
 * @param {Function} singleOperation - Operation for a single photo
 * @param {Object} options - Options for batch handling
 * @returns {Function} Batch operation function
 */
export function createBatchOperation(singleOperation, options = {}) {
    const { continueOnError = true } = options;

    return async (photos, onProgress) => {
        const results = {
            succeeded: [],
            failed: []
        };

        for (let i = 0; i < photos.length; i++) {
            try {
                const result = await singleOperation(photos[i]);
                results.succeeded.push({ photo: photos[i], result });
            } catch (error) {
                results.failed.push({ photo: photos[i], error });

                if (!continueOnError) {
                    throw error;
                }
            }

            if (onProgress) {
                onProgress(i + 1, photos.length);
            }
        }

        return results;
    };
}

export default usePhotoOperationFlow;
