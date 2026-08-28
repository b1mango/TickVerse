import { db } from '@/db/dexie';
import type { Summary } from '@/types/summary';
import type { Task } from '@/types/task';

/**
 * backupService：手动导出/导入 JSON 备份（三重兜底之一，§10.2 / 清单 M5-2）。
 * 导出文件不含任何密钥（LLM Key 在 localStorage，WebDAV 凭据亦然）。
 */

export interface BackupFile {
  app: 'tickverse';
  version: number;
  exportedAt: number;
  tasks: Task[];
  summaries: Summary[];
}

export const BACKUP_VERSION = 1;

/** 汇总全库数据为备份对象（纯读取，经 db 唯一入口） */
export async function buildBackup(): Promise<BackupFile> {
  const [tasks, summaries] = await Promise.all([db.tasks.toArray(), db.summaries.toArray()]);
  return { app: 'tickverse', version: BACKUP_VERSION, exportedAt: Date.now(), tasks, summaries };
}

/** 触发浏览器下载 */
export async function exportBackup(): Promise<number> {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tickverse-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return backup.tasks.length;
}

/** 解析并校验备份文件（纯函数，可单测） */
export function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text) as Partial<BackupFile>;
  if (data.app !== 'tickverse' || !Array.isArray(data.tasks)) {
    throw new Error('不是有效的拾刻备份文件');
  }
  return {
    app: 'tickverse',
    version: data.version ?? 1,
    exportedAt: data.exportedAt ?? 0,
    tasks: data.tasks,
    summaries: Array.isArray(data.summaries) ? data.summaries : [],
  };
}

/** 完整还原：清空后写回（调用方负责二次确认） */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.tasks, db.summaries, async () => {
    await db.tasks.clear();
    await db.summaries.clear();
    await db.tasks.bulkPut(backup.tasks);
    await db.summaries.bulkPut(backup.summaries);
  });
}
