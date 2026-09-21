import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API server (server/index.js) only handles SMTP email. Everything else runs in the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
