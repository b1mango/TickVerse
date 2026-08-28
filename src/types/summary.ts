/** AI 总结缓存（《项目设计.md》§10.1 Summary 表） */
export type SummaryPeriod = 'week' | 'month' | 'year' | 'custom';

export interface Summary {
  id: string; // 2026-W35 / 2026-08 / 2026
  period: SummaryPeriod;
  rangeStart: number;
  rangeEnd: number;
  content: string; // AI 生成，可手改
  model: string;
  createdAt: number;
}
