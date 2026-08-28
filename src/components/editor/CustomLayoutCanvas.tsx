import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import {
  clampToCanvas,
  clampWidth,
  resolveDrop,
  resolveResize,
  snapAxis,
  snapToGrid,
  type Point,
  type Rect,
  type Size,
} from '@/services/editorLayout';
import type { EditorModuleKey, EditorModulePlacement } from '@/types/settings';

const MODULE_KEYS: readonly EditorModuleKey[] = ['today', 'short', 'long'];

/** 模块中文名（无障碍标签用） */
const MODULE_LABEL: Record<EditorModuleKey, string> = { today: '今日', short: '短期', long: '长期' };

interface CustomLayoutCanvasProps {
  placements: Record<EditorModuleKey, EditorModulePlacement>;
  onPositionChange: (key: EditorModuleKey, pos: Point) => void;
  onWidthChange: (key: EditorModuleKey, w: number) => void;
  renderModule: (key: EditorModuleKey) => ReactNode;
}

interface DragState {
  key: EditorModuleKey;
  pointerStart: Point;
  /** 拖拽前位置：松手重叠时弹回这里 */
  origin: Point;
  /** 实时位置（已吸附 + 钳制） */
  current: Point;
}

interface ResizeState {
  key: EditorModuleKey;
  pointerStartX: number;
  /** 调宽前宽度：松手重叠时弹回这里 */
  originWidth: number;
  /** 实时宽度（已吸附 + 钳制） */
  current: number;
}

/**
 * 自定义布局画布：模块 absolute 定位，仅标题栏 GripVertical 手柄可拖（不与任务拖拽冲突）；
 * 右缘 4px 竖向热区可拖拽调宽（同样吃 24px 网格磁吸）；
 * 拖动/调宽中显示 24px 淡网格点并实时吸附，松手重叠则弹回，窗口缩放后钳制回画布内。
 */
