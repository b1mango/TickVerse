import Dexie, { type Table } from 'dexie';
import type { Summary } from '@/types/summary';
import type { Task } from '@/types/task';

/** Dexie 实例：存储唯一入口（§5.3），任何组件/服务不得绕过 db/ 直接读写 */
export class TickVerseDB extends Dexie {
  tasks!: Table<Task, string>;
  summaries!: Table<Summary, string>;

  constructor() {
    super('tickverse');
    this.version(1).stores({
      // 索引：horizon（历史遗留查询维度，三档清单已下线）、completedAt（时间轴落位）、updatedAt（同步合并）
      tasks: 'id, horizon, completedAt, updatedAt',
    });
    this.version(2).stores({
      // M4：AI 总结缓存（§10.1 Summary 表，id = 2026-W35 / 2026-08 / 2026）
      summaries: 'id',
    });
  }
}

export const db = new TickVerseDB();
