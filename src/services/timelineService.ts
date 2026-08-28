import dayjs from 'dayjs';
import type { Task } from '@/types/task';
import { startOfDay } from '@/utils/date';

/**
 * timelineService：时间轴视图数据计算（纯函数，可单测）。
 * 规则来源：《项目设计.md》§11 页面 2、§2 需求落地细则、§15-7；M3 缩放体系。
 */

/** 未完成且 dueDate 已过当天 → 逾期（短期红点，§2 落地细则） */
export function isOverdue(task: Task, now: number): boolean {
  return (
    task.completedAt === undefined &&
    task.dueDate !== undefined &&
    startOfDay(Date.parse(task.dueDate)) < startOfDay(now)
  );
}

/** 本周周一 00:00 */
export function weekStartOf(now: number): number {
  const d = dayjs(now).startOf('day');
  return d.subtract((d.day() + 6) % 7, 'day').valueOf();
}

/* ------------------------------ M3 · 六档缩放 ------------------------------ */

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'years';

export interface ZoomStop {
  level: ZoomLevel;
  /** 像素/天：像素位置 = (日期 − 起始日) × 像素/天（§11 页面 2 实现约定） */
  pxPerDay: number;
}

/** 六档锚点（清单 M3-1；2026-08-28 用户钦定：月档保留但加宽到 72px 可读，week 档 120px、季档 16px），按 pxPerDay 从大到小；默认档位 week */
export const ZOOM_STOPS: readonly ZoomStop[] = [
  { level: 'day', pxPerDay: 240 },
  { level: 'week', pxPerDay: 120 },
  { level: 'month', pxPerDay: 72 },
  { level: 'quarter', pxPerDay: 16 },
  { level: 'year', pxPerDay: 4 },
  { level: 'years', pxPerDay: 0.8 },
];

export const DEFAULT_ZOOM_PX = 120; // week 档

/** 档位 = 阈值区间（相邻锚点的几何中点为界）+ 渲染模板 */
export function levelForPxPerDay(pxPerDay: number): ZoomLevel {
  for (let i = 0; i < ZOOM_STOPS.length - 1; i++) {
    const hi = ZOOM_STOPS[i].pxPerDay;
    const lo = ZOOM_STOPS[i + 1].pxPerDay;
    if (pxPerDay >= Math.sqrt(hi * lo)) return ZOOM_STOPS[i].level;
  }
  return ZOOM_STOPS[ZOOM_STOPS.length - 1].level;
}

/** 磁吸归位：连续缩放值吸附最近档位（对数空间比距离） */
export function snapPxPerDay(pxPerDay: number): ZoomStop {  const clamped = clampPxPerDay(pxPerDay);
  let best = ZOOM_STOPS[0];
  for (const stop of ZOOM_STOPS) {
    if (Math.abs(Math.log(clamped / stop.pxPerDay)) < Math.abs(Math.log(clamped / best.pxPerDay))) {
      best = stop;
    }
  }
  return best;
}

/** 边界锁定（清单 M3-2）：缩放范围钳制在 日档 — 年视图档 之间 */
export function clampPxPerDay(pxPerDay: number): number {
  return Math.min(ZOOM_STOPS[0].pxPerDay, Math.max(ZOOM_STOPS[ZOOM_STOPS.length - 1].pxPerDay, pxPerDay));
}

/* ------------------------------ M3 · 按档聚合 ------------------------------ */

export interface ZoomColumn {
  /** 列起始日 00:00 */
  start: number;
  /** 列覆盖天数（日/周/月档 = 1；季档 = 周；年档 = 月；年视图档 = 年） */
  days: number;
  /** 含今天 */
  isToday: boolean;
  /** 整列在未来侧 */
  isFuture: boolean;
  /** 已完成按 completedAt 落位（实色） */
  completed: Task[];
  /** 未完成投影（虚线态）：今天所在列 */
  projected: Task[];
}

export interface ZoomViewData {
  /** 时间轴起点 = 第一条记录 createdAt 当日（§15-7） */
  start: number;
  /** 终点 = 本周周日（未来侧余量，供未完成投影与长期锚定） */
  end: number;
  columns: ZoomColumn[];
  /** 长期未完成目标，锚定"未来"端 */
  longAnchors: Task[];
  empty: boolean;
}

function newColumn(start: number, days: number, now: number): ZoomColumn {
  const todayStart = startOfDay(now);
  const end = dayjs(start).add(days, 'day').valueOf();
  return {
    start,
    days,
    isToday: start <= todayStart && todayStart < end,
    isFuture: start > todayStart,
    completed: [],
    projected: [],
  };
}

/**
 * 按档位聚合查询（清单 M3-3）：
 * - 日/周/月档：每日一列；季档：每周（周一起）一列；年档：每月一列；年视图档：每年一列；
 * - 已完成落入 completedAt 对应列；未完成（今日/短期）投影到今天所在列；长期锚定未来端。
 */
export function buildZoomView(tasks: Task[], level: ZoomLevel, now: number): ZoomViewData {
  if (tasks.length === 0) {
    return { start: startOfDay(now), end: startOfDay(now), columns: [], longAnchors: [], empty: true };
  }
  const start = Math.min(...tasks.map((t) => startOfDay(t.createdAt)));
  const end = dayjs(weekStartOf(now)).add(7, 'day').valueOf();

  const columns: ZoomColumn[] = [];
  if (level === 'quarter') {
    let cursor = weekStartOf(start);
    while (cursor < end) {
      columns.push(newColumn(cursor, 7, now));
      cursor = dayjs(cursor).add(7, 'day').valueOf();
    }
  } else if (level === 'year') {
    let cursor = dayjs(start).startOf('month').valueOf();
    while (cursor < end) {
      columns.push(newColumn(cursor, dayjs(cursor).daysInMonth(), now));
      cursor = dayjs(cursor).add(1, 'month').valueOf();
    }
  } else if (level === 'years') {
    let cursor = dayjs(start).startOf('year').valueOf();
    while (cursor < end) {
      columns.push(newColumn(cursor, dayjs(cursor).endOf('year').diff(dayjs(cursor), 'day') + 1, now));
      cursor = dayjs(cursor).add(1, 'year').valueOf();
    }
  } else {
    let cursor = start;
    while (cursor < end) {
      columns.push(newColumn(cursor, 1, now));
      cursor = dayjs(cursor).add(1, 'day').valueOf();
    }
  }

  const columnOf = (ts: number): ZoomColumn | undefined =>
    columns.find((c) => c.start <= ts && ts < dayjs(c.start).add(c.days, 'day').valueOf());

  const longAnchors: Task[] = [];
  for (const task of tasks) {
    if (task.completedAt !== undefined) {
      columnOf(startOfDay(task.completedAt))?.completed.push(task);
    } else if (task.horizon === 'long') {
      longAnchors.push(task);
    } else {
      const col = columnOf(startOfDay(now));
      if (col) col.projected.push(task);
    }
  }

  for (const c of columns) c.completed.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  longAnchors.sort((a, b) => a.order - b.order);
  return { start, end, columns, longAnchors, empty: false };
}
