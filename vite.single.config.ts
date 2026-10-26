// Builds EzScene as ONE self-contained HTML file (used for the hosted preview).
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { outDir: 'dist-single', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 100000 }
});
