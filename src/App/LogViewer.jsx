import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';
import './LogViewer.css';

/**
 * Check whether a log timestamp falls inside the selected relative window.
 * Shared by the frontend and backend filter paths.
 */
export function isWithinSince(timestamp, since) {
  if (since === 'all') return true;
  const logTime = new Date(timestamp);
  const now = new Date();
  let cutoffTime;

  switch (since) {
    case '5m':
      cutoffTime = new Date(now.getTime() - 5 * 60 * 1000);
      break;
    case '1h':
      cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    default:
      cutoffTime = new Date(0); // Beginning of time
  }

  return logTime >= cutoffTime;
}

/**
 * Parse raw backend log text into structured entries.
 * Pure function so the (regex-heavy) parse runs once per load, not per render.
 */
export function parseBackendLogs(rawText) {
  const backendLogLines = rawText.split('\n').filter(line => line.trim());

  const parsedBackendLogs = [];
  let currentLog = null;

  for (const line of backendLogLines) {
    // Try to parse standard log format: YYYY-MM-DD HH:MM:SS.mmm [LEVEL] target - message
    const standardMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s*\[(\w+)\]\s*([^\s]+)\s*-\s*(.+)$/);

    if (standardMatch) {
      // This is a new log entry
      if (currentLog) {
        parsedBackendLogs.push(currentLog);
      }
      currentLog = {
        timestamp: standardMatch[1].replace(' ', 'T') + 'Z',
        level: standardMatch[2],
        component: standardMatch[3],
        message: standardMatch[4],
        source: 'backend'
      };
    } else if (currentLog && line.trim()) {
      // This is a continuation of the previous log (e.g., stack trace or multi-line output)
      currentLog.message += '\n' + line;
    } else if (line.trim()) {
      // Unrecognized format - create a standalone log entry
      if (currentLog) {
        parsedBackendLogs.push(currentLog);
        currentLog = null;
      }
      parsedBackendLogs.push({
        message: line,
        source: 'backend',
        timestamp: new Date().toISOString(),
        level: 'INFO'
      });
    }
  }

  // Don't forget the last log
  if (currentLog) {
    parsedBackendLogs.push(currentLog);
  }

  return parsedBackendLogs;
}

