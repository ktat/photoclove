import React from 'react';

const ErrorFallback = ({ error, resetError }) => {
  return (
    <div style={{
      padding: '20px',
      margin: '20px',
      border: '1px solid #ff4444',
      borderRadius: '8px',
      backgroundColor: '#fff5f5',
      color: '#cc0000',
      fontFamily: 'monospace'
    }}>
      <h2>Something went wrong</h2>
      <details style={{ whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
        <summary>Error Details</summary>
        {error && error.toString()}
        {error && error.stack && (
          <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '300px' }}>
            {error.stack}
          </pre>
        )}
      </details>
      <button 
        onClick={resetError}
        style={{
          padding: '8px 16px',
          backgroundColor: '#cc0000',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Try Again
      </button>
    </div>
  );
};

export default ErrorFallback;