import { describe, expect, it } from 'vitest';
import {
  buildZoomView,
  clampPxPerDay,
  isOverdue,
  levelForPxPerDay,
  snapPxPerDay,
  weekStartOf,
  ZOOM_STOPS,
} from '@/services/timelineService';
import type { Horizon, Task } from '@/types/task';

// 固定"现在"：2026-08-28（周五）12:00，本周周一 = 2026-08-24，周日（end）= 2026-08-31 00:00
const NOW = new Date(2026, 7, 28, 12, 0, 0).getTime();
const day = (offsetFromWeekStart: number, hour = 10) =>
  new Date(2026, 7, 24 + offsetFromWeekStart, hour, 0, 0).getTime();

let seq = 0;
function makeTask(partial: Partial<Task> & { horizon: Horizon }): Task {
  return {
    id: `t${seq++}`,
    title: 'x',
    createdAt: NOW,
    updatedAt: NOW,
    order: 0,
    ...partial,
  };
}

describe('weekStartOf', () => {
  it('周五归到本周周一 00:00', () => {
    expect(weekStartOf(NOW)).toBe(day(0, 0));
  });
  it('周日归到本周周一', () => {
    expect(weekStartOf(day(6, 9))).toBe(day(0, 0));
  });
});

describe('isOverdue', () => {
  it('dueDate 早于今天且未完成 → 逾期', () => {
    expect(isOverdue(makeTask({ horizon: 'short', dueDate: '2026-08-27' }), NOW)).toBe(true);
  });
  it('dueDate 为今天 / 已完成 / 无 dueDate → 不逾期', () => {
    expect(isOverdue(makeTask({ horizon: 'short', dueDate: '2026-08-28' }), NOW)).toBe(false);
    expect(
      isOverdue(makeTask({ horizon: 'short', dueDate: '2026-08-01', completedAt: NOW }), NOW),
    ).toBe(false);
    expect(isOverdue(makeTask({ horizon: 'short' }), NOW)).toBe(false);
  });
});

describe('六档缩放', () => {
  it('levelForPxPerDay：锚点值精确命中对应档位', () => {
    for (const stop of ZOOM_STOPS) {
      expect(levelForPxPerDay(stop.pxPerDay)).toBe(stop.level);
    }
  });
  it('levelForPxPerDay：阈值区间按几何中点划分', () => {
    // day(400) / week(200) 分界 = sqrt(400*200) ≈ 283
    expect(levelForPxPerDay(350)).toBe('day');
    expect(levelForPxPerDay(250)).toBe('week');
    // month(120) / quarter(24) 分界 = sqrt(120*24) ≈ 54
    expect(levelForPxPerDay(70)).toBe('month');
    expect(levelForPxPerDay(40)).toBe('quarter');
    // quarter(24) / year(6) 分界 = sqrt(144) = 12
    expect(levelForPxPerDay(13)).toBe('quarter');
    expect(levelForPxPerDay(10)).toBe('year');
    // year(6) / years(1) 分界 = sqrt(6) ≈ 2.45
    expect(levelForPxPerDay(3)).toBe('year');
    expect(levelForPxPerDay(1.5)).toBe('years');
  });
  it('snapPxPerDay：磁吸最近档位', () => {
    expect(snapPxPerDay(350).level).toBe('day');
    expect(snapPxPerDay(260).level).toBe('week'); // 260 < 283 分界
    expect(snapPxPerDay(290).level).toBe('day');
    expect(snapPxPerDay(70).level).toBe('month');
    expect(snapPxPerDay(16).level).toBe('quarter');
    expect(snapPxPerDay(8).level).toBe('year');
    expect(snapPxPerDay(1.5).level).toBe('years');
  });
  it('clampPxPerDay：边界锁定在日档与年视图档之间', () => {
    expect(clampPxPerDay(999)).toBe(400);
    expect(clampPxPerDay(0.1)).toBe(1);
    expect(clampPxPerDay(200)).toBe(200);
  });
});

