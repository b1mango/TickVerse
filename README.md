# 拾刻 TickVerse

一款本地优先的个人待办与回望工具——把"今日 / 短期 / 长期"三档清单沉淀成可缩放的时间轴，再用统计与 AI 总结把勾掉的事升维成叙事。档案室水墨视觉，数据不出本机。

## 功能

- **记录页**：今日 / 短期 / 长期三档清单，连续录入、勾选归档、双击编辑、跨模块拖拽排序、删除可撤销；未完成的今日事次日自动滚存并标记"昨日遗留"；四种布局模式（竖向 / 横向 / 左今右分 / 自定义磁吸摆位 + 自由调宽）
- **时间轴**：全部记录沉淀为可连续缩放的时间地图，六档视图（日 / 周 / 月 / 季 / 年 / 年视图），Ctrl+滚轮换档、捏合缩放、滚轮分区（卡片上纵向预览、刻度带上横向滑轴）、年份水墨标记、长期目标右侧长列
- **回望**：周 / 月 / 年完成趋势图、GitHub 风年度热力图、连续打卡与空窗指标；**AI 总结**（OpenAI 兼容接口，流式输出、切页不中断、可选模型、结果缓存可手改，生成前有一次性隐私说明）
- **多端**：Tauri Windows 桌面端 + PWA；**WebDAV 同步**（坚果云 / 自有 NAS）与 JSON 导出备份
- **视觉**：档案室 / 极简双风格 × 明 / 暗 / 跟随系统，全局水墨无背景滑动条

## 技术栈

React 19 · TypeScript · Vite · Tailwind CSS · Zustand · Dexie（IndexedDB）· dnd-kit · @tanstack/react-virtual · GSAP · ECharts · Tauri 2

## 开发

```bash
npm install
npm run dev          # Web 端开发（5173）
npm run test         # 单元测试（vitest）
npm run lint         # ESLint（零警告门禁）
npm run build        # 产出 dist/
npx tauri build      # 打包 Windows 安装包（NSIS/MSI）
```

## 说明

- 数据仅存本机（IndexedDB / localStorage），API Key 不随备份与同步外传
- AI 总结接入任意 OpenAI 兼容服务（DeepSeek / Kimi / 通义等），在设置页填 Base URL 与 Key 后获取模型列表勾选即可
- 设置页"演示数据"可一键填充 / 清除 2025-08 至今的示例记录，便于体验时间轴与统计
