import { describe, expect, it } from 'vitest';
import { mergeSnapshot } from '@/services/syncService';
import type { Summary } from '@/types/summary';
import type { Task } from '@/types/task';

function task(id: string, updatedAt: number): Task {
  return { id, title: id, horizon: 'today', createdAt: 0, updatedAt, order: 0 };
}

function summary(id: string, createdAt: number): Summary {
  return { id, period: 'week', rangeStart: 0, rangeEnd: 0, content: id, model: 'm', createdAt };
}

describe('mergeSnapshot（WebDAV 合并：按 id 对齐取新者）', () => {
  it('远端新记录并入本地', () => {
    const m = mergeSnapshot(
      { tasks: [task('a', 1)], summaries: [] },
      { tasks: [task('a', 1), task('b', 2)], summaries: [summary('s1', 1)] },
    );
    expect(m.tasks.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(m.summaries.map((s) => s.id)).toEqual(['s1']);
  });

  it('同 id 取 updatedAt 更新者（远端新→远端赢）', () => {
    const m = mergeSnapshot({ tasks: [task('a', 1)], summaries: [] }, { tasks: [task('a', 9)], summaries: [] });
    expect(m.tasks[0].updatedAt).toBe(9);
  });

  it('同 id 取 updatedAt 更新者（本地新→本地赢）', () => {
    const m = mergeSnapshot({ tasks: [task('a', 9)], summaries: [] }, { tasks: [task('a', 1)], summaries: [] });
    expect(m.tasks[0].updatedAt).toBe(9);
  });

  it('本地独有记录保留（并集语义）', () => {
    const m = mergeSnapshot({ tasks: [task('local', 1)], summaries: [] }, { tasks: [], summaries: [] });
    expect(m.tasks.map((t) => t.id)).toEqual(['local']);
  });

  it('summaries 同 id 取 createdAt 新者', () => {
    const m = mergeSnapshot(
      { tasks: [], summaries: [summary('s', 1)] },
      { tasks: [], summaries: [summary('s', 5)] },
    );
    expect(m.summaries[0].createdAt).toBe(5);
  });
});
