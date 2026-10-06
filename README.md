# 拾刻 TickVerse

一款本地优先的个人待办与回望工具——用四象限（艾森豪威尔矩阵）管理待办，沉淀成可缩放的时间轴，再用统计与 AI 总结把勾掉的事升维成叙事。档案室水墨视觉，数据不出本机。

## 功能

- **记录页**：四象限（重要且紧急 / 重要不紧急 / 紧急不重要 / 不重要不紧急），连续录入、勾选归档、双击编辑、删除可撤销；跨象限拖拽（浮层抬升投影、目标列高亮 + 让位过渡、reduced-motion 降级）；两种版式（四列响应式 / 固定 2x2 宫格）+ 列右缘拖调宽度 + 一键恢复等宽，均本地持久化；列卡定高、超长列内纵滚
- **时间轴**：全部记录沉淀为可连续缩放的时间地图，六档视图（日 / 周 / 月 / 季 / 年 / 年视图），Ctrl+滚轮 / 左下 ＋− 控件换档、捏合缩放、滚轮分区（卡片定高内纵滚、刻度带上横向滑轴）、年份水墨标记与轴体居中对称；象限任务按虚线投影落在写入当日卡
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
- 本机首次启动且库为空时自动写入四象限初始待办（带 seed 标签，可在设置页"初始数据"一键清除）
