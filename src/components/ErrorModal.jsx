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
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderRadius: '12px',
        padding: '24px',
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
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: `2px solid ${severityConfig.color}20`
        }}>
          <span style={{ fontSize: 'var(--font-size-xl)', marginRight: '12px' }}>
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
          marginBottom: '16px',
          fontSize: 'var(--font-size-lg)',
          lineHeight: '1.5',
          color: 'var(--color-text-primary)'
        }}>
          {error.message}
        </div>

        {/* Suggestion */}
        {error.suggestion && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: severityConfig.bgColor,
            border: `1px solid ${severityConfig.color}30`,
            borderRadius: '6px',
            marginBottom: '16px',
            borderLeft: `4px solid ${severityConfig.color}`
          }}>
            <div style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'bold',
              color: severityConfig.color,
              marginBottom: '4px'
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
          <details style={{ marginBottom: '16px' }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-muted)',
              marginBottom: '8px'
            }}>
              Technical Details
            </summary>
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '12px',
              borderRadius: '4px',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'monospace',
              border: '1px solid #e9ecef'
            }}>
              {error.correlationId && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Correlation ID:</strong> {error.correlationId}
                </div>
              )}
              {error.timestamp && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Timestamp:</strong> {error.timestamp}
                </div>
              )}
              {error.userAction && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>User Action:</strong> {error.userAction}
                </div>
              )}
              {error.stack && (
                <div>
                  <strong>Stack Trace:</strong>
                  <pre style={{
                    marginTop: '4px',
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
          gap: '12px',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingTop: '12px',
          borderTop: '1px solid #e9ecef'
        }}>
          {/* Retry Button */}
          {error.recoverable && onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '10px 20px',
                backgroundColor: severityConfig.color,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔄 Retry
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: isCritical ? '#dc2626' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
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
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
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