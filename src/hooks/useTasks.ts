import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import type { Task } from '@/types/task';

/**
 * useLiveQuery 驱动 UI（§15-4）：service 只管写，读侧由 Dexie 实时查询驱动。
 * 组件不直接 import db，统一走本 hook（§5.3 单向数据流）。
 */

/** 四象限模块：象限内未完成任务，按 order 排序（组件再按 quadrant 分栏） */
export function useQuadrantTasks(): Task[] {
  return (
    useLiveQuery(
      () =>
        db.tasks
          .filter((t) => t.quadrant !== undefined && t.completedAt === undefined)
          .sortBy('order'),
      [],
    ) ?? []
  );
}

/** 时间轴页（M3）：全量任务实时查询，视图计算走 timelineService 纯函数 */
export function useAllTasks(): Task[] | undefined {
  return useLiveQuery(() => db.tasks.toArray(), []);
}
