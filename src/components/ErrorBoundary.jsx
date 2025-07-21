import React from 'react';
import ErrorFallback from './ErrorFallback.jsx';
import { logger } from '../services/LoggerService.js';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log the error with structured format
    logger.error('ErrorBoundary', 'react_error_caught', 'React component error boundary triggered', {
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.name || 'unnamed',
      timestamp: new Date().toISOString()
    });
    
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Report to parent if callback provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
    
    // Call parent reset callback if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
    
    logger.info('ErrorBoundary', 'error_boundary_reset', 'User reset error boundary', {
      errorBoundary: this.props.name || 'unnamed'
    });
  }

  render() {
    if (this.state.hasError) {
      // Allow custom fallback component
      if (this.props.fallback) {
        return React.createElement(this.props.fallback, {
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.handleReset
        });
      }
      
      return (
        <ErrorFallback 
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={this.handleReset}
          name={this.props.name}
          level={this.props.level || 'component'}
        />
      );
    }
    
    return this.props.children;
  }
}

export default ErrorBoundary;