import React from 'react';
import { ErrorProvider } from '../context/ErrorContext.jsx';
import { PhotoProvider } from '../context/PhotoContext.jsx';
import { UIProvider } from '../context/UIContext.jsx';
import { ImportProvider } from '../context/ImportContext.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

const AppProviders = ({ children }) => {
  return (
    <ErrorProvider>
      <ErrorBoundary>
        <UIProvider>
          <PhotoProvider>
            <ImportProvider>
              {children}
            </ImportProvider>
          </PhotoProvider>
        </UIProvider>
      </ErrorBoundary>
    </ErrorProvider>
  );
};

export default AppProviders;