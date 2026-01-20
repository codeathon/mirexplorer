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
    outDir: resolve(__dirname, 'static/dist'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'main.jsx'),
        dropzone: resolve(__dirname, 'src/dropzone.jsx'),
        audioRecorder: resolve(__dirname, 'src/audioRecorder.jsx'),
        explorerUI: resolve(__dirname, 'src/explorerUI.jsx'),
        explorerTutorial: resolve(__dirname, 'src/explorerTutorial.jsx'),
        jsColor: resolve(__dirname, 'src/jsColor.jsx'),
      }
    }
  }
};