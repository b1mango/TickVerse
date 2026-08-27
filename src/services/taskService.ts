import { taskRepo } from '@/db/taskRepo';
import type { Horizon, Task } from '@/types/task';

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
};
