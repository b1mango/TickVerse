import { describe, expect, it } from 'vitest';
import {
  computeLongestGap,
  computeStats,
  computeStreak,
  heatLevel,
  yearHeatmap,
} from '@/services/statsService';
import type { Horizon, Task } from '@/types/task';

// 固定"现在"：2026-08-28（周五）12:00
const NOW = new Date(2026, 7, 28, 12, 0, 0).getTime();
const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();

let seq = 0;
function done(horizon: Horizon, completedAt: number): Task {
  return {
    id: `t${seq++}`,
    title: 'x',
    horizon,
    createdAt: completedAt - 3600000,
    completedAt,
    updatedAt: completedAt,
    order: 0,
  };
}
function active(horizon: Horizon): Task {
  return { id: `t${seq++}`, title: 'x', horizon, createdAt: NOW, updatedAt: NOW, order: 0 };
}

describe('computeStreak', () => {
  it('今天有完成 → 从今天往回数连续天数', () => {
    const tasks = [done('today', at(2026, 8, 28)), done('today', at(2026, 8, 27)), done('short', at(2026, 8, 25))];
    expect(computeStreak(tasks, NOW)).toBe(2);
  });
  it('今天没完成 → 从昨天往回数', () => {
    const tasks = [done('today', at(2026, 8, 27)), done('today', at(2026, 8, 26))];
    expect(computeStreak(tasks, NOW)).toBe(2);
  });
  it('昨天也没完成 → 0', () => {
    expect(computeStreak([done('today', at(2026, 8, 25))], NOW)).toBe(0);
  });
});

describe('computeLongestGap', () => {
  it('连续无完成的最大天数', () => {
    const tasks = [
      done('today', at(2026, 8, 1)),
      done('today', at(2026, 8, 10)), // 8/2—8/9 空 8 天
      done('today', at(2026, 8, 12)),
      done('today', at(2026, 8, 28)), // 8/13—8/27 空 15 天
    ];
    expect(computeLongestGap(tasks, NOW)).toBe(15);
  });
  it('无完成记录 → 0', () => {
    expect(computeLongestGap([active('today')], NOW)).toBe(0);
  });
});

describe('computeStats', () => {
  const tasks = [
    done('today', at(2026, 8, 24)), // 本周一
    done('short', at(2026, 8, 28, 9)), // 今天
    done('long', at(2026, 8, 28, 11)), // 今天
    done('today', at(2026, 8, 10)), // 本月更早（周视图不含）
    active('today'),
  ];

  it('week：本周完成 3 条，按模块分组，趋势按日分桶到今天', () => {
    const s = computeStats(tasks, 'week', NOW);
    expect(s.total).toBe(3);
    expect(s.byHorizon.today.length).toBe(1);
    expect(s.byHorizon.short.length).toBe(1);
    expect(s.byHorizon.long.length).toBe(1);
    expect(s.trend.length).toBe(5); // 周一→周五
    expect(s.trend[0].count).toBe(1);
    expect(s.trend[4].isToday).toBe(true);
    expect(s.trend[4].count).toBe(2);
    // 日均 = 3 / 5 天
    expect(s.dailyAvg).toBeCloseTo(0.6);
  });

  it('month：含本月更早记录，日均按已过天数', () => {
    const s = computeStats(tasks, 'month', NOW);
    expect(s.total).toBe(4);
    expect(s.trend.length).toBe(28);
    expect(s.dailyAvg).toBeCloseTo(4 / 28);
  });

  it('year：按月分桶，只到当前月', () => {
    const s = computeStats(tasks, 'year', NOW);
    expect(s.trend.length).toBe(8);
    expect(s.trend[7].isToday).toBe(true);
    expect(s.trend[7].count).toBe(4);
  });
});

describe('yearHeatmap + heatLevel', () => {
  it('输出全年 365 格并正确计数', () => {
    const tasks = [done('today', at(2026, 3, 5)), done('short', at(2026, 3, 5, 18)), done('today', at(2025, 3, 5))];
    const cells = yearHeatmap(tasks, 2026);
    expect(cells.length).toBe(365);
    expect(cells.find((c) => c.date === new Date(2026, 2, 5).getTime())?.count).toBe(2);
  });
  it('ink 透明度 5 档映射', () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(3)).toBe(3);
    expect(heatLevel(4)).toBe(4);
    expect(heatLevel(99)).toBe(4);
  });
});
