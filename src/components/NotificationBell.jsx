import React from 'react';
import styles from './NotificationBell.module.css';

/**
 * Bell icon with unread badge for the notification center.
 * Placed at the bottom of VerticalTabBar.
 */
function NotificationBell({ unreadCount, onClick, collapsed }) {
  return (
    <button
      className={`${styles.bell} ${collapsed ? styles.collapsed : ''}`}
      onClick={onClick}
      title="Notifications"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <span className={styles.badge}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export default NotificationBell;
