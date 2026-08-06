import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // CSS Modules configuration
  css: {
    modules: {
      // Allow both kebab-case in CSS and camelCase in JS
      localsConvention: 'camelCase',
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    hmr: {
      overlay: false // Disable error overlay for better development experience on Windows
    },
    watch: {
      // src-tauri/target/** generates tens of thousands of files during a
      // tauri dev build (cargo intermediate artifacts) which trips the
      // Linux inotify watcher limit (ENOSPC). Ignore them at the watcher
      // level so vite doesn't try to subscribe.
      ignored: [
        '**/example/**',
        '**/public/**',
        '**/src-tauri/target/**',
        '**/src-tauri/.cargo/**',
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
      ],
      usePolling: process.platform === 'win32', // Use polling on Windows for better stability
      interval: 1000 // Polling interval for Windows
    }
  },
  // to make use of `TAURI_DEBUG` and other env variables
  // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri supports es2021
    target: ["es2021", "chrome100", "safari13"],
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    // Increase chunk size warning limit to 1MB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core libraries
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }
          
          // Charts library
          if (id.includes('recharts')) {
            return 'charts';
          }
          
          // Tauri plugins
          if (id.includes('@tauri-apps')) {
            return 'tauri-vendor';
          }
          
          // Utility libraries
          if (id.includes('axios') || id.includes('classnames') || 
              id.includes('i18next') || id.includes('react-i18next')) {
            return 'utils';
          }
          
          // Large node_modules dependencies
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  },
});
