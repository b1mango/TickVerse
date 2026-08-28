import { taskRepo } from '@/db/taskRepo';
import type { Horizon, Task } from '@/types/task';

/** 一次拖拽落点：从 from 模块移到 to 模块的 toIndex 位置 */
export interface MoveDescriptor {
  id: string;
  from: Horizon;
  to: Horizon;
  toIndex: number;
}

/**
 * 纯函数：计算拖拽后的持久化写入计划（可单测）。
 * 受影响模块的 order 统一重写为顺序序号，保证排序稳定无空洞。
 */
export function planMove(
  lists: Record<Horizon, Task[]>,
  move: MoveDescriptor,
): Array<{ id: string; horizon: Horizon; order: number }> {
  const task = lists[move.from].find((t) => t.id === move.id);
  if (!task) return [];
  const fromRest = lists[move.from].filter((t) => t.id !== move.id);
  const toBase = move.from === move.to ? fromRest : lists[move.to];
  const toIndex = Math.max(0, Math.min(move.toIndex, toBase.length));
  const toNext = [...toBase];
  toNext.splice(toIndex, 0, task);

  const affected: Array<[Horizon, Task[]]> =
    move.from === move.to
      ? [[move.to, toNext]]
      : [
          [move.from, fromRest],
          [move.to, toNext],
        ];
  return affected.flatMap(([horizon, list]) =>
    list.map((t, order) => ({ id: t.id, horizon, order })),
  );
}

/**
 * taskService：任务领域操作（写路径）。
 * 单向数据流：UI 事件 → service → repo → useLiveQuery 驱动 UI（§15-4）。
 */
export const taskService = {
  /** 追加任务到模块末尾（order = 现有最大值 + 1） */
  async addTask(title: string, horizon: Horizon, siblings: Task[]): Promise<Task> {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('标题不能为空');
    const maxOrder = Math.max(0, ...siblings.map((t) => t.order));
    return taskRepo.create({ title: trimmed, horizon, order: maxOrder + 1 });
  },

  async completeTask(id: string): Promise<void> {
    await taskRepo.complete(id);
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

  /** 拖拽落点持久化：planMove 出写入计划后事务落库 */
  async moveTask(lists: Record<Horizon, Task[]>, move: MoveDescriptor): Promise<void> {
    await taskRepo.reorder(planMove(lists, move));
  },
};
