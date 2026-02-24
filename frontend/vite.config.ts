/// <reference types="vitest" />
import path from "path"
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import { defineConfig, type UserConfig } from 'vite'
import type { InlineConfig } from 'vitest/node'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VitestConfigExport extends UserConfig {
  test: InlineConfig;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: true,
  },
} as VitestConfigExport)
