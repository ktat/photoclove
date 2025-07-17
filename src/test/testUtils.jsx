import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { PhotoProvider } from '../context/PhotoContext';
import { UIProvider } from '../context/UIContext';

// Provider wrapper for tests
const AllTheProviders = ({ children, initialPhotoState = {}, initialUIState = {} }) => {
  return (
    <PhotoProvider initialState={initialPhotoState}>
      <UIProvider initialState={initialUIState}>
        {children}
      </UIProvider>
    </PhotoProvider>
  );
};

export const renderWithProviders = (ui, options = {}) => {
  const { initialPhotoState = {}, initialUIState = {}, ...renderOptions } = options;
  
  const Wrapper = ({ children }) => (
    <AllTheProviders initialPhotoState={initialPhotoState} initialUIState={initialUIState}>
      {children}
    </AllTheProviders>
  );
  
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

export const createMockInvoke = (responses = {}) => {
  return vi.fn((command, args) => {
    const response = responses[command];
    if (typeof response === 'function') {
      return Promise.resolve(response(args));
    }
    return Promise.resolve(response || '{}');
  });
};

// Helper to create mock HTML elements
export const createMockElement = (tagName = 'div', props = {}) => {
  const element = document.createElement(tagName);
  Object.keys(props).forEach(key => {
    element[key] = props[key];
  });
  return element;
};

// Helper to create mock File objects
export const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024) => {
  const file = new File([''], name, { type, size });
  return file;
};

// Helper to create mock FileList
export const createMockFileList = (files = []) => {
  const fileList = {
    length: files.length,
    item: (index) => files[index],
    [Symbol.iterator]: function* () {
      for (let i = 0; i < files.length; i++) {
        yield files[i];
      }
    },
  };
  
  files.forEach((file, index) => {
    fileList[index] = file;
  });
  
  return fileList;
};

// Helper to wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Helper to create mock drag and drop events
export const createMockDragEvent = (type, dataTransfer = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.dataTransfer = {
    files: [],
    items: [],
    types: [],
    getData: vi.fn(),
    setData: vi.fn(),
    clearData: vi.fn(),
    setDragImage: vi.fn(),
    ...dataTransfer,
  };
  return event;
};

// Helper to create mock keyboard events
export const createMockKeyboardEvent = (type, key, options = {}) => {
  return new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...options });
};

// Helper to create mock mouse events
export const createMockMouseEvent = (type, options = {}) => {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...options });
};