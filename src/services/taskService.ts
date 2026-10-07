import { taskRepo } from '@/db/taskRepo';
import type { Quadrant, Task } from '@/types/task';
import { QUADRANT_HORIZON } from '@/types/task';

/** 一次象限拖拽落点：从 from 象限移到 to 象限的 toIndex 位置 */
export interface QuadrantMoveDescriptor {
  id: string;
  from: Quadrant;
  to: Quadrant;
  toIndex: number;
}

/**
 * 纯函数：计算象限拖拽后的持久化写入计划（可单测）。
 * 受影响象限的 order 统一重写为顺序序号，保证排序稳定无空洞；
 * horizon 随 quadrant 重映射（QUADRANT_HORIZON），时间轴投影与统计归因跟随新象限。
 */
export function planQuadrantMove(
  lists: Record<Quadrant, Task[]>,
  move: QuadrantMoveDescriptor,
): Array<{ id: string; quadrant: Quadrant; horizon: Task['horizon']; order: number }> {
  const task = lists[move.from].find((t) => t.id === move.id);
  if (!task) return [];
  const fromRest = lists[move.from].filter((t) => t.id !== move.id);
  const toBase = move.from === move.to ? fromRest : lists[move.to];
  const toIndex = Math.max(0, Math.min(move.toIndex, toBase.length));
  const toNext = [...toBase];
  toNext.splice(toIndex, 0, task);

  const affected: Array<[Quadrant, Task[]]> =
    move.from === move.to
      ? [[move.to, toNext]]
      : [
          [move.from, fromRest],
          [move.to, toNext],
        ];
  return affected.flatMap(([quadrant, list]) =>
    list.map((t, order) => ({ id: t.id, quadrant, horizon: QUADRANT_HORIZON[quadrant], order })),
  );
}

/**
 * taskService：任务领域操作（写路径）。
 * 单向数据流：UI 事件 → service → repo → useLiveQuery 驱动 UI（§15-4）。
 */
export const taskService = {
  /** 追加任务到象限末尾（order = 现有最大值 + 1，horizon 由象限映射） */
  async addQuadrantTask(title: string, quadrant: Quadrant, siblings: Task[]): Promise<Task> {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('标题不能为空');
    const maxOrder = Math.max(0, ...siblings.map((t) => t.order));
    return taskRepo.create({
      title: trimmed,
      horizon: QUADRANT_HORIZON[quadrant],
      order: maxOrder + 1,
      quadrant,
    });
  },

  async completeTask(id: string): Promise<void> {
    await taskRepo.complete(id);
  },

  /** 取消归档（2026-10-06 修订九）：抹掉 completedAt，条目回到待办/四象限 */
  async unarchiveTask(id: string): Promise<void> {
    await taskRepo.uncomplete(id);
  },

  /** 真删 + 返回快照供撤销（§15-6：真删 + toast 撤销 5s，不做回收站） */
  async deleteTask(id: string): Promise<Task | undefined> {
    const snapshot = await taskRepo.getById(id);
    if (snapshot) await taskRepo.remove(id);
    return snapshot;
  },

  async undoDelete(snapshot: Task): Promise<void> {
    await taskRepo.restore(snapshot);
  },

  async renameTask(id: string, title: string): Promise<void> {
    const trimmed = title.trim();
    if (trimmed) await taskRepo.updateTitle(id, trimmed);
  },

  /** 象限拖拽落点持久化：planQuadrantMove 出写入计划后事务落库 */
  async moveQuadrantTask(
    lists: Record<Quadrant, Task[]>,
    move: QuadrantMoveDescriptor,
  ): Promise<void> {
    await taskRepo.reorder(planQuadrantMove(lists, move));
  },
};
