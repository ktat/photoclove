import { useState, useCallback, useEffect, useMemo } from 'react';
import { logger } from '../services/LoggerService.js';

const STORAGE_KEY = 'photoclove_notifications';
const LAST_READ_KEY = 'photoclove_notifications_last_read';
const MAX_NOTIFICATIONS = 500;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    logger.error('useNotifications', 'load_failed', 'Failed to load notifications from localStorage', { error: e.message });
    return [];
  }
}

function saveToStorage(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (e) {
    logger.error('useNotifications', 'save_failed', 'Failed to save notifications to localStorage', { error: e.message });
  }
}

function loadLastReadTimestamp() {
  try {
    return localStorage.getItem(LAST_READ_KEY) || null;
  } catch {
    return null;
  }
}

function saveLastReadTimestamp(timestamp) {
  try {
    localStorage.setItem(LAST_READ_KEY, timestamp);
  } catch {
    // ignore
  }
}

/**
 * Hook for managing notification state with localStorage persistence.
 * Listens for 'notification-add' CustomEvents for cross-context communication.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState(() => loadFromStorage());
  const [lastReadTimestamp, setLastReadTimestamp] = useState(() => loadLastReadTimestamp());

  const addNotification = useCallback((category, message, type = 'info') => {
    const now = new Date().toISOString();

    setNotifications(prev => {
      // Deduplicate: if the latest notification has the same category and message, skip
      if (prev.length > 0 && prev[0].category === category && prev[0].message === message) {
        return prev;
      }

      const notification = {
        id: crypto.randomUUID(),
        category,
        message,
        timestamp: now,
        type
      };
      const updated = [notification, ...prev];
      const trimmed = updated.length > MAX_NOTIFICATIONS
        ? updated.slice(0, MAX_NOTIFICATIONS)
        : updated;
      saveToStorage(trimmed);
      return trimmed;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const now = new Date().toISOString();
    setLastReadTimestamp(now);
    saveLastReadTimestamp(now);
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveToStorage([]);
  }, []);

  // Listen for CustomEvent from ErrorContext (which can't directly access UIContext)
  useEffect(() => {
    const handler = (e) => {
      const { category, message, type } = e.detail;
      addNotification(category, message, type);
    };
    window.addEventListener('notification-add', handler);
    return () => window.removeEventListener('notification-add', handler);
  }, [addNotification]);

  const unreadCount = useMemo(() => {
    if (!lastReadTimestamp) {
      return notifications.length;
    }
    return notifications.filter(n => n.timestamp > lastReadTimestamp).length;
  }, [notifications, lastReadTimestamp]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAllAsRead,
    clearAll
  };
}
