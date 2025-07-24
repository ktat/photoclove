import { vi } from 'vitest';

export const mockPhotos = {
  photos: [
    {
      file: {
        path: '/test/photos/2024-01-01/uuid1/IMG_001.jpg',
        name: 'IMG_001.jpg',
      },
      has_thumbnail: true,
      css_style: '',
    },
    {
      file: {
        path: '/test/photos/2024-01-01/uuid2/IMG_002.jpg',
        name: 'IMG_002.jpg',
      },
      has_thumbnail: true,
      css_style: 'filter: brightness(1.2)',
    },
    {
      file: {
        path: '/test/photos/2024-01-01/uuid3/IMG_003.jpg',
        name: 'IMG_003.jpg',
      },
      has_thumbnail: false,
      css_style: '',
    },
  ],
  has_next: true,
  has_prev: false,
};

export const mockPhotosPaginated = {
  photos: [
    {
      file: {
        path: '/test/photos/2024-01-02/uuid4/IMG_004.jpg',
        name: 'IMG_004.jpg',
      },
      has_thumbnail: true,
      css_style: '',
    },
  ],
  has_next: false,
  has_prev: true,
};

export const mockDateList = [
  { year: 2024, month: 1, day: 1 },
  { year: 2024, month: 1, day: 2 },
  { year: 2024, month: 1, day: 3 },
  { year: 2023, month: 12, day: 31 },
  { year: 2023, month: 12, day: 30 },
];

export const mockDateNum = {
  '2024-01-01': 25,
  '2024-01-02': 15,
  '2024-01-03': 8,
  '2023-12-31': 12,
  '2023-12-30': 20,
};

export const mockConfig = {
  import_to: '/test/import',
  export_from: ['/test/export'],
  thumbnail_store: '/test/thumbnails',
  page_size: 20,
  thumbnail_quality: 80,
  auto_import: false,
  notifications: true,
  theme: 'light',
};

export const mockUserPreferences = {
  theme: 'dark',
  pageSize: 30,
  defaultFilter: 'all',
  autoImport: true,
  showThumbnails: true,
  gridSize: 'medium',
};

export const mockImportFiles = [
  {
    path: '/test/import/IMG_001.jpg',
    name: 'IMG_001.jpg',
    size: 2048000,
    modified: '2024-01-01T12:00:00Z',
    is_image: true,
  },
  {
    path: '/test/import/IMG_002.jpg',
    name: 'IMG_002.jpg',
    size: 1024000,
    modified: '2024-01-01T12:15:00Z',
    is_image: true,
  },
  {
    path: '/test/import/document.pdf',
    name: 'document.pdf',
    size: 512000,
    modified: '2024-01-01T12:30:00Z',
    is_image: false,
  },
];

export const mockPhotoEditData = {
  brightness: 1.2,
  contrast: 1.1,
  saturation: 1.0,
  hue: 0,
  blur: 0,
  rotate: 0,
  flip_horizontal: false,
  flip_vertical: false,
  crop: null,
};

export const mockTauriResponses = {
  get_photos_unified: JSON.stringify(mockPhotos),
  get_dates: JSON.stringify(mockDateList),
  get_date_num: JSON.stringify(mockDateNum),
  get_config: JSON.stringify(mockConfig),
  get_user_preferences: JSON.stringify(mockUserPreferences),
  get_import_files: JSON.stringify(mockImportFiles),
  get_photo_edit_data: JSON.stringify(mockPhotoEditData),
};

export const createMockInvoke = (responses = {}) => {
  const allResponses = { ...mockTauriResponses, ...responses };
  
  return vi.fn((command, args) => {
    const response = allResponses[command];
    if (typeof response === 'function') {
      return Promise.resolve(response(args));
    }
    return Promise.resolve(response || '{}');
  });
};