import { invoke } from '@tauri-apps/api/core';

class LoggerService {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.correlationCounter = 0;
    this.autoFlushInterval = 30000; // 30 seconds
    this.autoFlushEnabled = true;
    this.isEnabled = process.env.NODE_ENV === 'development'; // default to dev mode
    
    // Start auto-flush timer
    this.startAutoFlush();
    
    // Flush logs when page is about to unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushToBackend();
      });
    }
  }

  generateCorrelationId() {
    return `frontend_corr_${this.sessionId}_${++this.correlationCounter}`;
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      // Clear logs when disabled for privacy
      this.logs = [];
    }
  }

  getEnabled() {
    return this.isEnabled;
  }

  log(level, component, event, message, data = {}) {
    if (!this.isEnabled) {
      return null; // Skip logging when disabled
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level,
      component,
      event,
      message,
      data,
      correlationId: data.correlationId || this.generateCorrelationId()
    };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console fallback for development
    if (process.env.NODE_ENV === 'development') {
      const logMethod = level.toLowerCase();
      if (console[logMethod]) {
        console[logMethod](`[${level}] ${component}:${event} - ${message}`, data);
      } else {
        // Using console for development only - in production this would go to a proper logging service
        if (typeof window !== 'undefined' && window.console && window.console.log) {
            window.console.log(`[${level}] ${component}:${event} - ${message}`, data);
        }
      }
    }

    return logEntry.correlationId;
  }

  debug(component, event, message, data = {}) {
    return this.log('DEBUG', component, event, message, data);
  }

  info(component, event, message, data = {}) {
    return this.log('INFO', component, event, message, data);
  }

  warn(component, event, message, data = {}) {
    return this.log('WARN', component, event, message, data);
  }

  error(component, event, message, data = {}) {
    return this.log('ERROR', component, event, message, data);
  }

  async flushToBackend() {
    if (!this.isEnabled || this.logs.length === 0) return;
    
    try {
      // Convert camelCase logs to snake_case for backend
      const backendLogs = this.logs.map(log => ({
        timestamp: log.timestamp,
        session_id: log.sessionId,
        level: log.level,
        component: log.component,
        event: log.event,
        message: log.message,
        data: log.data,
        correlation_id: log.correlationId
      }));

      await invoke('submit_frontend_logs', {
        logs: JSON.stringify(backendLogs)
      });
      
      // Don't clear logs - keep them for UI display
      // Only trim if we're approaching the max limit
      if (this.logs.length > this.maxLogs * 0.8) {
        this.logs = this.logs.slice(-Math.floor(this.maxLogs * 0.6));
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.debug('Successfully flushed logs to backend');
      }
    } catch (error) {
      console.error('Failed to flush logs to backend:', error);
      // Don't clear logs on failure - they'll be retried on next flush
    }
  }

  getLogs(filter = {}) {
    return this.logs.filter(log => {
      if (filter.level && log.level !== filter.level) return false;
      if (filter.component && log.component !== filter.component) return false;
      if (filter.since && new Date(log.timestamp) < new Date(filter.since)) return false;
      if (filter.event && log.event !== filter.event) return false;
      return true;
    });
  }

  startAutoFlush() {
    if (!this.autoFlushEnabled) return;
    
    setInterval(() => {
      if (this.logs.length > 0) {
        this.flushToBackend();
      }
    }, this.autoFlushInterval);
  }

  // Configuration methods
  setAutoFlush(enabled) {
    this.autoFlushEnabled = enabled;
  }

  setMaxLogs(maxLogs) {
    this.maxLogs = maxLogs;
    
    // Trim current logs if needed
    if (this.logs.length > maxLogs) {
      this.logs = this.logs.slice(-maxLogs);
    }
  }

  setAutoFlushInterval(intervalMs) {
    this.autoFlushInterval = intervalMs;
  }

  // Clear all logs
  clear() {
    this.logs = [];
  }

  // Get statistics
  getStats() {
    const stats = {
      totalLogs: this.logs.length,
      sessionId: this.sessionId,
      levelCounts: {},
      componentCounts: {},
      eventCounts: {}
    };

    this.logs.forEach(log => {
      // Count by level
      stats.levelCounts[log.level] = (stats.levelCounts[log.level] || 0) + 1;
      
      // Count by component
      stats.componentCounts[log.component] = (stats.componentCounts[log.component] || 0) + 1;
      
      // Count by event
      stats.eventCounts[log.event] = (stats.eventCounts[log.event] || 0) + 1;
    });

    return stats;
  }

  // Initialize logging state from backend configuration
  async initializeFromConfig() {
    try {
      const status = await invoke('get_logging_status');
      this.setEnabled(status.enabled);
      return status;
    } catch (error) {
      console.warn('Failed to get logging status from backend, using default:', error);
      return { enabled: this.isEnabled, level: 'info' };
    }
  }

  // Export logs as JSON
  exportLogs() {
    return {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      logs: this.logs,
      stats: this.getStats()
    };
  }
}

// Create a singleton instance
export const logger = new LoggerService();

// Also export the class for testing or custom instances
export default LoggerService;