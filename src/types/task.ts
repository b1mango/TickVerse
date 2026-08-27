/** 时间范围：今日 / 短期 / 长期 */
export type Horizon = 'today' | 'short' | 'long';

/**
 * 任务（《项目设计.md》§10.1）
 * 核心设计：完成不删除，只打 completedAt —— 一个字段撑起三个页面。
 */
export interface Task {
  id: string; // uuid
  title: string;
  horizon: Horizon;
  type?: 'task' | 'note'; // 预留 B-6 随手记
  tags?: string[]; // 预留 B-2 标签
  note?: string;
  dueDate?: string; // ISO date，可空
  createdAt: number;
  completedAt?: number; // 完成即落时间轴；undefined=未完成
  updatedAt: number; // 同步冲突合并依据
  order: number;
}
