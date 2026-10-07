import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppWindow } from 'lucide-react';
import {
  beginWidgetResize,
  endWidgetResize,
  setWidgetFrame,
  setWidgetSize,
  showMainWindow,
  snapWidgetNow,
  setWidgetOpacity,
} from '@/adapters/desktopWidget';
import type { WidgetResizeDirection } from '@/adapters/desktopWidget';
import { QuadrantBoardMini } from '@/components/task/QuadrantBoardMini';
import { Toast } from '@/components/ui/Toast';
import { useSettingsStore } from '@/stores/settingsStore';
import { THEME_STORAGE_KEY, WIDGET_FONT_BASE_PX, WIDGET_STORAGE_KEY } from '@/types/settings';

/**
 * 边框全域调尺寸（2026-10-07 修订十六）：四边四角 8 条透明热区。
 * macOS 侧用 AppKit 原生 frame 一次性更新原点与尺寸，避免 tao 的 set_size/set_position
 * 异步竞态；屏幕坐标增量不受窗口移动和 CSS zoom 影响，尺寸落盘走既有 onResized 防抖。
 */
const RESIZE_HANDLES: readonly { dir: WidgetResizeDirection; className: string }[] = [
  // 边热区 12px、角热区 20px（8px 实测命中率低，"下方有时候拉不动"）
  { dir: 'North', className: 'top-0 inset-x-5 h-3 cursor-n-resize' },
  { dir: 'South', className: 'bottom-0 inset-x-5 h-3 cursor-s-resize' },
  { dir: 'East', className: 'right-0 inset-y-5 w-3 cursor-e-resize' },
  { dir: 'West', className: 'left-0 inset-y-5 w-3 cursor-w-resize' },
  { dir: 'NorthEast', className: 'right-0 top-0 h-5 w-5 cursor-ne-resize' },
  { dir: 'NorthWest', className: 'left-0 top-0 h-5 w-5 cursor-nw-resize' },
  { dir: 'SouthEast', className: 'right-0 bottom-0 h-5 w-5 cursor-se-resize' },
  { dir: 'SouthWest', className: 'left-0 bottom-0 h-5 w-5 cursor-sw-resize' },
];

function startResize(dir: WidgetResizeDirection, onResizeState: (active: boolean) => void) {
  return (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startClient = { x: e.screenX, y: e.screenY };
    type NativeFrame = Awaited<ReturnType<typeof beginWidgetResize>>;
    let startFrame: NativeFrame | null = null;
    let latestPoint = { x: e.screenX, y: e.screenY };
    let latestFrame: NativeFrame | null = null;
    let writing = false;
    let ended = false;

    onResizeState(true);

    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      onResizeState(false);
    };

    const finishWhenIdle = async () => {
      if (writing || latestFrame) return;
      await endWidgetResize();
      cleanup();
    };

    const flush = async () => {
      if (writing || !latestFrame) return;
      writing = true;
      const frame = latestFrame;
      latestFrame = null;
      await setWidgetFrame(frame, dir).catch(() => undefined);
      writing = false;
      if (latestFrame) {
        void flush();
      } else if (ended) {
        void finishWhenIdle();
      }
    };

    const updateFrame = (point: { x: number; y: number }) => {
      if (!startFrame) return;
      const dx = point.x - startClient.x;
      const dy = point.y - startClient.y;
      let { width, height, x, y } = startFrame;
      if (dir.includes('East')) width = startFrame.width + dx;
      if (dir.includes('West')) {
        width = startFrame.width - dx;
        x = startFrame.x + dx;
      }
      // AppKit 原点在左下角：South 边向下移动时，原点 y 反向移动；North 只改变高度。
      if (dir.includes('South')) {
        height = startFrame.height + dy;
        y = startFrame.y - dy;
      }
      if (dir.includes('North')) height = startFrame.height - dy;
      latestFrame = {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      };
      void flush();
    };

    const move = (ev: PointerEvent) => {
      if (ended) return;
      latestPoint = { x: ev.screenX, y: ev.screenY };
      updateFrame(latestPoint);
    };

    const finish = () => {
      if (ended) return;
      ended = true;
      void flush();
      void finishWhenIdle();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: false });
    window.addEventListener('pointercancel', finish, { once: false });

    void beginWidgetResize()
      .then((frame) => {
        startFrame = frame;
        if (ended) {
          void finishWhenIdle();
        } else {
          updateFrame(latestPoint);
        }
      })
      .catch(() => {
        ended = true;
        cleanup();
      });
  };
}

