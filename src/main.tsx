import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WidgetApp } from '@/pages/widget/WidgetApp';
import { AppRouter } from '@/router';
import '@/stores/settingsStore'; // 初始化主题（根节点 data-style/data-mode）并订阅系统明暗

import '@/styles/index.css';
import '@/styles/tokens.css';

/** 桌面组件窗口（M7）：URL 查询参数或窗口 label 任一命中即渲染紧凑四象限，不进主路由 */
const isWidgetWindow =
  '__TAURI_INTERNALS__' in window &&
  (new URLSearchParams(window.location.search).get('window') === 'widget' ||
    getCurrentWindow().label === 'widget');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isWidgetWindow ? <WidgetApp /> : <AppRouter />}</React.StrictMode>,
);

// PWA（清单 M5-4）：生产环境注册 Service Worker，离线可用；Tauri 桌面端跳过（tauri:// 协议不支持 SW）
if ('__TAURI_INTERNALS__' in window) {
  // 桌面端兜底：旧版本曾注册过 SW，其缓存会供出过期 index.html 导致白屏；
  // Rust 侧启动时已删 SW 目录，这里再注销一遍防残留（页面能跑起来的前提下）
  void navigator.serviceWorker
    ?.getRegistrations()
    .then((rs) => Promise.all(rs.map((r) => r.unregister())))
    .then(() => caches.keys())
    .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    .catch(() => {});
} else if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
