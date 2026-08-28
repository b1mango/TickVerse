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

  /** 批量写入（演示数据填充用） */
  async bulkAdd(tasks: Task[]): Promise<void> {
    await db.tasks.bulkAdd(tasks);
  },

  /** 按标签批量删除（演示数据清除用），返回删除条数 */
  async removeByTag(tag: string): Promise<number> {
    const ids = await db.tasks.filter((t) => t.tags?.includes(tag) ?? false).primaryKeys();
    await db.tasks.bulkDelete(ids);
    return ids.length;
  },

  async getById(id: string): Promise<Task | undefined> {
    return db.tasks.get(id);
  },

  /** 拖拽落点持久化：事务内批量写 order（跨模块时连同 horizon 一起写） */
  async reorder(updates: Array<{ id: string; order: number; horizon?: Horizon }>): Promise<void> {
    if (updates.length === 0) return;
    const now = Date.now();
    await db.transaction('rw', db.tasks, async () => {
      await Promise.all(
        updates.map((u) =>
          db.tasks.update(u.id, {
            order: u.order,
            ...(u.horizon !== undefined ? { horizon: u.horizon } : {}),
            updatedAt: now,
          }),
        ),
      );
    });
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
