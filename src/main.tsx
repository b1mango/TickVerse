import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from '@/router';
import '@/stores/settingsStore'; // 初始化主题（根节点 data-style/data-mode）并订阅系统明暗

import '@/styles/index.css';
import '@/styles/tokens.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
