/**
 * TauriService - Unified Tauri invocation with error handling and logging
 *
 * Provides standardized patterns for invoking Tauri commands with
 * consistent error handling, logging, and progress tracking.
 */
import { invoke } from '@tauri-apps/api/core';
import { logger } from './LoggerService.js';

/**
 * Invoke a Tauri command with error handling and logging
 *
 * @param {string} command - The Tauri command name
 * @param {Object} args - Arguments to pass to the command
 * @param {string} context - Component/context name for logging
 * @param {Object} options - Additional options
 * @param {boolean} options.silent - If true, suppress success logging
 * @param {string} options.correlationId - Optional correlation ID for tracing
 * @param {boolean} options.parseJson - If true, parse the result as JSON
 * @returns {Promise<any>} The command result
 * @throws {Error} Re-throws any error after logging
 */
export async function invokeWithErrorHandling(
    command,
    args = {},
    context = 'TauriService',
    options = {}
) {
    const { silent = false, correlationId, parseJson = false } = options;

    if (!silent) {
        logger.info(context, `${command}_request`, `Invoking ${command}`, {
            ...args,
            correlationId
        });
    }

    try {
        let result = await invoke(command, args);

        if (parseJson && typeof result === 'string') {
            result = JSON.parse(result);
        }

        if (!silent) {
            logger.info(context, `${command}_success`, `${command} completed successfully`, {
                correlationId
            });
        }

        return result;
    } catch (error) {
        logger.error(context, `${command}_failed`, `${command} failed`, {
            error: error.toString(),
            args,
            correlationId
        });

        throw error;
    }
}

/**
 * Invoke a Tauri command for batch operations with progress tracking
 *
 * @param {string} command - The Tauri command name
 * @param {Array} items - Array of items to process
 * @param {Function} argBuilder - Function to build args from each item: (item, index) => args
 * @param {Object} options - Additional options
 * @param {Function} options.onProgress - Progress callback: (completed, total) => void
 * @param {string} options.context - Component/context name for logging
 * @param {boolean} options.stopOnError - If true, stop processing on first error
 * @param {string} options.correlationId - Optional correlation ID for tracing
 * @returns {Promise<Object>} Result object with successes and failures
 */
export async function invokeWithProgress(
    command,
    items,
    argBuilder,
    options = {}
) {
    const {
        onProgress,
        context = 'TauriService',
        stopOnError = false,
        correlationId
    } = options;

    const results = {
        succeeded: [],
        failed: [],
        total: items.length
    };

    logger.info(context, `${command}_batch_start`, `Starting batch ${command}`, {
        itemCount: items.length,
        correlationId
    });

    for (let i = 0; i < items.length; i++) {
        try {
            const args = argBuilder(items[i], i);
            const result = await invokeWithErrorHandling(
                command,
                args,
                context,
                { silent: true, correlationId }
            );
            results.succeeded.push({ item: items[i], result });
        } catch (error) {
            results.failed.push({ item: items[i], error });

            if (stopOnError) {
                logger.error(context, `${command}_batch_stopped`, 'Batch operation stopped on error', {
                    completedCount: i,
                    totalCount: items.length,
                    error: error.toString(),
                    correlationId
                });
                break;
            }
        }

        if (onProgress) {
            onProgress(i + 1, items.length);
        }
    }

    logger.info(context, `${command}_batch_complete`, `Batch ${command} completed`, {
        succeeded: results.succeeded.length,
        failed: results.failed.length,
        total: results.total,
        correlationId
    });

    return results;
}

/**
 * Invoke a Tauri command with retry logic
 *
 * @param {string} command - The Tauri command name
 * @param {Object} args - Arguments to pass to the command
 * @param {string} context - Component/context name for logging
 * @param {Object} options - Additional options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
 * @param {string} options.correlationId - Optional correlation ID for tracing
 * @returns {Promise<any>} The command result
 * @throws {Error} Re-throws the last error after all retries fail
 */
export async function invokeWithRetry(
    command,
    args = {},
    context = 'TauriService',
    options = {}
) {
    const {
        maxRetries = 3,
        retryDelay = 1000,
        correlationId
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await invokeWithErrorHandling(
                command,
                args,
                context,
                { silent: attempt > 1, correlationId }
            );
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                logger.warn(context, `${command}_retry`, `Retrying ${command}`, {
                    attempt,
                    maxRetries,
                    error: error.toString(),
                    correlationId
                });

                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    logger.error(context, `${command}_all_retries_failed`, `All retry attempts failed for ${command}`, {
        maxRetries,
        error: lastError.toString(),
        correlationId
    });

    throw lastError;
}

/**
 * Create a Tauri service instance for a specific context
 * Provides methods bound to a specific component context
 *
 * @param {string} context - Component/context name for logging
 * @returns {Object} Service instance with bound methods
 */
export function createTauriContext(context) {
    return {
        invoke: (command, args, options) =>
            invokeWithErrorHandling(command, args, context, options),

        invokeWithProgress: (command, items, argBuilder, options) =>
            invokeWithProgress(command, items, argBuilder, { ...options, context }),

        invokeWithRetry: (command, args, options) =>
            invokeWithRetry(command, args, context, options)
    };
}

export default {
    invokeWithErrorHandling,
    invokeWithProgress,
    invokeWithRetry,
    createTauriContext
};
