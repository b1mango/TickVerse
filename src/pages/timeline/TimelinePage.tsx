import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import dayjs from 'dayjs';
import { gsap } from 'gsap';
import { Minus, Plus, Ruler } from 'lucide-react';
import { TimelineColumn } from '@/components/timeline/TimelineColumn';
import { ZoomRuler } from '@/components/timeline/ZoomRuler';
import { useAllTasks } from '@/hooks/useTasks';
import {
  buildZoomView,
  clampPxPerDay,
  DEFAULT_ZOOM_PX,
  levelForPxPerDay,
  snapPxPerDay,
  ZOOM_STOPS,
  type ZoomColumn,
} from '@/services/timelineService';
import { tokenDuration } from '@/utils/motion';

const GAP = 16; // 列间距（2026-10-06 用户反馈卡片贴脸，加大）
const COLUMN_HEIGHT = 300;

/**
 * 时间轴总览页（M3）：可连续缩放的时间地图。
 * Ctrl+滚轮离散换档 / 左下可视缩放控件（＋/－）/ 触屏捏合连续缩放（像素位置 = (日期 − 起始日) × 像素/天），
 * 松手磁吸归位六档（expo.out 自然减速）；裸滚轮 = 横向滑动；六档模板 + 虚拟滚动；边界锁在日档与年视图档之间。
 * 正上方"—— 年份 ——"水墨标记随可视窗口中心日期切换（2026-08-28 用户钦定）；
 * 象限任务以虚线投影落在写入当日卡，悬浮代办长列已移除（2026-10-06 用户钦定）。
 */
