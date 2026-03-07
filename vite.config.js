import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // Ensure OpenAI SDK is not bundled in frontend
      external: (id) => {
        // Exclude OpenAI and related packages from frontend bundle
        return id === 'openai' || id.startsWith('openai/');
      }
    }
  },
  optimizeDeps: {
    // Exclude OpenAI from dependency optimization
    exclude: ['openai']
  },
  ssr: {
    // Don't externalize OpenAI for SSR (we don't use SSR, but just in case)
    noExternal: []
  }
});

