import { invoke } from '@tauri-apps/api/core';

/** Tauri 桌面端判定（PWA / 浏览器下下列调用全部空转） */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** 桌面组件（M7 第二窗口）显隐 */
export async function setWidgetVisible(visible: boolean): Promise<void> {
  if (!isTauri) return;
  await invoke('widget_set_visible', { visible });
}

/** 组件窗口尺寸（逻辑像素）：组件边缘直拖的结果启动时恢复 */
export async function setWidgetSize(width: number, height: number): Promise<void> {
  if (!isTauri) return;
  await invoke('widget_set_size', { width, height });
}

/** macOS AppKit 的原生窗口 frame（左下角坐标，尺寸为逻辑点） */
export interface WidgetNativeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 开始一次八向 resize：返回 AppKit 真实 frame，并暂停位置吸附计时器 */
export async function beginWidgetResize(): Promise<WidgetNativeFrame> {
  if (!isTauri) return { x: 0, y: 0, width: 600, height: 460 };
  return invoke<WidgetNativeFrame>('widget_resize_begin');
}

/** 原子提交完整 frame；macOS 侧在主线程一次 setFrame 同时更新原点与尺寸 */
export async function setWidgetFrame(frame: WidgetNativeFrame): Promise<void> {
  if (!isTauri) return;
  await invoke('widget_set_frame', { ...frame });
}

/** 结束 resize，之后才允许 Moved/pointerup 吸附 */
export async function endWidgetResize(): Promise<void> {
  if (!isTauri) return;
  await invoke('widget_resize_end');
}

/** 组件透明度（0.3–1.0，macOS NSWindow alpha） */
export async function setWidgetOpacity(opacity: number): Promise<void> {
  if (!isTauri) return;
  await invoke('widget_set_opacity', { opacity });
}

/** 松手立即吸附（pointerup 快路；超时未触发由 Rust 600ms 静默兜底） */
export async function snapWidgetNow(): Promise<void> {
  if (!isTauri) return;
  await invoke('widget_snap_now');
}

/** 显示并聚焦主窗口（桌面组件头部按钮） */
export async function showMainWindow(): Promise<void> {
  if (!isTauri) return;
  await invoke('main_window_show');
}
