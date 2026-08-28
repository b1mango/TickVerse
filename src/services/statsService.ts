import dayjs from 'dayjs';
import { weekStartOf } from '@/services/timelineService';
import type { Horizon, Task } from '@/types/task';
import { startOfDay } from '@/utils/date';

/**
 * statsService：统计指标计算（纯函数，可单测；清单 M4-A）。
 * 一切可视化只用 ink 灰阶 + 唯一朱砂（方向稿 §9 纪律），本层只产出数据。
 */

export type StatsPeriod = 'week' | 'month' | 'year';

export interface TrendPoint {
  label: string;
  count: number;
  /** 今天所在桶（图表朱砂点缀用） */
  isToday: boolean;
}

export interface StatsData {
  period: StatsPeriod;
  rangeStart: number;
  rangeEnd: number;
  /** 周期内完成清单（按模块分组） */
  byHorizon: Record<Horizon, Task[]>;
  total: number;
  /** 完成趋势：week/month 按日分桶，year 按月分桶 */
  trend: TrendPoint[];
  /** 连续打卡天数（今天未完成则算到昨天） */
  streak: number;
  /** 周期内日均完成（分母 = 周期内已过天数） */
  dailyAvg: number;
  /** 有记录以来最长空窗（连续无完成天数） */
  longestGap: number;
}

function completedTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.completedAt !== undefined);
}

/** 连续打卡天数：今天有完成则从今天往回数，否则从昨天往回数 */
export function computeStreak(tasks: Task[], now: number): number {
  const days = new Set(completedTasks(tasks).map((t) => startOfDay(t.completedAt!)));
  let cursor = startOfDay(now);
  if (!days.has(cursor)) cursor = dayjs(cursor).subtract(1, 'day').valueOf();
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = dayjs(cursor).subtract(1, 'day').valueOf();
  }
  return streak;
}

/** 最长空窗：第一条完成记录之后，连续无完成的最大天数 */
export function computeLongestGap(tasks: Task[], now: number): number {
  const done = completedTasks(tasks);
  if (done.length === 0) return 0;
  const days = new Set(done.map((t) => startOfDay(t.completedAt!)));
  const first = Math.min(...days);
  let longest = 0;
  let current = 0;
  for (let d = first; d < startOfDay(now); d = dayjs(d).add(1, 'day').valueOf()) {
    if (days.has(d)) {
      current = 0;
    } else {
      current++;
      longest = Math.max(longest, current);
    }
  }
  return longest;
}

export function computeStats(tasks: Task[], period: StatsPeriod, now: number): StatsData {
  const rangeStart =
    period === 'week'
      ? weekStartOf(now)
      : period === 'month'
        ? dayjs(now).startOf('month').valueOf()
        : dayjs(now).startOf('year').valueOf();

  const inRange = completedTasks(tasks).filter((t) => t.completedAt! >= rangeStart && t.completedAt! <= now);

  const byHorizon: Record<Horizon, Task[]> = { today: [], short: [], long: [] };
  for (const t of inRange) byHorizon[t.horizon].push(t);
  for (const list of Object.values(byHorizon)) {
    list.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  }

  const todayStart = startOfDay(now);
  const trend: TrendPoint[] = [];
  if (period === 'year') {
    for (let m = 0; m <= dayjs(now).month(); m++) {
      const mStart = dayjs(now).startOf('year').add(m, 'month').valueOf();
      const mEnd = dayjs(mStart).add(1, 'month').valueOf();
      trend.push({
        label: `${m + 1}月`,
        count: inRange.filter((t) => t.completedAt! >= mStart && t.completedAt! < mEnd).length,
        isToday: m === dayjs(now).month(),
      });
    }
  } else {
    const daysInPeriod =
      period === 'week' ? 7 : dayjs(now).daysInMonth();
    for (let i = 0; i < daysInPeriod; i++) {
      const dStart = dayjs(rangeStart).add(i, 'day').valueOf();
      if (dStart > todayStart) break; // 未来不画
      const dEnd = dayjs(dStart).add(1, 'day').valueOf();
      trend.push({
        label: dayjs(dStart).format('DD'),
        count: inRange.filter((t) => t.completedAt! >= dStart && t.completedAt! < dEnd).length,
        isToday: dStart === todayStart,
      });
    }
  }

  const elapsedDays = Math.max(1, Math.round((todayStart - rangeStart) / 86400000) + 1);
  return {
    period,
    rangeStart,
    rangeEnd: now,
    byHorizon,
    total: inRange.length,
    trend,
    streak: computeStreak(tasks, now),
    dailyAvg: inRange.length / elapsedDays,
    longestGap: computeLongestGap(tasks, now),
  };
}

/** 年度热力日历数据：周 × 7 网格，count → ink 透明度 5 档（方向稿 §9） */
export interface HeatCell {
  date: number;
  count: number;
}

export function yearHeatmap(tasks: Task[], year: number): HeatCell[] {
  const counts = new Map<number, number>();
  for (const t of completedTasks(tasks)) {
    const d = startOfDay(t.completedAt!);
    if (dayjs(d).year() === year) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const start = dayjs(`${year}-01-01`).startOf('day').valueOf();
  const end = dayjs(`${year}-12-31`).endOf('day').valueOf();
  const cells: HeatCell[] = [];
  for (let d = start; d < end; d = dayjs(d).add(1, 'day').valueOf()) {
    cells.push({ date: d, count: counts.get(d) ?? 0 });
  }
  return cells;
}

/** 热力档位：0 空 / 1–4 档（count 1 / 2 / 3 / ≥4） */
export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count >= 4) return 4;
  return count as 1 | 2 | 3;
}
