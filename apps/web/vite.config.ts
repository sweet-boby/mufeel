import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 把项目站放在 https://<用户>.github.io/<仓库名>/ 这个子路径下，
  // 所以产物里的资源引用必须带这个前缀。运行时用到 BASE_URL 的地方
  // （Service Worker 注册、钢琴采样路径）会自动跟着走，不需要第二处改动。
  // 本地 `pnpm dev` / `pnpm preview` 也用这个前缀，保证开发时与线上路径一致。
  base: '/mufeel/',
  plugins: [react()],
  server: { port: 5173, open: false },
  resolve: {
    alias: {
      // core 是纯 TS 源码，不做构建产物，开发时直接吃源码，热更新最快。
      '@yuegan/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
});
