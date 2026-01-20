import { resolve } from 'path';

export default {
  server: {
    port: 3000,
    strictPort: true,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    }
  },

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'main.jsx')
      }
    }
  }
};
