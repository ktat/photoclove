import React from 'react';
import { useError } from '../context/ErrorContext.jsx';

const ErrorDisplay = () => {
  const { errors, removeError } = useError();

  if (errors.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: 9999,
      maxWidth: '400px'
    }}>
      {errors.map(error => (
        <div 
          key={error.id}
          style={{
            padding: '12px',
            margin: '5px 0',
            backgroundColor: error.type === 'tauri' ? '#fff3cd' : '#f8d7da',
            border: `1px solid ${error.type === 'tauri' ? '#ffeaa7' : '#f5c6cb'}`,
            borderRadius: '4px',
            color: error.type === 'tauri' ? '#856404' : '#721c24',
            position: 'relative',
            fontSize: '14px'
          }}
        >
          <button
            onClick={() => removeError(error.id)}
            style={{
              position: 'absolute',
              top: '5px',
              right: '8px',
              background: 'none',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              color: 'inherit'
            }}
          >
            ×
          </button>
          <div style={{ marginRight: '20px' }}>
            <strong>{error.type === 'tauri' ? 'System Error' : 'Error'}:</strong>
            <div>{error.message}</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '5px' }}>
              {new Date(error.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ErrorDisplay;