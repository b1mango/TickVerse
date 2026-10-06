import { describe, expect, it } from 'vitest';
import { generateSeedTasks, SEED_BLUEPRINT, SEED_TAG } from '@/services/seedService';
import type { Quadrant } from '@/types/task';
import { QUADRANT_HORIZON, QUADRANT_IDS } from '@/types/task';

const NOW = new Date(2026, 9, 5, 12, 0, 0).getTime(); // 2026-10-05 12:00

describe('generateSeedTasks', () => {
  const tasks = generateSeedTasks(NOW);

  it('蓝图条目全部生成、无遗漏（四象限合计 41 条）', () => {
    const blueprintTotal = QUADRANT_IDS.reduce((n, q) => n + SEED_BLUEPRINT[q].length, 0);
    expect(blueprintTotal).toBe(41);
    expect(tasks.length).toBe(blueprintTotal);
  });

  it('每条任务落入蓝图声明的象限，且 horizon 走象限映射', () => {
    const byQuadrant = (q: Quadrant) => tasks.filter((t) => t.quadrant === q);
    for (const q of QUADRANT_IDS) {
      expect(byQuadrant(q).map((t) => t.title)).toEqual(SEED_BLUEPRINT[q]);
      for (const t of byQuadrant(q)) {
        expect(t.horizon).toBe(QUADRANT_HORIZON[q]);
      }
    }
  });

  it('全部打 seed 标签、未完成、时间戳与 id 合法', () => {
    const ids = new Set(tasks.map((t) => t.id));
    expect(ids.size).toBe(tasks.length); // id 唯一（bulkAdd 主键不冲突）
    for (const t of tasks) {
      expect(t.tags).toContain(SEED_TAG);
      expect(t.completedAt).toBeUndefined();
      expect(t.createdAt).toBe(NOW);
      expect(t.updatedAt).toBe(NOW);
    }
  });

  it('每个象限内 order 为从 0 起的连续序号', () => {
    for (const q of QUADRANT_IDS) {
      const orders = tasks
        .filter((t) => t.quadrant === q)
        .map((t) => t.order)
        .sort((a, b) => a - b);
      expect(orders).toEqual(SEED_BLUEPRINT[q].map((_, i) => i));
    }
  });

  it('确定性：同一 now 两次生成完全一致', () => {
    expect(generateSeedTasks(NOW)).toEqual(tasks);
  });
});
