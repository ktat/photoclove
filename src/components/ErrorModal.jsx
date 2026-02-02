import React from 'react';
import { useError } from '../context/ErrorContext.jsx';

const ErrorModal = ({ error, onClose, onRetry }) => {
  const { SEVERITY_CONFIG } = useError();
  
  if (!error) return null;

  const severityConfig = SEVERITY_CONFIG[error.severity] || SEVERITY_CONFIG.Error;
  const isCritical = error.severity === 'Critical';

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'Info': return 'ℹ️';
      case 'Warning': return '⚠️';
      case 'Error': return '❌';
      case 'Critical': return '🚨';
      default: return '❌';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: 'var(--space-5)'
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px rgba(0, 0, 0, 0.25)',
        border: `3px solid ${severityConfig.color}`
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 'var(--space-4)',
          paddingBottom: 'var(--space-3)',
          borderBottom: `2px solid ${severityConfig.color}20`
        }}>
          <span style={{ fontSize: 'var(--font-size-xl)', marginRight: 'var(--space-3)' }}>
            {getSeverityIcon(error.severity)}
          </span>
          <div>
            <h2 style={{
              margin: 0,
              color: severityConfig.color,
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'bold'
            }}>
              {error.category} {error.severity}
            </h2>
            {error.operation && (
              <div style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-muted)',
                marginTop: '4px',
                fontStyle: 'italic'
              }}>
                During: {error.operation}
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        <div style={{
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-size-lg)',
          lineHeight: '1.5',
          color: 'var(--color-text-primary)'
        }}>
          {error.message}
        </div>

        {/* Suggestion */}
        {error.suggestion && (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: severityConfig.bgColor,
            border: `1px solid ${severityConfig.color}30`,
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
            borderLeft: `4px solid ${severityConfig.color}`
          }}>
            <div style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'bold',
              color: severityConfig.color,
              marginBottom: 'var(--space-1)'
            }}>
              💡 Suggestion:
            </div>
            <div style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.4'
            }}>
              {error.suggestion}
            </div>
          </div>
        )}

        {/* Technical Details (collapsible) */}
        {(error.correlationId || error.stack) && (
          <details style={{ marginBottom: 'var(--space-4)' }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--space-2)'
            }}>
              Technical Details
            </summary>
            <div style={{
              backgroundColor: 'var(--color-bg-surface)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'monospace',
              border: '1px solid var(--color-border-default)'
            }}>
              {error.correlationId && (
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>Correlation ID:</strong> {error.correlationId}
                </div>
              )}
              {error.timestamp && (
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>Timestamp:</strong> {error.timestamp}
                </div>
              )}
              {error.userAction && (
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>User Action:</strong> {error.userAction}
                </div>
              )}
              {error.stack && (
                <div>
                  <strong>Stack Trace:</strong>
                  <pre style={{
                    marginTop: 'var(--space-1)',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 'var(--font-size-xs)'
                  }}>
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border-default)'
        }}>
          {/* Retry Button */}
          {error.recoverable && onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                backgroundColor: severityConfig.color,
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}
            >
              🔄 Retry
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              padding: 'var(--space-2) var(--space-5)',
              backgroundColor: isCritical ? 'var(--color-danger-dark)' : 'var(--color-text-muted)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'bold'
            }}
          >
            {isCritical ? 'Acknowledge' : 'Close'}
          </button>
        </div>

        {/* Critical Error Warning */}
        {isCritical && (
          <div style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger-dark)',
            fontSize: 'var(--font-size-sm)',
            textAlign: 'center'
          }}>
            ⚠️ This is a critical error that may require restarting the application
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorModal;