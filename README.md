# TickVerse

<p align="center">
  <img src="public/icons/icon-192.png" alt="TickVerse" width="112" height="112" />
</p>

<p align="center">本地优先的个人待办与回望工具</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-development-2ea043" alt="status development" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-1f6feb" alt="Windows and macOS" />
  <a href="#license"><img src="https://img.shields.io/badge/license-pending-f5c542" alt="license pending" /></a>
</p>

## 功能

- 四象限待办管理：支持连续录入、编辑、完成归档、删除撤销和跨象限拖拽，任务数据保存在本机
- 时间轴回顾：将任务沉淀为可缩放的时间地图，支持日、周、月、季、年等视图
- 完成统计：提供周 / 月 / 年趋势、连续打卡、空窗指标、完成清单和年度热力图
- AI 总结：通过 OpenAI 兼容接口生成周期总结，支持流式输出、模型选择与本地缓存
- 数据管理：支持 JSON 导出与导入；备份不包含 AI API Key 或 WebDAV 凭据
- WebDAV 同步：以单个 JSON 快照同步任务与总结，支持坚果云或自有 NAS，凭据仅存本机
- 多端使用：提供 Tauri 桌面端（Windows / macOS）与 PWA，主题偏好仅存本机

## 安装

当前仓库尚未发布 GitHub Release。克隆源码并安装依赖后，可运行 Web / PWA 开发版本；需要桌面安装包时，请按开发命令执行 Tauri 构建。

## 开发

```bash
npm install
npm run dev          # Web 端开发（Vite）
npm run test         # 单元测试（Vitest）
npm run lint         # ESLint（零警告门禁）
npm run build        # TypeScript 检查并构建 dist/
npx tauri build      # 构建 Tauri 桌面安装包
```

## License

许可证待定。
