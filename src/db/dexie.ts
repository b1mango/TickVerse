import Dexie, { type Table } from 'dexie';
import type { Task } from '@/types/task';

/** Dexie 实例：存储唯一入口（§5.3），任何组件/服务不得绕过 db/ 直接读写 */
export class TickVerseDB extends Dexie {
  tasks!: Table<Task, string>;

  constructor() {
    super('tickverse');
    this.version(1).stores({
      // 索引：horizon（编辑页分模块）、completedAt（时间轴落位）、updatedAt（同步合并）
      tasks: 'id, horizon, completedAt, updatedAt',
    });
  }
}

export const db = new TickVerseDB();
