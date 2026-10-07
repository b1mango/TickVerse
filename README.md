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

- 四象限待办管理：支持连续录入、编辑、完成归档、删除撤销和跨象限拖拽，任务数据保存在本机
- macOS 桌面组件：四象限常驻桌面、拖边调尺寸、邻近吸附与原生组件避让；图钉锁定位置和尺寸，锁定后仍可编辑任务
- 外观设置：档案室 / 极简风格、明暗主题、字体切换，待办与组件字号、组件透明度可调
- 时间轴回顾：将任务沉淀为可缩放的时间地图，支持日、周、月、季、年等视图
- 完成统计：提供周 / 月 / 年趋势、连续打卡、空窗指标、完成清单和年度热力图
- AI 总结：通过 OpenAI 兼容接口生成周期总结，支持流式输出、模型选择与本地缓存
- 数据管理：支持 JSON 导出与导入；备份不包含 AI API Key 或 WebDAV 凭据
- WebDAV 同步：以单个 JSON 快照同步任务与总结，支持坚果云或自有 NAS，凭据仅存本机
- 多端使用：提供 Tauri 桌面端（Windows / macOS）与 PWA，主题偏好仅存本机

## 安装

从 [v0.0.1 Release](https://github.com/b1mango/TickVerse/releases/tag/v0.0.1) 下载 **TickVerse_0.0.1_aarch64.dmg**，打开后将 TickVerse 拖入 Applications。

本次提供 macOS Apple Silicon（M 系列）安装包；Intel Mac 和 Windows 暂无本次发行包。自用构建未做 Developer ID 签名与公证，首次打开若被系统拦截，可在“系统设置 → 隐私与安全性”中选择“仍要打开”。

### 桌面组件

在设置页开启组件。拖动“待办清单”标题移动，拖四边或四角调整大小；点击图钉固定，再次点击解锁。双击事项编辑，已归档事项可在时间轴取回。关闭主窗口后组件继续运行，退出使用 Cmd+Q。

### 数据与已知限制

- 数据保存在本机 IndexedDB；建议定期导出 JSON 备份。AI 总结会将相关任务内容发送至你配置的模型服务，启用 WebDAV 后快照会上传至你配置的服务器。
- API Key、WebDAV 凭据和外观偏好只保存在本机，不包含在导出快照中；本地凭据未加密。
- WebDAV 使用快照并集合并，删除尚不跨设备传播，远端旧任务可能被再次拉回。
- 桌面组件目前主要在 macOS 单屏环境验证，多屏混合缩放、长期悬停和完整鼠标拖动回归仍需继续验证。
- 组件保存锁定状态和尺寸，暂不保存桌面坐标；重启会重新摆放，过大尺寸会回到默认值。

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
