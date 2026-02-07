import React, { useEffect } from 'react';
import BaseModal from './BaseModal.jsx';
import styles from './NotificationCenterModal.module.css';

/**
 * Format a timestamp for display: "HH:MM:SS (Xm ago)"
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  let relative;
  if (seconds < 60) relative = 'just now';
  else {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) relative = `${minutes}m ago`;
    else {
      const hours = Math.floor(minutes / 60);
      if (hours < 24) relative = `${hours}h ago`;
      else relative = `${Math.floor(hours / 24)}d ago`;
    }
  }

  return `${time} (${relative})`;
}

/**
 * Notification center modal showing all accumulated notifications.
 * Calls markAllAsRead on mount to reset unread count.
 */
function NotificationCenterModal({ notifications, onClose, onClearAll, markAllAsRead }) {
  // Mark all as read when the modal opens
  useEffect(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const footer = (
    <div className={styles.footerButtons}>
      <button className={styles.clearButton} onClick={onClearAll}>
        Clear All
      </button>
      <button className={styles.closeButton} onClick={onClose}>
        Close
      </button>
    </div>
  );

  return (
    <BaseModal
      title={`Notifications (${notifications.length})`}
      onClose={onClose}
      footer={footer}
    >
      {notifications.length === 0 ? (
        <div className={styles.empty}>No notifications</div>
      ) : (
        <ul className={styles.list}>
          {notifications.map(n => (
            <li
              key={n.id}
              className={`${styles.item} ${n.type === 'error' ? styles.error : styles.info}`}
            >
              <div className={styles.itemHeader}>
                <span className={styles.category}>{n.category}</span>
                <span className={styles.time}>{formatTime(n.timestamp)}</span>
              </div>
              <div className={styles.message}>{n.message}</div>
            </li>
          ))}
        </ul>
      )}
    </BaseModal>
  );
}

export default NotificationCenterModal;
