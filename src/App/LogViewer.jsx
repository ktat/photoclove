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
      // Get frontend logs
      const frontendLogs = logger.getLogs(filters);
      
      // Get backend logs
      const backendLogsResult = await invoke('get_logs', {
        logType: 'all',
        lines: 1000,
        since: filters.since
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

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
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
      return (
        <div key={`backend-${index}`} className="log-entry log-backend">
          <span className="log-timestamp">{new Date().toISOString()}</span>
          <span className="log-level">BACKEND</span>
          <span className="log-message">{log}</span>
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
        if (filters.level !== 'all' && log.level !== filters.level) return false;
        if (filters.component !== 'all' && log.component !== filters.component) return false;
        return true;
      });
      
      combinedLogs = [...combinedLogs, ...filteredFrontendLogs.map(log => ({ ...log, source: 'frontend' }))];
    }

    // Add backend logs
    if (filters.source === 'all' || filters.source === 'backend') {
      const backendLogLines = backendLogs.split('\n').filter(line => line.trim());
      combinedLogs = [...combinedLogs, ...backendLogLines.map(line => ({ message: line, source: 'backend', timestamp: new Date().toISOString() }))];
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
              {Object.keys(stats.componentCounts || {}).map(component => (
                <option key={component} value={component}>
                  {component} ({stats.componentCounts[component]})
                </option>
              ))}
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
            filteredLogs.map((log, index) => 
              log.source === 'backend' 
                ? renderLogEntry(log.message, index, true)
                : renderLogEntry(log, index, false)
            )
          )}
        </div>
      </div>

      <style jsx>{`
        .log-viewer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .log-viewer {
          background: white;
          border-radius: 8px;
          width: 95vw;
          height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .log-viewer-header {
          padding: 1rem;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .log-viewer-header h2 {
          margin: 0;
        }

        .log-viewer-actions {
          display: flex;
          gap: 0.5rem;
        }

        .log-viewer-actions button {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
        }

        .log-viewer-actions button:hover {
          background: #f5f5f5;
        }

        .log-viewer-actions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .log-viewer-error {
          padding: 1rem;
          background: #fee;
          border-left: 4px solid #f00;
          color: #c00;
        }

        .log-viewer-stats {
          padding: 0.5rem 1rem;
          background: #f8f9fa;
          border-bottom: 1px solid #ddd;
          font-size: 0.875rem;
          color: #666;
          display: flex;
          gap: 1rem;
        }

        .log-viewer-filters {
          padding: 1rem;
          border-bottom: 1px solid #ddd;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .log-viewer-filters label {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.875rem;
        }

        .log-viewer-filters select {
          padding: 0.25rem 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .log-viewer-content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          font-family: 'Courier New', monospace;
          font-size: 0.8rem;
        }

        .log-entry {
          display: grid;
          grid-template-columns: 100px 60px 120px 120px 1fr 120px;
          gap: 0.5rem;
          padding: 0.25rem;
          border-bottom: 1px solid #eee;
          align-items: start;
        }

        .log-entry.log-backend {
          grid-template-columns: 100px 80px 1fr;
        }

        .log-entry.log-debug {
          background: #f8f9fa;
        }

        .log-entry.log-info {
          background: #e7f3ff;
        }

        .log-entry.log-warn {
          background: #fff3cd;
        }

        .log-entry.log-error {
          background: #f8d7da;
        }

        .log-timestamp {
          font-size: 0.7rem;
          color: #666;
        }

        .log-level {
          font-weight: bold;
          font-size: 0.7rem;
        }

        .log-level.DEBUG {
          color: #6c757d;
        }

        .log-level.INFO {
          color: #0d6efd;
        }

        .log-level.WARN {
          color: #fd7e14;
        }

        .log-level.ERROR {
          color: #dc3545;
        }

        .log-component {
          font-weight: bold;
          color: #495057;
          font-size: 0.75rem;
        }

        .log-event {
          color: #6f42c1;
          font-size: 0.75rem;
        }

        .log-message {
          color: #212529;
        }

        .log-correlation {
          font-size: 0.7rem;
          color: #6c757d;
          font-family: monospace;
        }

        .log-data {
          grid-column: 1 / -1;
          margin-top: 0.25rem;
        }

        .log-data summary {
          cursor: pointer;
          color: #0d6efd;
          font-size: 0.75rem;
        }

        .log-data pre {
          background: #f8f9fa;
          padding: 0.5rem;
          border-radius: 4px;
          margin: 0.25rem 0 0 0;
          font-size: 0.7rem;
          overflow-x: auto;
        }

        .log-empty {
          text-align: center;
          color: #6c757d;
          padding: 2rem;
        }
      `}</style>
    </div>
  );
};

export default LogViewer;