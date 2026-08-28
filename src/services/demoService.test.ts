import { describe, expect, it } from 'vitest';
import { DEMO_TAG, generateDemoTasks } from '@/services/demoService';
import { startOfDay } from '@/utils/date';

const START = new Date(2025, 7, 1).getTime(); // 2025-08-01
const NOW = new Date(2026, 7, 28, 12, 0, 0).getTime(); // 2026-08-28 12:00

describe('generateDemoTasks', () => {
  const tasks = generateDemoTasks(START, NOW + 1);

  it('确定性：同 seed 两次生成一致', () => {
    const again = generateDemoTasks(START, NOW + 1);
    expect(again.length).toBe(tasks.length);
    expect(again[100]).toEqual(tasks[100]);
  });

  it('数据量体现真实感（一年约数百条）', () => {
    expect(tasks.length).toBeGreaterThan(400);
    expect(tasks.length).toBeLessThan(900);
  });

  it('全部打 demo 标签且字段合法', () => {
    for (const t of tasks) {
      expect(t.tags).toContain(DEMO_TAG);
      expect(t.createdAt).toBeGreaterThanOrEqual(START);
      expect(t.createdAt).toBeLessThanOrEqual(NOW + 1);
      if (t.completedAt !== undefined) {
        expect(t.completedAt).toBeGreaterThanOrEqual(t.createdAt);
        expect(t.completedAt).toBeLessThanOrEqual(NOW + 1); // 完成时间不在未来
      }
    }
  });

  it('边界演示数据齐全：今日进行中 / 短期逾期 / 长期锚点', () => {
    const active = tasks.filter((t) => t.completedAt === undefined);
    expect(active.filter((t) => t.horizon === 'today').length).toBeGreaterThanOrEqual(3);
    expect(active.some((t) => t.horizon === 'short' && t.dueDate !== undefined)).toBe(true);
    expect(active.filter((t) => t.horizon === 'long').length).toBe(5);
  });

  it('存在空窗日（streak 统计有意义）', () => {
    const doneDays = new Set(
      tasks.filter((t) => t.completedAt !== undefined).map((t) => startOfDay(t.completedAt!)),
    );
    let gaps = 0;
    for (let d = START; d < startOfDay(NOW); d += 86400000) {
      if (!doneDays.has(d)) gaps++;
    }
    expect(gaps).toBeGreaterThan(10);
    expect(doneDays.size).toBeGreaterThan(200);
  });
});
