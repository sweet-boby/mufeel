import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  resolve: {
    alias: {
      // core 是纯 TS 源码，不做构建产物，开发时直接吃源码，热更新最快。
      '@yuegan/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
});
