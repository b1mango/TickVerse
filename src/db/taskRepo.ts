import { db } from '@/db/dexie';
import type { Horizon, Quadrant, Task } from '@/types/task';
import { uuid } from '@/utils/id';

/**
 * taskRepo：tasks 表读写唯一入口（§5.3）。
 * 只含存储副作用，不含业务决策（业务在 services/）。
 */
export const taskRepo = {
  async create(input: {
    title: string;
    horizon: Horizon;
    order: number;
    quadrant?: Quadrant;
  }): Promise<Task> {
    const now = Date.now();
    const task: Task = {
      id: uuid(),
      title: input.title,
      horizon: input.horizon,
      ...(input.quadrant !== undefined ? { quadrant: input.quadrant } : {}),
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

  /** 取消归档：抹掉 completedAt（2026-10-06 修订九），条目回到待办 */
  async uncomplete(id: string): Promise<void> {
    await db.tasks
      .where('id')
      .equals(id)
      .modify((t) => {
        delete t.completedAt;
        t.updatedAt = Date.now();
      });
  },

  async remove(id: string): Promise<void> {
    await db.tasks.delete(id);
  },

  async getById(id: string): Promise<Task | undefined> {
    return db.tasks.get(id);
  },

  /** 拖拽落点持久化：事务内批量写 order（跨象限时连同 quadrant / horizon 映射一起写） */
  async reorder(
    updates: Array<{ id: string; order: number; quadrant?: Quadrant; horizon?: Horizon }>,
  ): Promise<void> {
    if (updates.length === 0) return;
    const now = Date.now();
    await db.transaction('rw', db.tasks, async () => {
      await Promise.all(
        updates.map((u) =>
          db.tasks.update(u.id, {
            order: u.order,
            ...(u.quadrant !== undefined ? { quadrant: u.quadrant } : {}),
            ...(u.horizon !== undefined ? { horizon: u.horizon } : {}),
            updatedAt: now,
          }),
        ),
      );
    });
  },
};