/**
 * 桌面组件壳（M7）：透明无边框窗口 + 顶部拖动条 + 紧凑 2x2 四象限。
 * 与主窗口同源（共享 IndexedDB 与 localStorage）：任务改动经 Dexie liveQuery
 * 跨上下文自动同步；主题/组件偏好改动经 storage 事件即时跟随。
 * 整体缩放用 CSS zoom 实现字号档位（WebKit 支持，布局不受影响）；
 * 四边四角全域拉拽调尺寸，拖停后落盘（逻辑像素），下次启动恢复。
 */
export function WidgetApp() {
  const font = useSettingsStore((s) => s.widget.font);
  const opacity = useSettingsStore((s) => s.widget.opacity);
  const resizingRef = useRef(false);

  useEffect(() => {
    // 透明窗口的 body 底色透化（index.css 按此属性覆盖）
    document.documentElement.dataset.window = 'widget';
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) useSettingsStore.getState().reloadTheme();
      if (e.key === WIDGET_STORAGE_KEY) useSettingsStore.getState().reloadWidget();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    // 组件窗口与主窗口分别由 AppKit 持有 alpha；偏好同步或窗口重建后显式恢复，
    // 防止拖拽态/窗口状态变化把用户设置误认为组件自身透明。
    void setWidgetOpacity(opacity);
  }, [opacity]);

  // 松手快路：native 拖窗收不到 pointerup 时由 Rust 600ms 静默兜底，这里双保险（幂等）
  useEffect(() => {
    const up = () => {
      if (!resizingRef.current) void snapWidgetNow();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // 尺寸落盘：拖拽连续触发 onResized，防抖 400ms 取终值换算逻辑像素
  useEffect(() => {
    const win = getCurrentWindow();
    let timer: number | undefined;
    const unlisten = win.onResized(({ payload }) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void win.scaleFactor().then((sf) => {
          useSettingsStore.getState().setWidget({
            width: Math.round(payload.width / sf),
            height: Math.round(payload.height / sf),
          });
        });
      }, 400);
    });
    return () => {
      window.clearTimeout(timer);
      void unlisten.then((off) => off());
    };
  }, []);

  return (
    <div
      className="relative flex flex-col overflow-hidden p-2"
      style={{ zoom: font / WIDGET_FONT_BASE_PX, height: `calc(100dvh / ${font / WIDGET_FONT_BASE_PX})` }}
    >
      {/* 拖动条（data-tauri-drag-region）：仅此条可拖窗；双击复位默认尺寸（2026-10-07 修订十三） */}
      <header className="flex h-7 shrink-0 select-none items-center">
        <span
          data-tauri-drag-region
          onDoubleClick={() => void setWidgetSize(600, 460)}
          onPointerUp={() => void snapWidgetNow()}
          title="拖动移动位置 · 双击复位尺寸"
          className="flex flex-1 items-center self-stretch px-1 font-mono text-caption text-sub"
        >
          待办清单
        </span>
        <button
          onClick={() => void showMainWindow()}
          title="打开主窗口"
          className="px-1 text-sub transition-colors hover:text-ink"
        >
          <AppWindow size={13} />
        </button>
      </header>

      <QuadrantBoardMini />
      <Toast />

      {/* 边框全域调尺寸热区（z 置顶，置于根 p-2 留白带，不遮卡片交互） */}
      {RESIZE_HANDLES.map(({ dir, className }) => (
        <div
          key={dir}
          onPointerDown={startResize(dir, (active) => {
            resizingRef.current = active;
          })}
          className={`absolute z-50 touch-none ${className}`}
        />
      ))}
    </div>
  );
}
