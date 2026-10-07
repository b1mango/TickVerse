# TickVerse

<p align="center">
  <img src="public/icons/icon-192.png" alt="TickVerse" width="112" height="112" />
</p>

<p align="center">本地优先的个人待办与回望工具</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.1-2ea043" alt="version 0.0.1" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-1f6feb" alt="Windows and macOS" />
  <a href="#license"><img src="https://img.shields.io/badge/license-pending-f5c542" alt="license pending" /></a>
</p>

## 功能

- 四象限 / 四列待办管理
- macOS 桌面组件，支持拖动、缩放和图钉固定
- 主题、字体、字号与组件透明度设置
- 待办归档与取回
- 时间轴回顾与完成统计
- AI 周期总结
- JSON 数据导入与导出
- WebDAV 同步
- 桌面端与 PWA

## 安装

从 [Releases](https://github.com/b1mango/TickVerse/releases/tag/v0.0.1) 下载 macOS Apple Silicon 安装包，打开 DMG，将 TickVerse 拖入 Applications。首次打开若被拦截，在“系统设置 → 隐私与安全性”选择“仍要打开”。

## 开发

需要 Node.js 20+；桌面构建还需要 Rust 和对应平台构建工具，macOS 使用 Xcode Command Line Tools。

```bash
npm ci
npx tauri dev        # 桌面端开发
npm run dev          # Web 端开发（Vite）
npm run test         # 单元测试（Vitest）
npm run lint         # ESLint（零警告门禁）
npm run build        # TypeScript 检查并构建 dist/
cargo test --manifest-path src-tauri/Cargo.toml  # 窗口几何测试
npx tauri build      # 构建 Tauri 桌面安装包
```

## 代码结构

React 18 + TypeScript + Vite，Tauri 2 桌面壳，Zustand 管理界面偏好，Dexie 管理任务数据。

| 目录 | 职责 |
| --- | --- |
| `src/pages` / `src/components` | 页面、组件及交互 |
| `src/services` | 任务、统计、同步等业务逻辑 |
| `src/db` | IndexedDB 与 repository |
| `src/adapters` | 桌面命令、HTTP、模型与 WebDAV 接入 |
| `src/stores` / `src/types` | 状态和类型定义 |
| `src-tauri/src` | 原生窗口生命周期、尺寸与吸附 |

写操作主要沿 UI → service → repository 流动；同步和备份服务仍直接访问数据库。桌面窗口逻辑尚集中在 `lib.rs`，后续优先拆分几何计算、macOS 适配和命令调度。

## License

许可证待定。
