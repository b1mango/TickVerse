import { describe, expect, it } from 'vitest';
import { planMove } from '@/services/taskService';
import type { Horizon, Task } from '@/types/task';

let seq = 0;
function makeTask(horizon: Horizon, order: number, id?: string): Task {
  return {
    id: id ?? `t${seq++}`,
    title: 'x',
    horizon,
    createdAt: 0,
    updatedAt: 0,
    order,
  };
}

function listsOf(tasks: Task[]): Record<Horizon, Task[]> {
  return {
    today: tasks.filter((t) => t.horizon === 'today'),
    short: tasks.filter((t) => t.horizon === 'short'),
    long: tasks.filter((t) => t.horizon === 'long'),
  };
}

describe('planMove', () => {
  it('模块内下移：重写该模块 order 为顺序序号', () => {
    const [a, b, c] = [makeTask('today', 0, 'a'), makeTask('today', 1, 'b'), makeTask('today', 2, 'c')];
    const updates = planMove(listsOf([a, b, c]), { id: 'a', from: 'today', to: 'today', toIndex: 2 });
    expect(updates).toEqual([
      { id: 'b', horizon: 'today', order: 0 },
      { id: 'c', horizon: 'today', order: 1 },
      { id: 'a', horizon: 'today', order: 2 },
    ]);
  });

  it('模块内上移', () => {
    const [a, b, c] = [makeTask('today', 0, 'a'), makeTask('today', 1, 'b'), makeTask('today', 2, 'c')];
    const updates = planMove(listsOf([a, b, c]), { id: 'c', from: 'today', to: 'today', toIndex: 0 });
    expect(updates.map((u) => u.id)).toEqual(['c', 'a', 'b']);
  });

  it('跨模块：源模块补齐顺序，目标模块插入并改 horizon', () => {
    const [a, b] = [makeTask('today', 0, 'a'), makeTask('today', 1, 'b')];
    const [s1, s2] = [makeTask('short', 0, 's1'), makeTask('short', 1, 's2')];
    const updates = planMove(listsOf([a, b, s1, s2]), { id: 'a', from: 'today', to: 'short', toIndex: 1 });
    expect(updates).toEqual([
      { id: 'b', horizon: 'today', order: 0 },
      { id: 's1', horizon: 'short', order: 0 },
      { id: 'a', horizon: 'short', order: 1 },
      { id: 's2', horizon: 'short', order: 2 },
    ]);
  });

  it('toIndex 越界时钳制到末尾/开头', () => {
    const [a, b] = [makeTask('today', 0, 'a'), makeTask('today', 1, 'b')];
    const s1 = makeTask('short', 0, 's1');
    const updates = planMove(listsOf([a, b, s1]), { id: 'a', from: 'today', to: 'short', toIndex: 99 });
    expect(updates).toContainEqual({ id: 'a', horizon: 'short', order: 1 });
  });

  it('id 不存在时返回空计划', () => {
    const a = makeTask('today', 0, 'a');
    expect(planMove(listsOf([a]), { id: 'nope', from: 'today', to: 'today', toIndex: 0 })).toEqual([]);
  });
});
