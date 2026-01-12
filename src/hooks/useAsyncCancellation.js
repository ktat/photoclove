import { useRef, useCallback } from 'react';

/**
 * Hook for managing cancellable async operations using the Request ID pattern.
 *
 * Since Tauri's `invoke` does not natively support AbortSignal, this pattern
 * provides frontend-side cancellation by tracking request IDs. When a new
 * request starts, previous requests are implicitly cancelled - their results
 * are simply ignored when they return.
 *
 * @example
 * const { startNewRequest, isRequestValid } = useAsyncCancellation();
 *
 * const loadData = async () => {
 *   const requestId = startNewRequest();
 *   const result = await fetchData();
 *   if (!isRequestValid(requestId)) {
 *     return; // Stale result, ignore
 *   }
 *   setData(result);
 * };
 */
export function useAsyncCancellation() {
    const requestIdRef = useRef(0);

    /**
     * Start a new request, invalidating all previous requests.
     * @returns {number} The ID of the new request
     */
    const startNewRequest = useCallback(() => {
        return ++requestIdRef.current;
    }, []);

    /**
     * Check if a request is still the latest (not cancelled).
     * @param {number} requestId - The request ID to check
     * @returns {boolean} True if this is the current request
     */
    const isRequestValid = useCallback((requestId) => {
        return requestId === requestIdRef.current;
    }, []);

    /**
     * Cancel all pending requests without starting a new one.
     * Useful for cleanup on component unmount.
     */
    const cancelAll = useCallback(() => {
        requestIdRef.current++;
    }, []);

    /**
     * Get the current request ID without starting a new request.
     * Useful for checking if any request is in progress.
     * @returns {number} The current request ID
     */
    const getCurrentRequestId = useCallback(() => {
        return requestIdRef.current;
    }, []);

    return {
        startNewRequest,
        isRequestValid,
        cancelAll,
        getCurrentRequestId
    };
}

export default useAsyncCancellation;
