import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  // 相对路径产物：Tauri（tauri:// 协议）/ 任意子路径部署均可加载
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    watch: {
      // Rust 编译产物目录：构建中的 exe 会让 watcher 崩溃（EBUSY）
      ignored: ['**/src-tauri/target/**'],
    },
  },
  test: {
    passWithNoTests: true,
  },
});
