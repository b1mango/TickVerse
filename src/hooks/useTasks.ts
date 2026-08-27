import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import type { Horizon, Task } from '@/types/task';

/**
 * useLiveQuery 驱动 UI（§15-4）：service 只管写，读侧由 Dexie 实时查询驱动。
 * 组件不直接 import db，统一走本 hook（§5.3 单向数据流）。
 */

/** 未完成任务，按模块过滤、按 order 排序（编辑页用） */
export function useActiveTasks(horizon: Horizon): Task[] {
  return (
    useLiveQuery(
      () =>
        db.tasks
          .where('horizon')
          .equals(horizon)
          .filter((t) => t.completedAt === undefined)
          .sortBy('order'),
      [horizon],
    ) ?? []
  );
}

/** 各模块未完成计数（头版 mono 计数用） */
export function useActiveCounts(): Record<Horizon, number> {
  const counts = useLiveQuery(async () => {
    const active = await db.tasks.filter((t) => t.completedAt === undefined).toArray();
    return {
      today: active.filter((t) => t.horizon === 'today').length,
      short: active.filter((t) => t.horizon === 'short').length,
      long: active.filter((t) => t.horizon === 'long').length,
    };
  });
  return counts ?? { today: 0, short: 0, long: 0 };
}
