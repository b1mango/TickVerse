import { getSnapshot, putSnapshot } from '@/adapters/webdav';
import { db } from '@/db/dexie';
import { buildBackup, type BackupFile } from '@/services/backupService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import type { Summary } from '@/types/summary';
import type { Task } from '@/types/task';

/**
 * syncService：WebDAV 单 JSON 快照同步（§10.2 / 清单 M5-4）。
 * 打开时拉取一次（按 updatedAt 逐条取新合并），本地每次变更后防抖 5s 推送整份快照。
 * 已知取舍：快照合并是并集，删除操作不会传播到远端（单设备场景无影响；
 * 多设备同删需配合导出/还原）。冲突策略为 last-write-wins。
 */

const PUSH_DEBOUNCE_MS = 5000;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

/** 纯函数：本地与远端按 id 对齐，逐条取 updatedAt 更新者（summaries 取 createdAt 新者） */
export function mergeSnapshot(
  local: { tasks: Task[]; summaries: Summary[] },
  remote: { tasks: Task[]; summaries: Summary[] },
): { tasks: Task[]; summaries: Summary[] } {
  const taskMap = new Map<string, Task>();
  for (const t of local.tasks) taskMap.set(t.id, t);
  for (const t of remote.tasks) {
    const cur = taskMap.get(t.id);
    if (!cur || t.updatedAt > cur.updatedAt) taskMap.set(t.id, t);
  }
  const summaryMap = new Map<string, Summary>();
  for (const s of local.summaries) summaryMap.set(s.id, s);
  for (const s of remote.summaries) {
    const cur = summaryMap.get(s.id);
    if (!cur || s.createdAt > cur.createdAt) summaryMap.set(s.id, s);
  }
  return { tasks: [...taskMap.values()], summaries: [...summaryMap.values()] };
}

function getConfig() {
  const cfg = useSettingsStore.getState().webdav;
  return cfg.enabled && cfg.endpoint && cfg.username ? cfg : null;
}

/** 推送整份快照到远端 */
export async function pushNow(): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  const sync = useSyncStore.getState();
  if (sync.syncing) return;
  sync.setSyncing(true);
  try {
    const backup = await buildBackup();
    await putSnapshot(cfg, JSON.stringify(backup));
    sync.setResult(Date.now(), null);
  } catch (e) {
    sync.setResult(null, e instanceof Error ? e.message : String(e));
  } finally {
    sync.setSyncing(false);
  }
}

/** 本地变更后调用：防抖推送 */
export function schedulePush(): void {
  if (!getConfig()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, PUSH_DEBOUNCE_MS);
}

/** 拉取远端快照并合并落库；远端没有快照则直接上传本地 */
export async function pullNow(): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  const sync = useSyncStore.getState();
  if (sync.syncing) return;
  sync.setSyncing(true);
  try {
    const text = await getSnapshot(cfg);
    if (text === null) {
      await putSnapshot(cfg, JSON.stringify(await buildBackup()));
    } else {
      const remote = JSON.parse(text) as BackupFile;
      const merged = mergeSnapshot(
        { tasks: await db.tasks.toArray(), summaries: await db.summaries.toArray() },
        { tasks: remote.tasks ?? [], summaries: remote.summaries ?? [] },
      );
      await db.transaction('rw', db.tasks, db.summaries, async () => {
        await db.tasks.bulkPut(merged.tasks);
        await db.summaries.bulkPut(merged.summaries);
      });
    }
    sync.setResult(Date.now(), null);
  } catch (e) {
    sync.setResult(null, e instanceof Error ? e.message : String(e));
  } finally {
    sync.setSyncing(false);
  }
}

/** App 启动调用一次：拉取 + 订阅本地表变更（Dexie hooks，db 层零改动） */
export function initSync(): void {
  if (initialized) return;
  if (!getConfig()) return; // 未启用不占位：设置页启用后再次调用即可生效
  initialized = true;
  void pullNow();
  const onChange = () => schedulePush();
  db.tasks.hook('creating', onChange);
  db.tasks.hook('updating', onChange);
  db.tasks.hook('deleting', onChange);
  db.summaries.hook('creating', onChange);
  db.summaries.hook('updating', onChange);
}
