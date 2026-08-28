import { describe, expect, it } from 'vitest';
import {
  clampToCanvas,
  clampWidth,
  rectsOverlap,
  resolveDrop,
  resolveResize,
  snapAxis,
  snapToGrid,
} from '@/services/editorLayout';

describe('snapAxis（24px 网格 / ≤12px 吸附）', () => {
  it('距网格线 ≤12px 时吸附（默认参数下任意值必在 12px 内，故必吸附）', () => {
    expect(snapAxis(36)).toBe(48); // 距 48 恰好 12，边界吸附
    expect(snapAxis(13)).toBe(24);
    expect(snapAxis(35)).toBe(24); // 距 24 为 11，中点偏左归左线
    expect(snapAxis(0)).toBe(0);
  });

  it('缩小阈值后，超出阈值的保持原值', () => {
    expect(snapAxis(37, 24, 5)).toBe(37); // 距 48 为 11 > 5
    expect(snapAxis(45, 24, 5)).toBe(48); // 距 48 为 3 ≤ 5
  });
});

describe('snapToGrid', () => {
  it('两轴独立吸附', () => {
    expect(snapToGrid({ x: 50, y: 200 })).toEqual({ x: 48, y: 192 });
  });

  it('支持自定义网格参数', () => {
    expect(snapToGrid({ x: 9, y: 23 }, 10, 2)).toEqual({ x: 10, y: 23 }); // x 距线 1px 吸附，y 距线 3px 不动
  });
});

describe('clampToCanvas', () => {
  const canvas = { width: 800, height: 600 };
  const size = { width: 360, height: 200 };

  it('越界位置钳回画布内', () => {
    expect(clampToCanvas({ x: -50, y: 999 }, size, canvas)).toEqual({ x: 0, y: 400 });
  });

  it('画布内位置不变', () => {
    expect(clampToCanvas({ x: 100, y: 100 }, size, canvas)).toEqual({ x: 100, y: 100 });
  });

  it('画布比模块窄时贴 0（不产出负坐标）', () => {
    expect(clampToCanvas({ x: 50, y: 50 }, size, { width: 300, height: 100 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('rectsOverlap', () => {
  const a = { x: 0, y: 0, width: 100, height: 100 };

  it('相交为重叠', () => {
    expect(rectsOverlap(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(true);
  });

  it('边贴边不算重叠', () => {
    expect(rectsOverlap(a, { x: 100, y: 0, width: 100, height: 100 })).toBe(false);
    expect(rectsOverlap(a, { x: 0, y: 100, width: 100, height: 100 })).toBe(false);
  });

  it('完全分离不重叠', () => {
    expect(rectsOverlap(a, { x: 200, y: 200, width: 50, height: 50 })).toBe(false);
  });
});

describe('resolveDrop（松手结算）', () => {
  const canvas = { width: 800, height: 600 };
  const size = { width: 360, height: 200 };
  const others = [{ x: 384, y: 0, width: 360, height: 200 }];

  it('无重叠时吸附 + 钳制后落位', () => {
    expect(resolveDrop({ x: 13, y: 13 }, size, canvas, others)).toEqual({ x: 24, y: 24 });
  });

  it('越界时先钳制再判定', () => {
    expect(resolveDrop({ x: -100, y: 500 }, size, canvas, others)).toEqual({ x: 0, y: 400 });
  });

  it('与其他模块重叠时返回 null（弹回）', () => {
    expect(resolveDrop({ x: 400, y: 10 }, size, canvas, others)).toBeNull();
  });

  it('贴边不重叠可落位', () => {
    expect(resolveDrop({ x: 0, y: 0 }, size, canvas, others)).toEqual({ x: 0, y: 0 });
  });
});

describe('clampWidth（宽度钳制 [280, 560] + 右缘不越画布）', () => {
  it('区间内宽度不变', () => {
    expect(clampWidth(400, 0, 800)).toBe(400);
  });

  it('低于最小宽钳到 280', () => {
    expect(clampWidth(200, 0, 800)).toBe(280);
  });

  it('高于最大宽钳到 560', () => {
    expect(clampWidth(700, 0, 800)).toBe(560);
  });

  it('右缘越画布时回缩到画布内', () => {
    expect(clampWidth(560, 400, 800)).toBe(400);
  });

  it('画布剩余不足最小宽时仍保最小宽（宁越画布不毁可用性）', () => {
    expect(clampWidth(280, 700, 800)).toBe(280);
  });
});

describe('resolveResize（调宽松手结算）', () => {
  const canvasWidth = 800;

  it('无重叠时吸附网格后落宽（350 → 360）', () => {
    expect(resolveResize({ x: 0, y: 0 }, 350, 200, canvasWidth, [])).toBe(360);
  });

  it('超出最大宽时吸附后仍钳回 560', () => {
    expect(resolveResize({ x: 0, y: 0 }, 700, 200, 1200, [])).toBe(560);
  });

  it('低于最小宽时钳到 280', () => {
    expect(resolveResize({ x: 0, y: 0 }, 200, 200, canvasWidth, [])).toBe(280);
  });

  it('右缘越画布时回缩（552 → 400）', () => {
    expect(resolveResize({ x: 400, y: 0 }, 560, 200, canvasWidth, [])).toBe(400);
  });

  it('与其他模块重叠时返回 null（弹回调宽前宽度）', () => {
    const others = [{ x: 300, y: 0, width: 360, height: 200 }];
    // 400 → 吸附 408，右缘 408 越过对方左缘 300 → 重叠
    expect(resolveResize({ x: 0, y: 0 }, 400, 200, canvasWidth, others)).toBeNull();
  });

  it('宽度恰好不越对方左缘时可落宽', () => {
    const others = [{ x: 300, y: 0, width: 360, height: 200 }];
    // 290 → 吸附 288，右缘 288 ≤ 300 不重叠
    expect(resolveResize({ x: 0, y: 0 }, 290, 200, canvasWidth, others)).toBe(288);
  });

  it('纵向上不与其他模块相交时任意调宽', () => {
    const others = [{ x: 0, y: 0, width: 560, height: 200 }];
    expect(resolveResize({ x: 0, y: 300 }, 560, 200, canvasWidth, others)).toBe(552);
  });
});
