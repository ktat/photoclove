import eslint from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['dist/**', 'build/**', 'node_modules/**', 'src-tauri/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        crypto: 'readonly',
        CustomEvent: 'readonly',
        Date: 'readonly',
        JSON: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        atob: 'readonly',
        btoa: 'readonly'
      }
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      
      // Custom rule to detect hardcoded pixel values
      'no-restricted-syntax': [
        'warn',
        {
          // Detect hardcoded pixel values in style objects
          selector: "Property[key.name=/^(padding|margin|borderRadius|fontSize|gap|top|right|left|bottom|width|height|minWidth|minHeight|maxWidth|maxHeight|lineHeight)$/] > Literal[value=/^\\d+px$/]",
          message: "Avoid hardcoded pixel values. Use CSS variables from the design system instead (e.g., var(--space-2) for 8px, var(--radius-sm) for 4px)."
        },
        {
          // Also check for string literals containing pixel values
          selector: "Property[key.name=/^(padding|margin|borderRadius|fontSize|gap|top|right|left|bottom|width|height|minWidth|minHeight|maxWidth|maxHeight|lineHeight)$/] > Literal[value=/^'\\d+px'$/]",
          message: "Avoid hardcoded pixel values in strings. Use CSS variables: var(--space-*) for spacing, var(--radius-*) for border radius."
        },
        {
          // Check double-quoted strings too
          selector: "Property[key.name=/^(padding|margin|borderRadius|fontSize|gap|top|right|left|bottom|width|height|minWidth|minHeight|maxWidth|maxHeight|lineHeight)$/] > Literal[value=/^\"\\d+px\"$/]",
          message: "Avoid hardcoded pixel values. Reference: 4px→var(--space-1), 8px→var(--space-2), 12px→var(--space-3), 16px→var(--space-4), 20px→var(--space-5), 24px→var(--space-6)"
        }
      ],
      
      // React specific rules
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      
      // General rules
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': ['warn', {
        allow: ['warn', 'error', 'info']
      }]
    }
  },
  {
    files: ['src/test/**/*.js', '**/*.test.{js,ts,jsx,tsx}'],
    languageOptions: {
      globals: {
        global: 'writable',
        afterEach: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        beforeAll: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        test: 'readonly',
      }
    }
  }
];