export function CustomLayoutCanvas({
  placements,
  onPositionChange,
  onWidthChange,
  renderModule,
}: CustomLayoutCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const moduleRefs = useRef<Partial<Record<EditorModuleKey, HTMLDivElement>>>({});
  const [canvasSize, setCanvasSize] = useState<Size>({ width: 0, height: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);

  /** 画布高 = 视口高 − 画布顶 − 底部留白；宽随容器。窗口 resize 时重测 */
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setCanvasSize({
        width: rect.width,
        height: Math.max(320, window.innerHeight - rect.top - 24),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /** 模块宽：调宽中用实时值，否则用持久化宽；窄画布时收缩防溢出 */
  const moduleWidth = (key: EditorModuleKey): number => {
    const w = resize?.key === key ? resize.current : placements[key].w;
    return Math.min(w, canvasSize.width || w);
  };

  const moduleSize = (key: EditorModuleKey): Size => ({
    width: moduleWidth(key),
    height: moduleRefs.current[key]?.offsetHeight ?? 0,
  });

  // 窗口缩放 / 模块高度变化后，越界模块钳制回画布内（幂等，不会死循环）
  useEffect(() => {
    if (canvasSize.width === 0) return;
    for (const key of MODULE_KEYS) {
      const clamped = clampToCanvas(placements[key], moduleSize(key), canvasSize);
      if (clamped.x !== placements[key].x || clamped.y !== placements[key].y) {
        onPositionChange(key, clamped);
      }
    }
    // moduleSize 依赖 DOM 实测，仅在尺寸/位置变化时才有意义
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize, placements, onPositionChange]);

  const handlePointerDown = (key: EditorModuleKey) => (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const origin = placements[key];
    setDrag({ key, pointerStart: { x: e.clientX, y: e.clientY }, origin, current: origin });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!drag) return;
    const candidate = {
      x: drag.origin.x + e.clientX - drag.pointerStart.x,
      y: drag.origin.y + e.clientY - drag.pointerStart.y,
    };
    const current = clampToCanvas(snapToGrid(candidate), moduleSize(drag.key), canvasSize);
    setDrag({ ...drag, current });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const candidate = {
      x: drag.origin.x + e.clientX - drag.pointerStart.x,
      y: drag.origin.y + e.clientY - drag.pointerStart.y,
    };
    // 其他模块的当前矩形（持久化摆位 + 实测高度）用于重叠判定
    const others: Rect[] = MODULE_KEYS.filter((k) => k !== drag.key).map((k) => ({
      x: placements[k].x,
      y: placements[k].y,
      ...moduleSize(k),
    }));
    const settled = resolveDrop(candidate, moduleSize(drag.key), canvasSize, others);
    // 重叠 → settled 为 null，不写回即弹回拖拽前位置
    if (settled) onPositionChange(drag.key, settled);
    setDrag(null);
  };

  const handleResizeDown = (key: EditorModuleKey) => (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const originWidth = placements[key].w;
    setResize({ key, pointerStartX: e.clientX, originWidth, current: originWidth });
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!resize) return;
    const candidate = resize.originWidth + e.clientX - resize.pointerStartX;
    // 实时手感与松手结算同规则：吸附网格 + 钳区间 + 右缘不越画布
    const current = clampWidth(snapAxis(candidate), placements[resize.key].x, canvasSize.width);
    setResize({ ...resize, current });
  };

  const handleResizeUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!resize) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const candidate = resize.originWidth + e.clientX - resize.pointerStartX;
    // 其他模块的当前矩形（持久化摆位 + 实测高度）用于重叠判定
    const others: Rect[] = MODULE_KEYS.filter((k) => k !== resize.key).map((k) => ({
      x: placements[k].x,
      y: placements[k].y,
      ...moduleSize(k),
    }));
    const settled = resolveResize(
      placements[resize.key],
      candidate,
      moduleRefs.current[resize.key]?.offsetHeight ?? 0,
      canvasSize.width,
      others,
    );
    // 重叠 → settled 为 null，不写回即弹回调宽前宽度
    if (settled !== null) onWidthChange(resize.key, settled);
    setResize(null);
  };

  return (
    <div
      ref={canvasRef}
      className={`relative overflow-hidden rounded-card border border-line ${
        drag || resize ? 'custom-canvas-grid' : ''
      }`}
      style={{ height: canvasSize.height || undefined }}
    >
      {MODULE_KEYS.map((key) => {
        const dragging = drag?.key === key;
        const resizing = resize?.key === key;
        const pos = dragging ? drag.current : placements[key];
        return (
          <div
            key={key}
            ref={(el) => {
              moduleRefs.current[key] = el ?? undefined;
            }}
            className={`no-scrollbar absolute overflow-y-auto rounded-card ${
              dragging || resizing ? 'z-10 shadow-[var(--shadow-float)]' : ''
            }`}
            style={{
              left: pos.x,
              top: pos.y,
              width: moduleSize(key).width,
              maxHeight: '100%',
            }}
          >
            {/* 拖拽手柄：仅此区域可拖动模块（整个卡片可拖会与任务交互冲突） */}
            <button
              type="button"
              aria-label={`拖动${MODULE_LABEL[key]}模块`}
              onPointerDown={handlePointerDown(key)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute right-3 top-5 z-10 cursor-grab touch-none text-sub transition-colors hover:text-ink active:cursor-grabbing"
            >
              <GripVertical size={16} />
            </button>
            {/* 调宽手柄：右缘 4px 竖向热区，hover/拖动中显示 accent 竖线；与 GripVertical 错位不冲突 */}
            <button
              type="button"
              aria-label={`调整${MODULE_LABEL[key]}模块宽度`}
              onPointerDown={handleResizeDown(key)}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeUp}
              className="group absolute bottom-0 right-0 top-0 z-10 w-1 cursor-ew-resize touch-none"
            >
              <span
                className={`absolute right-0 top-1/2 h-12 w-1 -translate-y-1/2 rounded-full bg-accent transition-opacity ${
                  resizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              />
            </button>
            {renderModule(key)}
          </div>
        );
      })}
    </div>
  );
}
