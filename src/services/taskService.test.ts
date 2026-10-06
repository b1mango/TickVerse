import { describe, expect, it } from 'vitest';
import { planQuadrantMove } from '@/services/taskService';
import type { Quadrant, Task } from '@/types/task';
import { QUADRANT_HORIZON } from '@/types/task';

let seq = 0;
function makeTask(quadrant: Quadrant, order: number, id?: string): Task {
  return {
    id: id ?? `t${seq++}`,
    title: 'x',
    horizon: QUADRANT_HORIZON[quadrant],
    quadrant,
    createdAt: 0,
    updatedAt: 0,
    order,
  };
}

function listsOf(tasks: Task[]): Record<Quadrant, Task[]> {
  return {
    q1: tasks.filter((t) => t.quadrant === 'q1'),
    q2: tasks.filter((t) => t.quadrant === 'q2'),
    q3: tasks.filter((t) => t.quadrant === 'q3'),
    q4: tasks.filter((t) => t.quadrant === 'q4'),
  };
}

describe('planQuadrantMove', () => {
  it('象限内下移：重写该象限 order 为顺序序号', () => {
    const [a, b, c] = [makeTask('q1', 0, 'a'), makeTask('q1', 1, 'b'), makeTask('q1', 2, 'c')];
    const updates = planQuadrantMove(listsOf([a, b, c]), {
      id: 'a',
      from: 'q1',
      to: 'q1',
      toIndex: 2,
    });
    expect(updates).toEqual([
      { id: 'b', quadrant: 'q1', horizon: 'today', order: 0 },
      { id: 'c', quadrant: 'q1', horizon: 'today', order: 1 },
      { id: 'a', quadrant: 'q1', horizon: 'today', order: 2 },
    ]);
  });

  it('象限内上移', () => {
    const [a, b, c] = [makeTask('q1', 0, 'a'), makeTask('q1', 1, 'b'), makeTask('q1', 2, 'c')];
    const updates = planQuadrantMove(listsOf([a, b, c]), {
      id: 'c',
      from: 'q1',
      to: 'q1',
      toIndex: 0,
    });
    expect(updates.map((u) => u.id)).toEqual(['c', 'a', 'b']);
  });

  it('跨象限：源象限补齐顺序，目标象限插入并改 quadrant + horizon 映射', () => {
    const [a, b] = [makeTask('q1', 0, 'a'), makeTask('q1', 1, 'b')];
    const [s1, s2] = [makeTask('q4', 0, 's1'), makeTask('q4', 1, 's2')];
    const updates = planQuadrantMove(listsOf([a, b, s1, s2]), {
      id: 'a',
      from: 'q1',
      to: 'q4',
      toIndex: 1,
    });
    expect(updates).toEqual([
      { id: 'b', quadrant: 'q1', horizon: 'today', order: 0 },
      { id: 's1', quadrant: 'q4', horizon: 'long', order: 0 },
      { id: 'a', quadrant: 'q4', horizon: 'long', order: 1 },
      { id: 's2', quadrant: 'q4', horizon: 'long', order: 2 },
    ]);
  });

  it('toIndex 越界时钳制到末尾/开头', () => {
    const [a, b] = [makeTask('q1', 0, 'a'), makeTask('q1', 1, 'b')];
    const s1 = makeTask('q2', 0, 's1');
    const updates = planQuadrantMove(listsOf([a, b, s1]), {
      id: 'a',
      from: 'q1',
      to: 'q2',
      toIndex: 99,
    });
    expect(updates).toContainEqual({ id: 'a', quadrant: 'q2', horizon: 'long', order: 1 });
  });

  it('id 不存在时返回空计划', () => {
    const a = makeTask('q1', 0, 'a');
    expect(
      planQuadrantMove(listsOf([a]), { id: 'nope', from: 'q1', to: 'q1', toIndex: 0 }),
    ).toEqual([]);
  });
});