export function TimelinePage() {
  const tasks = useAllTasks();
  const [pxPerDay, setPxPerDay] = useState(DEFAULT_ZOOM_PX);
  const level = levelForPxPerDay(pxPerDay);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pxRef = useRef(pxPerDay);
  pxRef.current = pxPerDay;
  /** 缩放锚点：指针下的日期，缩放/换档后保持其像素位置不动 */
  const anchorRef = useRef<{ date: number; x: number } | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout>>();
  const snapTween = useRef<gsap.core.Tween | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef(0);

  const now = Date.now();
  const view = useMemo(
    () => (tasks ? buildZoomView(tasks, level, now) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, level],
  );
  /** 滚轮档位跳跃的滚动量累加器（一次滚轮刻度 = 一档） */
  const wheelAcc = useRef(0);
  const wheelDecay = useRef<ReturnType<typeof setTimeout>>();

  /** 可视窗口宽（轴内容短于窗口时，内容需以窗口中心对称铺开，2026-10-06 用户钦定） */
  const [vpWidth, setVpWidth] = useState(0);
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    setVpWidth(vp.clientWidth);
    const ro = new ResizeObserver(() => setVpWidth(vp.clientWidth));
    ro.observe(vp);
    return () => ro.disconnect();
  }, [view]);

  /**
   * 轴内容比窗口窄时，两侧各补 padLeft 使轴体以窗口中心（= 年份中线）左右对称；
   * GAP 为末列右侧 padding 补偿（卡片实际跨度不含尾随列间距）。
   */
  const axisPad = (clientWidth: number): number =>
    Math.max(0, (clientWidth - (virtualizer.getTotalSize() - GAP)) / 2);

  /** 正上方年份标记：可视窗口中心日期所属年份，随滚动/缩放切换 */
  const [centerYear, setCenterYear] = useState(() => dayjs().year());
  const updateCenterYear = () => {
    const vp = viewportRef.current;
    if (!vp || !view || view.empty || view.columns.length === 0) return;
    const date =
      view.columns[0].start +
      ((vp.scrollLeft + vp.clientWidth / 2 - axisPad(vp.clientWidth)) / pxRef.current) * 86400000;
    setCenterYear(dayjs(date).year());
  };

  const items = useMemo(() => {
    if (!view || view.empty) return [];
    return view.columns.map((c) => ({
      key: String(c.start),
      width: c.days * pxPerDay + GAP,
      column: c as ZoomColumn,
    }));
  }, [view, pxPerDay]);

  const virtualizer = useVirtualizer({
    horizontal: true,
    count: items.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (i) => items[i]?.width ?? 100,
    overscan: 4,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, items]);

  /** 连续缩放（含换档）：锚定指针下日期 */
  const applyZoom = (nextPx: number, clientX: number) => {
    const vp = viewportRef.current;
    if (!vp || !view || view.empty || view.columns.length === 0) return;
    const rect = vp.getBoundingClientRect();
    const x = clientX - rect.left;
    const base = view.columns[0].start;
    anchorRef.current = {
      date: base + ((vp.scrollLeft + x - axisPad(vp.clientWidth)) / pxRef.current) * 86400000,
      x,
    };
    setPxPerDay(clampPxPerDay(nextPx));
  };

  /** 档位/像素变化渲染后，恢复锚点位置 */
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const anchor = anchorRef.current;
    if (!vp || !anchor || !view || view.columns.length === 0) return;
    vp.scrollLeft =
      ((anchor.date - view.columns[0].start) / 86400000) * pxPerDay +
      axisPad(vp.clientWidth) -
      anchor.x;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxPerDay, view]);

  /** 首次就绪：滚到最右端（今天） */
  const scrolledOnce = useRef(false);
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !view || view.empty || scrolledOnce.current) return;
    scrolledOnce.current = true;
    vp.scrollLeft = vp.scrollWidth;
  }, [view]);

  /** 缩放/换档/数据变化/首次滚动到位后同步年份标记（须在 scroll-to-end 之后执行） */
  useLayoutEffect(updateCenterYear);

  /** 松手磁吸：捏合静止 160ms 后吸附最近档位（iOS 式自然减速，无回弹） */
  const scheduleSnap = (clientX: number) => {
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      const stop = snapPxPerDay(pxRef.current);
      if (stop.pxPerDay === pxRef.current) return;
      const proxy = { px: pxRef.current };
      snapTween.current?.kill();
      snapTween.current = gsap.to(proxy, {
        px: stop.pxPerDay,
        duration: tokenDuration('--dur-normal', 300) / 1000,
        ease: 'expo.out', // 2026-08-28 用户钦定：换掉左右弹动的 back.out，改 iOS 自然减速
        onUpdate: () => applyZoom(proxy.px, clientX),
      });
    }, 160);
  };

  /** 滚轮离散换档：一次滚轮刻度跳一档，动画为 iOS 式 expo.out 自然过渡 */
  const jumpToStop = (dir: 1 | -1, clientX: number) => {
    const cur = snapPxPerDay(pxRef.current);
    const idx = ZOOM_STOPS.findIndex((s) => s.level === cur.level);
    const next = ZOOM_STOPS[idx + dir];
    if (!next) return; // 已在边界档，不动（不弹动）
    const proxy = { px: pxRef.current };
    snapTween.current?.kill();
    snapTween.current = gsap.to(proxy, {
      px: next.pxPerDay,
      duration: tokenDuration('--dur-slow', 450) / 1000,
      ease: 'expo.out',
      onUpdate: () => applyZoom(proxy.px, clientX),
    });
  };

  /** 可视缩放控件：以视口中心为锚点换档（与滚轮换档同一套 jumpToStop 磁吸动画） */
  const zoomBy = (dir: 1 | -1) => {
    const vp = viewportRef.current;
    if (!vp) return;
    jumpToStop(dir, vp.getBoundingClientRect().left + vp.clientWidth / 2);
  };

  /** 滚轮：Ctrl+滚轮 = 离散换档缩放（一次刻度 = 一档，任何位置生效）；
   *  裸滚轮 = 横向滑动；但悬停在卡片内可纵向滚动清单（data-card-scroll）上时放行原生纵向滚动（2026-08-28/29 用户钦定） */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2) return; // 触控板横滑原样放行
      if (!e.ctrlKey && !e.metaKey) {
        // 卡片内纵向滚动清单（含"展开更多"浮层）：裸滚轮放行原生纵向滚动
        if ((e.target as HTMLElement).closest('[data-card-scroll]')) return;
        e.preventDefault();
        vp.scrollLeft += e.deltaY; // 刻度带/空白处：裸滚轮 → 横向滑动条
        return;
      }
      e.preventDefault();
      wheelAcc.current += e.deltaY;
      clearTimeout(wheelDecay.current);
      wheelDecay.current = setTimeout(() => {
        wheelAcc.current = 0;
      }, 200);
      // 触控板连续小步长也会累积过阈值；一次跳跃后清零重来
      if (Math.abs(wheelAcc.current) >= 50) {
        const dir = wheelAcc.current > 0 ? 1 : -1;
        wheelAcc.current = 0;
        jumpToStop(dir, e.clientX);
      }
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /** 触屏双指捏合 */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const dist = () => {
      const [a, b] = [...pointers.current.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const midX = () => {
      const [a, b] = [...pointers.current.values()];
      return (a.x + b.x) / 2;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) pinchDist.current = dist();
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2 && pinchDist.current > 0) {
        const next = dist();
        snapTween.current?.kill();
        applyZoom(pxRef.current * (next / pinchDist.current), midX());
        pinchDist.current = next;
        scheduleSnap(midX());
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinchDist.current = 0;
    };
    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', onUp);
    vp.addEventListener('pointercancel', onUp);
    return () => {
      vp.removeEventListener('pointerdown', onDown);
      vp.removeEventListener('pointermove', onMove);
      vp.removeEventListener('pointerup', onUp);
      vp.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(
    () => () => {
      clearTimeout(snapTimer.current);
      snapTween.current?.kill();
    },
    [],
  );

  if (!view) {
    /* 加载骨架：line 色呼吸（方向稿 §11） */
    return (
      <div className="mx-auto max-w-[1500px] animate-pulse px-6 pb-32 pt-16">
        <div className="h-10 rounded-full bg-line" />
        <div className="mt-6 grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-72 rounded-card bg-line" />
          ))}
        </div>
      </div>
    );
  }

  if (view.empty) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 pb-32 text-center">
        <Ruler size={48} strokeWidth={1} className="text-sub" />
        <p className="font-display text-display-2">勾掉的事，会在这里沉淀成刻度</p>
        <p className="font-mono text-caption text-sub">先去待办页拾起一刻</p>
      </div>
    );
  }

  const visible = virtualizer.getVirtualItems();
  // 档位指示 = 当前可视窗口范围（跨年带年份）
  const visibleCols = visible
    .map((vi) => items[vi.index]?.column)
    .filter((c): c is ZoomColumn => !!c);
  const rangeFrom = visibleCols[0]?.start ?? view.start;
  const rangeTo = visibleCols[visibleCols.length - 1]?.start ?? view.end;
  const rangeFmt = dayjs(rangeFrom).isSame(dayjs(rangeTo), 'year') ? 'MM/DD' : 'YYYY/MM';

  const totalSize = virtualizer.getTotalSize();
  /** 轴内容短于窗口时的居中补偿：让轴体左右可见长度以年份中线对称（GAP = 末列尾随间距补偿） */
  const padLeft = Math.max(0, (vpWidth - (totalSize - GAP)) / 2);

  return (
    <div className="mx-auto max-w-[1500px] px-6 pb-32 pt-16">
      {/* 正上方年份标记：水墨双划线 + 可视中心年份，随滚动切换（2026-08-28 用户钦定） */}
      <div
        className="pointer-events-none mb-4 flex items-center justify-center gap-4"
        aria-live="polite"
      >
        <span className="h-px w-24 bg-gradient-to-r from-transparent via-ink/35 to-ink/55" />
        <span className="font-display text-lg tracking-[0.3em] text-ink/80">{centerYear}</span>
        <span className="h-px w-24 bg-gradient-to-l from-transparent via-ink/35 to-ink/55" />
      </div>

      {/* 时间轴占满页面内容宽：年份中线即轴体中心；悬浮代办长列已移除（2026-10-06 用户钦定） */}
      <div
        ref={viewportRef}
        onScroll={updateCenterYear}
        className="ink-scroll-x relative overflow-x-auto overflow-y-hidden"
        style={{ touchAction: 'pan-x pan-y', height: COLUMN_HEIGHT + 96 }}
      >
        <div className="relative" style={{ width: totalSize - GAP + padLeft * 2 }}>
          {/* 卷尺刻度带：浮动悬浮条（sticky + 毛玻璃 + 投影），随缩放连续形变；与列同区段居中 */}
          <div
            className="sticky top-0 z-10 -mx-2 rounded-full border border-line/70 bg-surface/85 px-2 py-2 [box-shadow:var(--shadow-float)] backdrop-blur"
            style={{ marginLeft: padLeft - 8, marginRight: padLeft - 8 }}
          >
            <ZoomRuler columns={view.columns} level={level} pxPerDay={pxPerDay} gap={GAP} />
          </div>

          {/* 虚拟滚动列（padLeft 平移，短轴时以年份中线对称铺开） */}
          <div className="relative mt-5" style={{ height: COLUMN_HEIGHT }}>
            {visible.map((vi) => {
              const item = items[vi.index];
              return (
                <div
                  key={item.key}
                  className="absolute top-0 h-full pr-4"
                  style={{ left: vi.start + padLeft, width: vi.size }}
                >
                  {item.column && <TimelineColumn column={item.column} level={level} now={now} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 左下：可视缩放控件（＋/−，锚定视口中心换档）；右下：档位指示（两者同款浮动胶囊） */}
      <div className="pointer-events-none sticky bottom-20 z-10 mt-4 flex items-end justify-between">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface/85 px-2 py-1 [box-shadow:var(--shadow-float)] backdrop-blur">
          <button
            type="button"
            aria-label="放大"
            onClick={() => zoomBy(-1)}
            className="rounded-full p-1.5 text-sub transition-colors hover:text-ink"
          >
            <Plus size={14} />
          </button>
          <div className="h-4 w-px bg-line" />
          <button
            type="button"
            aria-label="缩小"
            onClick={() => zoomBy(1)}
            className="rounded-full p-1.5 text-sub transition-colors hover:text-ink"
          >
            <Minus size={14} />
          </button>
        </div>
        <p className="rounded-full bg-surface/85 px-4 py-1.5 font-mono text-caption text-sub [box-shadow:var(--shadow-float)] backdrop-blur">
          {level.toUpperCase()} · {dayjs(rangeFrom).format(rangeFmt)} —{' '}
          {dayjs(rangeTo).format(rangeFmt)}
        </p>
      </div>
    </div>
  );
}
