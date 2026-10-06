/** 时间范围：今日 / 短期 / 长期 */
export type Horizon = 'today' | 'short' | 'long';

/** 四象限（艾森豪威尔矩阵）：q1 重要且紧急 / q2 重要不紧急 / q3 紧急不重要 / q4 不重要不紧急 */
export type Quadrant = 'q1' | 'q2' | 'q3' | 'q4';

export const QUADRANT_IDS: readonly Quadrant[] = ['q1', 'q2', 'q3', 'q4'];

/**
 * 象限条目的时间档映射：象限条目不参与三档清单展示，horizon 仅用于
 * 时间轴投影（q1/q3 投影到今日列）与长期锚定（q2/q4）、统计按模块归因。
 */
export const QUADRANT_HORIZON: Record<Quadrant, Horizon> = {
  q1: 'today',
  q2: 'long',
  q3: 'short',
  q4: 'long',
};

/**
 * 任务（《项目设计.md》§10.1）
 * 核心设计：完成不删除，只打 completedAt —— 一个字段撑起三个页面。
 */
export interface Task {
  id: string; // uuid
  title: string;
  horizon: Horizon;
  /** 所属象限（艾森豪威尔矩阵）；设置了象限的条目只在四象限模块展示，不进三档清单 */
  quadrant?: Quadrant;
  type?: 'task' | 'note'; // 预留 B-6 随手记
  tags?: string[]; // 预留 B-2 标签
  note?: string;
  dueDate?: string; // ISO date，可空
  createdAt: number;
  completedAt?: number; // 完成即落时间轴；undefined=未完成
  updatedAt: number; // 同步冲突合并依据
  order: number;
}