describe('buildZoomView', () => {
  it('空库 → empty', () => {
    expect(buildZoomView([], 'week', NOW).empty).toBe(true);
  });

  it('范围：起点 = 第一条记录 createdAt 当日，终点 = 本周日', () => {
    const t = makeTask({ horizon: 'today', createdAt: day(-10), completedAt: day(-9) });
    const view = buildZoomView([t], 'week', NOW);
    expect(view.start).toBe(day(-10, 0));
    expect(view.end).toBe(day(7, 0));
  });

  it('week 档：每日一列；完成落位、象限任务投影写入日列、其余未完成投影今天列', () => {
    const done = makeTask({ horizon: 'today', createdAt: day(2), completedAt: day(2) });
    const legacy = makeTask({ horizon: 'long' });
    const quad = makeTask({ horizon: 'long', quadrant: 'q2', createdAt: day(1) });
    const view = buildZoomView([done, legacy, quad], 'week', NOW);
    expect(view.columns.every((c) => c.days === 1)).toBe(true);
    const doneCol = view.columns.find((c) => c.start === day(2, 0))!;
    expect(doneCol.completed.map((x) => x.id)).toEqual([done.id]);
    const todayCol = view.columns.find((c) => c.isToday)!;
    expect(todayCol.projected.map((x) => x.id)).toEqual([legacy.id]); // 旧 horizon 数据仍投影今天列
    const writtenCol = view.columns.find((c) => c.start === day(1, 0))!;
    expect(writtenCol.projected.map((x) => x.id)).toEqual([quad.id]); // 象限任务投影写入当日列
    expect('longAnchors' in view).toBe(false); // 悬浮代办长列已移除
  });

  it('quarter 档：每周一列，跨周完成聚合到对应周', () => {
    const a = makeTask({ horizon: 'today', createdAt: day(-14), completedAt: day(-13) }); // 上上周
    const b = makeTask({ horizon: 'today', createdAt: day(-14), completedAt: day(1) }); // 本周
    const view = buildZoomView([a, b], 'quarter', NOW);
    expect(view.columns.every((c) => c.days === 7)).toBe(true);
    const counts = view.columns.map((c) => c.completed.length);
    expect(counts.reduce((x, y) => x + y, 0)).toBe(2);
    expect(view.columns.find((c) => c.isToday)!.completed.map((x) => x.id)).toEqual([b.id]);
  });

  it('year 档：每月一列，按月聚合', () => {
    const a = makeTask({
      horizon: 'today',
      createdAt: new Date(2026, 5, 3).getTime(),
      completedAt: new Date(2026, 5, 20).getTime(),
    }); // 6 月
    const b = makeTask({
      horizon: 'today',
      createdAt: new Date(2026, 5, 3).getTime(),
      completedAt: day(0),
    }); // 8 月
    const view = buildZoomView([a, b], 'year', NOW);
    const months = view.columns.map((c) => new Date(c.start).getMonth());
    expect(months[0]).toBe(5);
    expect(view.columns[0].completed.map((x) => x.id)).toEqual([a.id]);
    expect(view.columns[view.columns.length - 1].completed.map((x) => x.id)).toEqual([b.id]);
  });

  it('years 档：每年一列，跨年聚合', () => {
    const a = makeTask({
      horizon: 'today',
      createdAt: new Date(2025, 7, 5).getTime(),
      completedAt: new Date(2025, 9, 11).getTime(),
    }); // 2025
    const b = makeTask({
      horizon: 'today',
      createdAt: new Date(2025, 7, 5).getTime(),
      completedAt: day(0),
    }); // 2026
    const view = buildZoomView([a, b], 'years', NOW);
    expect(view.columns).toHaveLength(2);
    expect(new Date(view.columns[0].start).getFullYear()).toBe(2025);
    expect(view.columns[0].completed.map((x) => x.id)).toEqual([a.id]);
    expect(view.columns[1].completed.map((x) => x.id)).toEqual([b.id]);
    expect(view.columns[1].isToday).toBe(true);
  });
});
