import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../services/LoggerService.js';

const LogViewer = ({ onClose }) => {
  const [logs, setLogs] = useState([]);
  const [backendLogs, setBackendLogs] = useState('');
  const [filters, setFilters] = useState({
    level: 'all',
    component: 'all',
    since: '1h',
    source: 'all' // 'frontend', 'backend', 'all'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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
      console.error('Failed to load logs:', error);
      setError(`Failed to load logs: ${error.message || error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load logs on mount and periodically
  useEffect(() => {
    // Generate test logs to ensure we have some data
    logger.debug('LogViewer', 'component_opened', 'LogViewer component opened');
    logger.info('LogViewer', 'initialization', 'LogViewer initialized successfully');
    logger.warn('LogViewer', 'test_warning', 'This is a test warning message');
    logger.error('LogViewer', 'test_error', 'This is a test error message');
    
    // Generate logs from different components
    logger.info('SearchSystem', 'test_search', 'Test log from search system');
    logger.debug('PhotoManager', 'test_photo', 'Test log from photo manager');
    
    loadLogs();
    const interval = setInterval(loadLogs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []); // Empty dependency - only run on mount
  
  // Log filter changes separately
  useEffect(() => {
    logger.info('LogViewer', 'filter_change', 'Filter configuration changed', filters);
  }, [filters]);

  const exportLogs = () => {
    try {
      const allLogs = {
        frontend: logs,
        backend: backendLogs,
        timestamp: new Date().toISOString(),
        filters,
        stats: logger.getStats()
      };

      const blob = new Blob([JSON.stringify(allLogs, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `photoclove-logs-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(`Failed to export logs: ${error.message}`);
    }
  };

  const clearFrontendLogs = () => {
    logger.clear();
    setLogs([]);
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
          <span className="log-message">{log.message}</span>
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
        <span className="log-message">{log.message}</span>
        {log.correlationId && (
          <span className="log-correlation" title="Correlation ID">{log.correlationId}</span>
        )}
        {Object.keys(log.data).length > 0 && (
          <details className="log-data">
            <summary>Data</summary>
            <pre>{JSON.stringify(log.data, null, 2)}</pre>
          </details>
        )}
      </div>
    );
  };

  const combineAndFilterLogs = () => {
    let combinedLogs = [];

    // Add frontend logs
    if (filters.source === 'all' || filters.source === 'frontend') {
      const filteredFrontendLogs = logs.filter(log => {
        if (filters.level !== 'all' && log.level.toUpperCase() !== filters.level.toUpperCase()) return false;
        if (filters.component !== 'all' && log.component !== filters.component) return false;
        
        // Handle 'since' filter
        if (filters.since !== 'all') {
          const logTime = new Date(log.timestamp);
          const now = new Date();
          let cutoffTime;
          
          switch(filters.since) {
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
          
          if (logTime < cutoffTime) return false;
        }
        
        return true;
      });
      
      combinedLogs = [...combinedLogs, ...filteredFrontendLogs.map(log => ({ ...log, source: 'frontend' }))];
    }

    // Add backend logs
    if (filters.source === 'all' || filters.source === 'backend') {
      const backendLogLines = backendLogs.split('\n').filter(line => line.trim());
      
      // Parse backend logs to extract structured information
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
      
      // Apply level filter to backend logs if we could parse them
      const filteredBackendLogs = parsedBackendLogs.filter(log => {
        if (filters.level !== 'all' && log.level && log.level.toUpperCase() !== filters.level.toUpperCase()) {
          return false;
        }
        return true;
      });
      
      combinedLogs = [...combinedLogs, ...filteredBackendLogs];
    }

    // Sort by timestamp
    combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return combinedLogs;
  };

  const filteredLogs = combineAndFilterLogs();
  const stats = logger.getStats();

  return (
    <div className="log-viewer-overlay">
      <div className="log-viewer">
        <div className="log-viewer-header">
          <h2>Debug Logs</h2>
          <div className="log-viewer-actions">
            <button onClick={exportLogs} disabled={isLoading}>Export Logs</button>
            <button onClick={clearFrontendLogs}>Clear Frontend Logs</button>
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
        </div>

        <div className="log-viewer-content">
          {filteredLogs.length === 0 ? (
            <div className="log-empty">No logs match the current filters.</div>
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