const LogViewer = ({ onClose }) => {
  const [logs, setLogs] = useState([]);
  const [backendLogs, setBackendLogs] = useState('');
  // Load previous filter state from localStorage
  const loadFilters = () => {
    try {
      const saved = localStorage.getItem('logviewer_filters');
      return saved ? JSON.parse(saved) : {
        level: 'all',
        component: 'all',
        since: '1h',
        source: 'all',
        keyword: '' // Add keyword filter
      };
    } catch {
      return {
        level: 'all',
        component: 'all',
        since: '1h',
        source: 'all',
        keyword: ''
      };
    }
  };
 
  const [filters, setFilters] = useState(loadFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loggingEnabled, setLoggingEnabled] = useState(logger.getEnabled());
  const [loggingStatus, setLoggingStatus] = useState({ enabled: false, level: 'info' });

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
   
    try {
      // Get ALL frontend logs - don't filter here
      const frontendLogs = logger.getLogs();
     
      // Get backend logs only
      const backendLogsResult = await invoke('get_logs', {
        logType: 'backend',
        lines: 1000,
        since: 'all' // Get all backend logs too
      });

      setLogs(frontendLogs);
      setBackendLogs(backendLogsResult);
    } catch (error) {
      logger.error('LogViewer', 'load_logs_failed', 'Failed to load logs', {
        error: error.message || error.toString()
      });
      setError(`Failed to load logs: ${error.message || error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load logs on mount and periodically (paused while the window is hidden)
  useEffect(() => {
    loadLogs();
    const interval = setInterval(() => {
      if (!document.hidden) loadLogs();
    }, 5000); // Refresh every 5 seconds
    const refreshOnVisible = () => {
      if (!document.hidden) loadLogs();
    };
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, []); // Empty dependency - only run on mount
 
  // Save filter changes to localStorage
  useEffect(() => {
    localStorage.setItem('logviewer_filters', JSON.stringify(filters));
  }, [filters]);

  // Load logging status on mount
  useEffect(() => {
    const loadLoggingStatus = async () => {
      try {
        const status = await invoke('get_logging_status');
        setLoggingStatus(status);
        setLoggingEnabled(status.enabled);
      } catch (error) {
        logger.warn('LogViewer', 'logging_status_load_failed', 'Failed to load logging status', { error: error.message });
      }
    };
    loadLoggingStatus();
  }, []);

  const toggleLogging = async () => {
    try {
      const newEnabled = !loggingEnabled;
      await invoke('set_logging_enabled', { enabled: newEnabled });
     
      // Update local state
      setLoggingEnabled(newEnabled);
      setLoggingStatus(prev => ({ ...prev, enabled: newEnabled }));
     
      // Update logger service
      logger.setEnabled(newEnabled);
     
      // Log the change (if enabled)
      if (newEnabled) {
        logger.info('LogViewer', 'logging_toggled', 'Logging enabled via LogViewer toggle');
      }
     
      // Refresh logs after toggling
      await loadLogs();
    } catch (error) {
      setError(`Failed to toggle logging: ${error.message}`);
    }
  };

  const exportLogs = async () => {
    try {
      setIsLoading(true);
      
      // Use the memoized filtered logs for export
      const exportData = {
        logs: filteredLogs,
        filters,
        timestamp: new Date().toISOString(),
        stats: logger.getStats()
      };
      
      const result = await invoke('export_logs_to_download_dir', {
        logType: 'all',
        filteredLogs: JSON.stringify(exportData, null, 2)
      });
      
      logger.info('LogViewer', 'logs_exported', 'Successfully exported logs to download directory', {
        exportPath: result,
        logCount: filteredLogs.length,
        filters
      });
      
      // Show success message with file location
      alert(`Logs exported successfully to:\n${result}`);
      
    } catch (error) {
      logger.error('LogViewer', 'export_failed', 'Failed to export logs', {
        error: error.message || error.toString()
      });
      setError(`Failed to export logs: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFrontendLogs = async () => {
    try {
      setIsLoading(true);
      
      // Clear frontend logs in memory (LoggerService)
      logger.clear();
      setLogs([]);
      
      // Also clear frontend log files on backend
      await invoke('clear_frontend_logs');
      
      logger.info('LogViewer', 'frontend_logs_cleared', 'Successfully cleared frontend logs');
      
      // Refresh logs to show the cleared state
      await loadLogs();
      
    } catch (error) {
      logger.error('LogViewer', 'clear_frontend_logs_failed', 'Failed to clear frontend logs', {
        error: error.message || error.toString()
      });
      setError(`Failed to clear frontend logs: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearBackendLogs = async () => {
    try {
      setIsLoading(true);
      
      await invoke('clear_backend_logs');
      
      logger.info('LogViewer', 'backend_logs_cleared', 'Successfully cleared backend logs');
      
      // Refresh logs to show the cleared state
      await loadLogs();
      
    } catch (error) {
      logger.error('LogViewer', 'clear_backend_logs_failed', 'Failed to clear backend logs', {
        error: error.message || error.toString()
      });
      setError(`Failed to clear backend logs: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearKeywordFilter = () => {
    setFilters(prev => ({ ...prev, keyword: '' }));
  };

  const renderLogEntry = (log, index, isBackend = false) => {
    if (isBackend) {
      // Backend logs are now properly structured
      return (
        <div key={`backend-${index}`} className={`log-entry log-${(log.level || 'info').toLowerCase()}`}>
          <span className="log-timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
          <span className="log-level">{log.level || 'INFO'}</span>
          <span className="log-component">{log.component || '-'}</span>
          <span className="log-event">-</span>
          <span className="log-message">
            {log.message}
            <button
              className="copy-message-button"
              onClick={() => {
                navigator.clipboard.writeText(log.message);
              }}
              title="Copy message to clipboard"
            >
              📋
            </button>
          </span>
          <span className="log-correlation">-</span>
        </div>
      );
    }

    return (
      <div key={`frontend-${index}`} className={`log-entry log-${log.level.toLowerCase()}`}>
        <span className="log-timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
        <span className="log-level">{log.level}</span>
        <span className="log-component">{log.component}</span>
        <span className="log-event">{log.event}</span>
        <span className="log-message">
          {log.message}
          <button
            className="copy-message-button"
            onClick={() => {
              navigator.clipboard.writeText(log.message);
            }}
            title="Copy message to clipboard"
          >
            📋
          </button>
        </span>
        {log.correlationId && (
          <span className="log-correlation" title="Correlation ID">{log.correlationId}</span>
        )}
        {Object.keys(log.data).length > 0 && (
          <details className="log-data">
            <summary>Data</summary>
            <div className="log-data-content">
              <button 
                className="copy-data-button" 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(log.data, null, 2));
                }}
                title="Copy data to clipboard"
              >
                📋
              </button>
              <pre>{JSON.stringify(log.data, null, 2)}</pre>
            </div>
          </details>
        )}
      </div>
    );
  };

  // Backend parse is regex-heavy over up to 1000 lines: do it once per load
  const parsedBackendLogs = useMemo(() => parseBackendLogs(backendLogs), [backendLogs]);

  const filteredLogs = useMemo(() => {
    let combinedLogs = [];

    // Add frontend logs
    if (filters.source === 'all' || filters.source === 'frontend') {
      const filteredFrontendLogs = logs.filter(log => {
        if (filters.level !== 'all' && log.level.toUpperCase() !== filters.level.toUpperCase()) return false;
        if (filters.component !== 'all' && log.component !== filters.component) return false;

        // Keyword filter
        if (filters.keyword && filters.keyword.trim()) {
          const keyword = filters.keyword.toLowerCase();
          const searchText = (
            (log.message || '') + ' ' +
            (log.event || '') + ' ' +
            (log.component || '') + ' ' +
            JSON.stringify(log.data || {})
          ).toLowerCase();
          if (!searchText.includes(keyword)) return false;
        }

        return isWithinSince(log.timestamp, filters.since);
      });

      combinedLogs = [...combinedLogs, ...filteredFrontendLogs.map(log => ({ ...log, source: 'frontend' }))];
    }

    // Add backend logs
    if (filters.source === 'all' || filters.source === 'backend') {
      const filteredBackendLogs = parsedBackendLogs.filter(log => {
        if (filters.level !== 'all' && log.level && log.level.toUpperCase() !== filters.level.toUpperCase()) {
          return false;
        }

        // Keyword filter for backend logs
        if (filters.keyword && filters.keyword.trim()) {
          const keyword = filters.keyword.toLowerCase();
          const searchText = (
            (log.message || '') + ' ' +
            (log.component || '')
          ).toLowerCase();
          if (!searchText.includes(keyword)) return false;
        }

        return isWithinSince(log.timestamp, filters.since);
      });

      combinedLogs = [...combinedLogs, ...filteredBackendLogs];
    }

    // Sort by timestamp
    combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return combinedLogs;
  }, [logs, parsedBackendLogs, filters]);
  const stats = logger.getStats();

  return (
    <div className="log-viewer-overlay">
      <div className="log-viewer">
        <div className="log-viewer-header">
          <div className="log-viewer-title-section">
            <h2>Debug Logs</h2>
            <div className="logging-status">
              <span className={`logging-badge ${loggingEnabled ? 'enabled' : 'disabled'}`}>
                Logging: {loggingEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <button 
                className={`logging-toggle ${loggingEnabled ? 'enabled' : 'disabled'}`}
                onClick={toggleLogging}
                title={`${loggingEnabled ? 'Disable' : 'Enable'} logging`}
              >
                {loggingEnabled ? '🟢 ON' : '🔴 OFF'}
              </button>
            </div>
          </div>
          <div className="log-viewer-actions">
            <button onClick={exportLogs} disabled={isLoading}>Export Logs</button>
            <button onClick={clearFrontendLogs} disabled={isLoading}>Clear Frontend Logs</button>
            <button onClick={clearBackendLogs} disabled={isLoading}>Clear Backend Logs</button>
            <button onClick={loadLogs} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>

        {error && (
          <div className="log-viewer-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="log-viewer-stats">
          <span>Frontend Logs: {stats.totalLogs}</span>
          <span>Session: {stats.sessionId}</span>
          <span>Raw Frontend: {logs.length}</span>
          <span>Backend Lines: {backendLogs.split('\n').filter(line => line.trim()).length}</span>
          <span>Total Displayed: {filteredLogs.length}</span>
        </div>

        <div className="log-viewer-filters">
          <label>
            Level:
            <select 
              value={filters.level} 
              onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
            >
              <option value="all">All</option>
              <option value="DEBUG">Debug</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warning</option>
              <option value="ERROR">Error</option>
            </select>
          </label>

          <label>
            Component:
            <select 
              value={filters.component} 
              onChange={(e) => setFilters(prev => ({ ...prev, component: e.target.value }))}
            >
              <option value="all">All</option>
              {Object.keys(stats.componentCounts || {}).length > 0 ? 
                Object.keys(stats.componentCounts).map(component => (
                  <option key={component} value={component}>
                    {component} ({stats.componentCounts[component]})
                  </option>
                )) :
                logs.length > 0 ? 
                  [...new Set(logs.map(log => log.component))].map(component => (
                    <option key={component} value={component}>
                      {component}
                    </option>
                  )) :
                  <option value="" disabled>No logs available</option>
              }
            </select>
          </label>

          <label>
            Source:
            <select 
              value={filters.source} 
              onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
            >
              <option value="all">All</option>
              <option value="frontend">Frontend Only</option>
              <option value="backend">Backend Only</option>
            </select>
          </label>

          <label>
            Since:
            <select 
              value={filters.since} 
              onChange={(e) => setFilters(prev => ({ ...prev, since: e.target.value }))}
            >
              <option value="5m">Last 5 minutes</option>
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="all">All time</option>
            </select>
          </label>
          
          <label>
            Keyword:
            <div className="keyword-filter-container">
              <input
                type="text"
                placeholder="Search logs..."
                value={filters.keyword}
                onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                style={{ width: '200px' }}
              />
              {filters.keyword && (
                <button 
                  className="clear-keyword-button"
                  onClick={clearKeywordFilter}
                  title="Clear keyword filter"
                >
                  ✕
                </button>
              )}
            </div>
          </label>
        </div>

        <div className="log-viewer-content">
          {!loggingEnabled && (
            <div className="log-viewer-warning">
              <strong>Logging is currently disabled.</strong> 
              Enable logging using the toggle above or in Preferences to start collecting logs.
            </div>
          )}
          {filteredLogs.length === 0 ? (
            <div className="log-empty">
              {loggingEnabled ? 'No logs match the current filters.' : 'No logs available. Logging is disabled.'}
            </div>
          ) : (
            <>
              <div className="log-header">
                <span className="log-header-time">Time</span>
                <span className="log-header-level">Level</span>
                <span className="log-header-component">Component</span>
                <span className="log-header-event">Event</span>
                <span className="log-header-message">Message</span>
                <span className="log-header-correlation">Correlation ID</span>
              </div>
              <div className="log-entries">
                {filteredLogs.map((log, index) => 
                  log.source === 'backend' 
                    ? renderLogEntry(log, index, true)
                    : renderLogEntry(log, index, false)
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default LogViewer;
