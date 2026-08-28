import { db } from '@/db/dexie';
import type { Summary } from '@/types/summary';

/** summaryRepo：summaries 表读写唯一入口（§5.3） */
export const summaryRepo = {
  async getById(id: string): Promise<Summary | undefined> {
    return db.summaries.get(id);
  },

  /** 生成缓存落库 / 手动编辑覆盖 */
  async put(summary: Summary): Promise<void> {
    await db.summaries.put(summary);
  },
};
