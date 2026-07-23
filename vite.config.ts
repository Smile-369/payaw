import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 16_000,
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 30 },
            { name: 'world-engine', test: /src[\\/]engine[\\/]/, priority: 20 },
            { name: 'campaign-domain', test: /src[\\/](campaign|authoring)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
