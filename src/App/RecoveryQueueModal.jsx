import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../services/LoggerService.js";
import './RecoveryQueueModal.css';

const RecoveryQueueModal = ({ onClose, addFooterMessage }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(null);

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getOperationTypeName = (operationType) => {
    switch (operationType) {
      case "MoveToTrash":
        return "Move to Trash";
      case "Restore":
        return "Restore";
      case "Import":
        return "Import";
      case "PermanentlyDelete":
        return "Permanently Delete";
      default:
        return operationType;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Pending":
        return "var(--color-warning)";
      case "Resolved":
        return "var(--color-success)";
      case "Discarded":
        return "var(--color-text-muted)";
      default:
        return "var(--color-text-secondary)";
    }
  };

  const getStatusName = (status) => {
    switch (status) {
      case "Pending":
        return "Pending";
      case "Resolved":
        return "Resolved";
      case "Discarded":
        return "Discarded";
      default:
        return status;
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      logger.info('RecoveryQueueModal', 'load_items_start', 'Loading recovery queue items');
      const result = await invoke("get_recovery_pending_items");
      logger.debug('RecoveryQueueModal', 'raw_result_received', 'Raw result', { result });

      const itemsData = JSON.parse(result);
      logger.info('RecoveryQueueModal', 'items_loaded', 'Items loaded', { count: itemsData.length });
      setItems(itemsData);
    } catch (err) {
      logger.error('RecoveryQueueModal', 'load_items_error', 'Failed to load items', { error: err.message });
      setError("Failed to load items: " + err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const retryItem = async (id) => {
    try {
      setRetrying(id);
      logger.info('RecoveryQueueModal', 'retry_item', 'Retrying item', { id });
      const result = await invoke("retry_recovery_item", { id });
      const response = JSON.parse(result);

      if (response.success) {
        logger.info('RecoveryQueueModal', 'retry_success', 'Retry succeeded', { id });
        addFooterMessage?.("recovery", "Operation retried successfully", true, 3000);
        window.dispatchEvent(new CustomEvent('recovery-queue-changed'));
        loadItems();
      }
    } catch (err) {
      logger.error('RecoveryQueueModal', 'retry_error', 'Retry failed', { id, error: err.message });
      addFooterMessage?.("recovery", "Retry failed: " + err.message, false, 5000);
      loadItems(); // Reload to show updated retry count
    } finally {
      setRetrying(null);
    }
  };

  const retryAll = async () => {
    try {
      setRetrying('all');
      logger.info('RecoveryQueueModal', 'retry_all', 'Retrying all items');
      const result = await invoke("retry_all_recovery_items");
      const response = JSON.parse(result);

      logger.info('RecoveryQueueModal', 'retry_all_result', 'Retry all completed', response);
      const message = `${response.succeeded} succeeded, ${response.failed} failed`;
      addFooterMessage?.("recovery", message, response.failed === 0, 5000);
      window.dispatchEvent(new CustomEvent('recovery-queue-changed'));
      loadItems();
    } catch (err) {
      logger.error('RecoveryQueueModal', 'retry_all_error', 'Retry all failed', { error: err.message });
      addFooterMessage?.("recovery", "Retry all failed", false, 5000);
    } finally {
      setRetrying(null);
    }
  };

  const discardItem = async (id) => {
    try {
      logger.info('RecoveryQueueModal', 'discard_item', 'Discarding item', { id });
      await invoke("discard_recovery_item", { id });
      logger.info('RecoveryQueueModal', 'discard_success', 'Discard succeeded', { id });
      window.dispatchEvent(new CustomEvent('recovery-queue-changed'));
      loadItems();
    } catch (err) {
      logger.error('RecoveryQueueModal', 'discard_error', 'Discard failed', { id, error: err.message });
      addFooterMessage?.("recovery", "Discard failed: " + err.message, false, 5000);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  // Get filename from path for display
  const getFileName = (path) => {
    if (!path) return "N/A";
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  return (
    <div className="recovery-queue-overlay">
      <div className="recovery-queue-modal">
        <div className="recovery-queue-header">
          <div className="recovery-queue-title-section">
            <h2>&#x26a0;&#xfe0f; Failed Operations</h2>
            <span className="recovery-queue-subtitle">
              These operations failed and can be retried
            </span>
          </div>
          <div className="recovery-queue-actions">
            <button onClick={loadItems} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button
              onClick={retryAll}
              disabled={loading || items.length === 0 || retrying}
              className="retry-all-button"
            >
              {retrying === 'all' ? "Retrying..." : "Retry All"}
            </button>
            <button onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {error && (
          <div className="recovery-queue-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="recovery-queue-content">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : items.length === 0 ? (
            <div className="recovery-queue-empty">
              <span className="empty-icon">&#x2705;</span>
              <p>No pending items</p>
            </div>
          ) : (
            <div className="recovery-table-container">
              <table className="recovery-table">
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th>File</th>
                    <th>Error</th>
                    <th>Failed At</th>
                    <th>Retries</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="operation-type">
                          {getOperationTypeName(item.operation_type)}
                        </span>
                      </td>
                      <td title={item.target_path}>
                        <span className="file-name">
                          {getFileName(item.target_path)}
                        </span>
                      </td>
                      <td title={item.error_reason}>
                        {item.status === "unrecoverable" && (
                          <span className="unrecoverable-badge">Unrecoverable</span>
                        )}
                        <span className="error-reason">
                          {item.error_reason.length > 40
                            ? item.error_reason.substring(0, 40) + "..."
                            : item.error_reason}
                        </span>
                      </td>
                      <td className="date-cell">
                        {formatDateTime(item.failed_at)}
                      </td>
                      <td className="retry-count-cell">
                        {item.retry_count}
                      </td>
                      <td>
                        <div className="item-actions">
                          {item.status !== "unrecoverable" && (
                            <button
                              onClick={() => retryItem(item.id)}
                              className="retry-button"
                              disabled={retrying === item.id}
                              title="Retry this operation"
                            >
                              {retrying === item.id ? "..." : "Retry"}
                            </button>
                          )}
                          <button
                            onClick={() => discardItem(item.id)}
                            className="discard-button"
                            title="Discard (ignore this error)"
                          >
                            Discard
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecoveryQueueModal;
