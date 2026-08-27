import { db } from '@/db/dexie';
import type { Horizon, Task } from '@/types/task';
import { uuid } from '@/utils/id';

/**
 * taskRepo：tasks 表读写唯一入口（§5.3）。
 * 只含存储副作用，不含业务决策（业务在 services/）。
 */
export const taskRepo = {
  async create(input: { title: string; horizon: Horizon; order: number }): Promise<Task> {
    const now = Date.now();
    const task: Task = {
      id: uuid(),
      title: input.title,
      horizon: input.horizon,
      createdAt: now,
      updatedAt: now,
      order: input.order,
    };
    await db.tasks.add(task);
    return task;
  },

  /** 恢复一个曾被删除的任务（toast 撤销用，原样写回） */
  async restore(task: Task): Promise<void> {
    await db.tasks.put(task);
  },

  async updateTitle(id: string, title: string): Promise<void> {
    await db.tasks.update(id, { title, updatedAt: Date.now() });
  },

  /** 完成不删除（§10.1 核心设计），只打 completedAt */
  async complete(id: string): Promise<void> {
    const now = Date.now();
    await db.tasks.update(id, { completedAt: now, updatedAt: now });
  },

  async remove(id: string): Promise<void> {
    await db.tasks.delete(id);
  },

  async getById(id: string): Promise<Task | undefined> {
    return db.tasks.get(id);
  },

  /** 跨天滚存：今日且未完成 → 滚入短期并置顶（order 取 short 最小值之前） */
  async rolloverTodayToShort(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await db.transaction('rw', db.tasks, async () => {
      const shortTasks = await db.tasks.where('horizon').equals('short').toArray();
      const minOrder = Math.min(0, ...shortTasks.map((t) => t.order));
      const now = Date.now();
      await Promise.all(
        ids.map((id, i) =>
          db.tasks.update(id, {
            horizon: 'short',
            order: minOrder - ids.length + i,
            updatedAt: now,
          }),
        ),
      );
    });
  },
};
