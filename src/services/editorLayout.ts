/**
 * 记录页自定义布局的纯逻辑：网格吸附 / 画布钳制 / 重叠判定 / 松手结算。
 * 与 UI 解耦，便于单测（磁吸约束见需求：24px 网格、≤12px 吸附、重叠弹回）。
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export const GRID_SIZE = 24;
export const SNAP_THRESHOLD = 12;
/** 自定义模式模块宽度约束：固定取默认宽，落在 [min, max] 区间内 */
export const CUSTOM_MODULE_MIN_WIDTH = 280;
export const CUSTOM_MODULE_MAX_WIDTH = 560;
export const CUSTOM_MODULE_WIDTH = 360;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** 单轴吸附：距最近网格线 ≤ threshold 时吸到网格线，否则保持原值 */
export function snapAxis(
  value: number,
  grid: number = GRID_SIZE,
  threshold: number = SNAP_THRESHOLD,
): number {
  const nearest = Math.round(value / grid) * grid;
  return Math.abs(nearest - value) <= threshold ? nearest : value;
}

export function snapToGrid(
  pos: Point,
  grid: number = GRID_SIZE,
  threshold: number = SNAP_THRESHOLD,
): Point {
  return { x: snapAxis(pos.x, grid, threshold), y: snapAxis(pos.y, grid, threshold) };
}

/** 钳制进画布：模块完整落在 [0, canvas - size]；画布比模块还窄时贴 0 */
export function clampToCanvas(pos: Point, size: Size, canvas: Size): Point {
  return {
    x: clamp(pos.x, 0, canvas.width - size.width),
    y: clamp(pos.y, 0, canvas.height - size.height),
  };
}

/** 严格重叠（边贴边不算重叠） */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

/**
 * 松手结算：候选位置 → 网格吸附 → 画布钳制；
 * 与其他模块重叠则返回 null（调用方弹回拖拽前位置，不做自动避让）。
 */
export function resolveDrop(candidate: Point, size: Size, canvas: Size, others: Rect[]): Point | null {
  const settled = clampToCanvas(snapToGrid(candidate), size, canvas);
  const rect: Rect = { ...settled, ...size };
  return others.some((o) => rectsOverlap(rect, o)) ? null : settled;
}

/** 宽度钳制：钳在 [min, max]，且右缘（originX + 宽）不得越画布右缘（越界回缩） */
export function clampWidth(width: number, originX: number, canvasWidth: number): number {
  return clamp(
    width,
    CUSTOM_MODULE_MIN_WIDTH,
    Math.min(CUSTOM_MODULE_MAX_WIDTH, canvasWidth - originX),
  );
}

/**
 * 调宽松手结算：候选宽度 → 网格吸附（宽度也吸 24px 网格线）→ 区间 + 画布钳制；
 * 与其他模块重叠则返回 null（调用方弹回调宽前宽度，与位置拖拽语义一致）。
 */
export function resolveResize(
  origin: Point,
  candidateWidth: number,
  height: number,
  canvasWidth: number,
  others: Rect[],
): number | null {
  const width = clampWidth(snapAxis(candidateWidth), origin.x, canvasWidth);
  const rect: Rect = { x: origin.x, y: origin.y, width, height };
  return others.some((o) => rectsOverlap(rect, o)) ? null : width;
}
