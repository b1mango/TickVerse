import { describe, expect, it } from 'vitest';
import { selectRolloverTasks, shouldRollover } from '@/services/rolloverService';
import type { Task } from '@/types/task';

function makeTask(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? 't1',
    title: '测试任务',
    horizon: 'today',
    createdAt: 0,
    updatedAt: 0,
    order: 0,
    ...partial,
  };
}

describe('selectRolloverTasks', () => {
  it('只滚 today 且未完成的任务', () => {
    const tasks = [
      makeTask({ id: 'a', horizon: 'today' }),
      makeTask({ id: 'b', horizon: 'short' }),
      makeTask({ id: 'c', horizon: 'long' }),
      makeTask({ id: 'd', horizon: 'today', completedAt: Date.now() }),
    ];
    expect(selectRolloverTasks(tasks).map((t) => t.id)).toEqual(['a']);
  });

  it('空列表返回空', () => {
    expect(selectRolloverTasks([])).toEqual([]);
  });
});

describe('shouldRollover（跨天/跨月/跨年边界）', () => {
  // 2026-08-27 12:00 本地
  const noon = new Date(2026, 7, 27, 12, 0, 0).getTime();

  it('首次启动（无记录）需要滚存', () => {
    expect(shouldRollover(null, noon)).toBe(true);
  });

  it('同日重复启动不重复滚', () => {
    const sameDayMorning = new Date(2026, 7, 27, 1, 0, 0).getTime();
    expect(shouldRollover(sameDayMorning, noon)).toBe(false);
  });

  it('跨天（前一晚 23:59 → 次日 00:01）需要滚存', () => {
    const lastNight = new Date(2026, 7, 26, 23, 59, 0).getTime();
    const nextDay = new Date(2026, 7, 27, 0, 1, 0).getTime();
    expect(shouldRollover(lastNight, nextDay)).toBe(true);
  });

  it('跨月（8/31 → 9/1）需要滚存', () => {
    const aug31 = new Date(2026, 7, 31, 23, 0, 0).getTime();
    const sep1 = new Date(2026, 8, 1, 8, 0, 0).getTime();
    expect(shouldRollover(aug31, sep1)).toBe(true);
  });

  it('跨年（12/31 → 1/1）需要滚存', () => {
    const dec31 = new Date(2026, 11, 31, 23, 0, 0).getTime();
    const jan1 = new Date(2027, 0, 1, 0, 30, 0).getTime();
    expect(shouldRollover(dec31, jan1)).toBe(true);
  });

  it('已完成任务不滚', () => {
    const done = makeTask({ horizon: 'today', completedAt: Date.now() });
    expect(selectRolloverTasks([done])).toEqual([]);
  });
});
