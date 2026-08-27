import { db } from '@/db/dexie';
import { taskRepo } from '@/db/taskRepo';
import type { Task } from '@/types/task';
import { isSameDay } from '@/utils/date';

const LAST_OPEN_KEY = 'tickverse.lastOpenAt';

/**
 * 选出需要滚存的任务：horizon='today' 且未完成（§2 需求落地细则）。
 * 纯函数，供单测覆盖跨天/跨月/跨年等边界。
 */
export function selectRolloverTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.horizon === 'today' && t.completedAt === undefined);
}

/**
 * 是否需要滚存：上次打开日期与当前不是同一天。
 * 同日重复启动返回 false，保证不重复滚（幂等）。
 */
export function shouldRollover(lastOpenAt: number | null, now: number): boolean {
  return lastOpenAt === null || !isSameDay(lastOpenAt, now);
}

/**
 * 应用启动时调用：检测跨天 → 今日未完成滚入短期（置顶由 repo 的 order 处理）。
 * 返回本次滚入的任务 id（"昨日遗留"标记为纯 UI 计算，不落库字段，§15-5）。
 */
export async function rolloverOnLaunch(now: number = Date.now()): Promise<string[]> {
  const lastOpenAt = Number(localStorage.getItem(LAST_OPEN_KEY)) || null;
  if (!shouldRollover(lastOpenAt, now)) return [];

  const candidates = await db.tasks.where('horizon').equals('today').toArray();
  const targets = selectRolloverTasks(candidates);
  await taskRepo.rolloverTodayToShort(targets.map((t) => t.id));

  localStorage.setItem(LAST_OPEN_KEY, String(now));
  return targets.map((t) => t.id);
}
